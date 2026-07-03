# Guia: Configurar SSO do zero (padrão SagaOne)

Este plano é um **documento explicativo** — não altera código. Ele descreve exatamente como reproduzir o setup de SSO que roda hoje no SagaOne em um projeto novo (React + Vite + Supabase/Lovable Cloud).

---

## 1. Visão geral da arquitetura

O SSO do SagaOne combina 5 peças:

```text
Azure AD (IdP)
   │  OAuth2 / OIDC
   ▼
Supabase Auth (provider = azure)
   │  onAuthStateChange → SIGNED_IN
   ▼
AuthContext (React)
   ├─► RPC can_user_login(user_id, method)   ── allowlist de domínios + is_active
   ├─► RPC auto_provision_user_from_sso      ── cria/atualiza profile + tipo_acesso
   └─► redirect deep-link salvo em localStorage
```

Regras que herdamos do SagaOne:
- Domínio corporativo (`@gruposaga.com.br`) é o único liberado por padrão; qualquer outro precisa passar pela `allowed_login_domains`.
- Sessão máx. 8 h + idle 1 h → logout automático.
- `TOKEN_REFRESHED` faz no-op para não desmontar rotas protegidas.
- Deep linking: rota destino é salva antes do redirect Azure e restaurada após login.
- Iframe da preview Lovable bloqueia o SSO Microsoft — sempre testar fora do iframe.

---

## 2. Setup no Azure AD (portal.azure.com)

1. **Azure AD → App registrations → New registration**
   - Name: `<Meu Projeto> SSO`
   - Supported account types: *Single tenant* (ou multi, se precisar).
   - Redirect URI (Web): `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
2. Anote **Application (client) ID** e **Directory (tenant) ID**.
3. **Certificates & secrets → New client secret** → anote o **Value** (aparece só uma vez).
4. **API permissions → Microsoft Graph** → `openid`, `profile`, `email`, `User.Read` → **Grant admin consent**.
5. (Opcional) **Token configuration** → adicionar optional claim `email` no ID token; e **App roles** se quiser usar roles do Azure para mapear tipo de acesso interno (padrão `sso-automated-provisioning-logic` do SagaOne).

---

## 3. Setup no Supabase

1. **Authentication → Providers → Azure** → ativar e preencher:
   - Application (client) ID
   - Secret Value
   - Azure Tenant URL: `https://login.microsoftonline.com/<TENANT_ID>/v2.0`
2. **Authentication → URL Configuration**:
   - Site URL: URL de produção (ex.: `https://app.exemplo.com.br`).
   - Additional Redirect URLs: adicionar preview Lovable, custom domain e `http://localhost:8080` para dev.
3. **Auth → Settings**: habilitar "Leaked password protection" (defesa mínima mesmo para SSO).

---

## 4. Banco: allowlist + guard rails

Migration única (rodar 1 vez):

```sql
-- 4.1 Allowlist de domínios
CREATE TABLE public.allowed_login_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dominio text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'sso',        -- 'sso' | 'password' | 'ambos'
  ativo boolean NOT NULL DEFAULT true,
  descricao text,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.allowed_login_domains TO anon, authenticated;
GRANT ALL   ON public.allowed_login_domains TO service_role;
ALTER TABLE public.allowed_login_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read allowlist" ON public.allowed_login_domains
  FOR SELECT TO anon, authenticated USING (true);

-- Seed protegido do domínio corporativo
INSERT INTO public.allowed_login_domains (dominio, tipo, descricao)
VALUES ('<meudominio.com.br>', 'sso', 'Domínio corporativo') ON CONFLICT DO NOTHING;

-- Trigger anti-remoção do domínio raiz (evita travar todo mundo)
CREATE OR REPLACE FUNCTION public.protect_root_domain() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.dominio = '<meudominio.com.br>' THEN
    RAISE EXCEPTION 'Domínio raiz não pode ser alterado/removido';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_protect_root_domain
  BEFORE UPDATE OR DELETE ON public.allowed_login_domains
  FOR EACH ROW EXECUTE FUNCTION public.protect_root_domain();

-- 4.2 Profiles com flags de externo/ativo
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  nome text,
  tipo_acesso text NOT NULL DEFAULT 'Colaborador',
  is_active boolean NOT NULL DEFAULT true,
  is_external boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self read"   ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 4.3 RPC de validação (allowlist + is_active)
CREATE OR REPLACE FUNCTION public.can_user_login(_user_id uuid, _method text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_dom text; v_ok boolean;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
  IF v_email IS NULL THEN RETURN false; END IF;
  v_dom := lower(split_part(v_email, '@', 2));

  SELECT true INTO v_ok FROM public.allowed_login_domains
   WHERE ativo = true AND lower(dominio) = v_dom
     AND (_method IS NULL OR tipo = 'ambos' OR tipo = _method)
   LIMIT 1;
  IF v_ok IS NOT TRUE THEN RETURN false; END IF;

  RETURN COALESCE(
    (SELECT is_active FROM public.profiles WHERE id = _user_id),
    true
  );
END $$;
GRANT EXECUTE ON FUNCTION public.can_user_login(uuid, text) TO authenticated, anon;

-- 4.4 Auto-provision no primeiro login SSO
CREATE OR REPLACE FUNCTION public.auto_provision_user_from_sso(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_nome text;
BEGIN
  SELECT email, COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name')
    INTO v_email, v_nome FROM auth.users WHERE id = p_user_id;

  INSERT INTO public.profiles (id, email, nome, is_external)
  VALUES (p_user_id, v_email, v_nome, false)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  -- (aqui você mapeia roles Azure -> tipo_acesso, se aplicável)
END $$;
GRANT EXECUTE ON FUNCTION public.auto_provision_user_from_sso(uuid) TO authenticated;
```

Observação: o padrão SagaOne guarda o guard `WHERE is_external = false` dentro do `auto_provision_user_from_sso` para não sobrescrever terceiros. Reproduza se seu produto tiver login de terceiro.

---

## 5. Frontend (React + Vite)

### 5.1 Cliente Supabase (`src/integrations/supabase/client.ts`)
Padrão Lovable já existente. Nada especial — só garantir `persistSession: true` e `autoRefreshToken: true`.

### 5.2 `AuthContext.tsx` — pontos-chave (replicar do SagaOne)
- **Deep link:** antes de redirecionar para `/login`, salvar `location.pathname` em `localStorage['auth_redirect_path']` (ver `ProtectedRoute.tsx`).
- **`signInWithAzure`:**
  ```ts
  supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo: `${window.location.origin}/`, scopes: 'email profile openid' }
  });
  ```
- **`onAuthStateChange`:**
  - `SIGNED_OUT` → limpar estado.
  - `SIGNED_IN` → `setTimeout(0)` (evita deadlock), chamar `can_user_login`, se ok chamar `auto_provision_user_from_sso`, restaurar deep link.
  - `TOKEN_REFRESHED` → **no-op** se `access_token` e `user.id` iguais (evita desmontar árvore).
- **Sessão 8h / idle 1h:** timers em `sessionTimerRef` / `inactivityTimerRef`, chaves `session_start_time` e `last_activity_time` em `sessionStorage`.
- **Fail-open interno / fail-closed externo:** se `can_user_login` falhar por erro de rede, permite passar apenas se email termina no domínio interno.

### 5.3 Tela de Login
- CTA único "Entrar com Microsoft" chamando `signInWithAzure()`.
- Efeito que, ao detectar `user`, lê `localStorage['auth_redirect_path']` e navega para lá (com fallback `/`).

### 5.4 Guards de rota
- `ProtectedRoute`: exige `user`; salva rota atual em `localStorage` antes de mandar para `/login`.
- `PermissionProtectedRoute`: além de `user`, valida flag do `useUserAccessType` (só necessário se você replicar RBAC).

---

## 6. Ordem de execução recomendada

1. Registrar app no Azure AD e capturar client id / secret / tenant id.
2. Ativar provider Azure no Supabase + preencher redirect URLs.
3. Rodar migration da seção 4 (allowlist + profiles + RPCs + seed do domínio).
4. Implementar `AuthContext` + `ProtectedRoute` + tela de Login (seção 5).
5. QA mínimo:
   - Login com email do domínio raiz → entra.
   - Login com email fora da allowlist → bloqueado com toast.
   - Usuário com `profiles.is_active = false` → bloqueado.
   - Deep link: acessar `/relatorios` deslogado → após SSO cai em `/relatorios`.
   - `TOKEN_REFRESHED` ao voltar para a aba → não recarrega tela.
   - Sessão idle 1h → logout automático.
   - **Testar fora do iframe da preview Lovable** (SSO Microsoft não abre dentro dele).

---

## 7. Riscos / pegadinhas (herdadas do SagaOne)

| Risco | Mitigação |
|---|---|
| Redirect URI errada no Azure | Precisa ser exatamente `https://<ref>.supabase.co/auth/v1/callback` |
| Preview Lovable em iframe bloqueia MS SSO | Testar em janela nova / domínio publicado |
| Apagar seed do domínio raiz e travar login | Trigger `protect_root_domain` |
| `TOKEN_REFRESHED` desmontando rotas | No-op quando `access_token` não muda |
| Terceiros caindo no auto-provision de interno | Guard `WHERE is_external = false` |
| Sessão de usuário desativado continua válida | `can_user_login` roda a cada refresh e `auth.admin.signOut` ao desativar |

---

Se quiser, no próximo passo eu implemento esse mesmo setup em um projeto vazio (migrations + AuthContext + Login) — só me confirmar.
