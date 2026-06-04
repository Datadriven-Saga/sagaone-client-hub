# Plano final — Login de Terceiros + Cadeiras (com feature flag por empresa)

Mesmo plano aprovado, agora **gated por feature flag por empresa**. Rollout inicial: apenas EMPRESA ADMIN (`b32ae8c9-34f6-4646-946e-2a05ff07b02b`) habilitada.

## Estratégia de feature flag

Usar o padrão já existente do projeto: `system_feature_flags` + `feature_flag_empresas` (mesmo mecanismo do `FeatureFlagEmpresasModal`).

### Flag
- **Chave:** `login_terceiros_cadeiras`
- **Default:** `false` (desligada)
- **Habilitação:** linha em `feature_flag_empresas` para cada empresa autorizada.
- **Seed inicial:** apenas EMPRESA ADMIN.

### Helper (já existe padrão no projeto)
Usar/estender RPC existente do tipo `is_feature_enabled_for_empresa(flag_key, empresa_id)` SECURITY DEFINER, retornando boolean. Se já houver helper equivalente em uso, reaproveitar — não criar duplicata.

### Onde o gate é aplicado

**Banco (`can_user_login`):**
- Para `is_external=true`: além das checagens já planejadas, exige que `is_feature_enabled_for_empresa('login_terceiros_cadeiras', profiles.empresa_id) = true`. Se a flag for desligada na empresa, o terceiro deixa de logar imediatamente (defesa em profundidade).
- Internos `@gruposaga.com.br` **não** dependem da flag.

**Edge (`manage-users`):**
- Branches `create_external` e `renew_external_seat` validam a flag para `empresa_id` recebido. Retornam 403 com mensagem clara ("Recurso indisponível para esta loja") quando desligada.

**Frontend:**
- `useUserAccessType` (ou hook `useFeatureFlag` já existente) expõe `loginTerceirosCadeirasEnabled` baseado na `activeCompany`.
- Sidebar: item "Cadeiras" só aparece se `loginTerceirosCadeirasEnabled && (canUseStoreSeat || canManageStoreSeats || canManageLoginDomains)`.
- `/cadeiras`: se flag off para a empresa ativa, renderiza estado vazio "Recurso não habilitado para esta loja. Fale com TI."
- `/login` e `/login/terceiros`: **não** dependem da flag (login externo é global; o filtro real está em `can_user_login` + seat). A página `/login/terceiros` continua acessível para empresas habilitadas que já tenham cadeiras criadas.
- Painéis admin (`canManageStoreSeats`, `canManageLoginDomains`) **não** dependem da flag — admin precisa enxergar para habilitar empresas.

## Migration adicional (única, ao fim da Fase 1)

```sql
-- 1. Registrar flag em system_feature_flags (default off)
INSERT INTO public.system_feature_flags (chave, descricao, valor, ativo)
VALUES (
  'login_terceiros_cadeiras',
  'Habilita login externo de terceiros e gestão de cadeiras por loja',
  'false'::jsonb,
  true
)
ON CONFLICT (chave) DO NOTHING;

-- 2. Habilitar para EMPRESA ADMIN (sandbox)
INSERT INTO public.feature_flag_empresas (flag_chave, empresa_id, habilitado)
VALUES ('login_terceiros_cadeiras', 'b32ae8c9-34f6-4646-946e-2a05ff07b02b', true)
ON CONFLICT (flag_chave, empresa_id) DO UPDATE SET habilitado = true;
```

> Confirmar nomes reais de colunas em `system_feature_flags` e `feature_flag_empresas` antes de rodar (campos `chave`/`valor`/`habilitado` podem variar). O passo de seed vai como **insert tool**, não migration.

## Ajustes da revisão anterior (mantidos)

1. RLS de SELECT em `external_access_seats` **sem** `profile_id = auth.uid()` (terceiro não vê a própria cadeira).
2. `empresa_id` da cadeira vem de `CompanyContext.activeCompany`; edge revalida via `user_can_access_empresa`.
3. "Evento ativo" = `data_fim >= today AND COALESCE(snapshot_realizado,false) = false`.
4. QA confirma assinaturas reais de `auth.admin.signOut(userId,'global')` e `auth.admin.updateUserById(userId,{password})` na versão do `@supabase/supabase-js` da edge.
5. `PermissionProtectedRoute` já suporta array OR — sem alteração.

## Ordem de implementação (inalterada)

Banco → Edge → Frontend, com gate de QA do SSO interno antes do merge.

## QA — itens adicionais para a flag

19. Empresa **não habilitada** na flag: gerente de leads não vê item "Cadeiras" no sidebar; rota `/cadeiras` mostra estado vazio "Recurso não habilitado".
20. Empresa **não habilitada**: chamada direta à edge `create_external` com `empresa_id` da empresa não habilitada retorna 403.
21. Empresa **não habilitada**: terceiro pré-existente (cenário de rollback) não consegue mais logar — `can_user_login` retorna false por causa da flag.
22. EMPRESA ADMIN (seed): fluxo end-to-end funciona — criar cadeira, login do terceiro, renovação, desativação.
23. Admin/TI vê painéis "Configurar cadeiras por loja" e "Domínios de login" **independente** da flag estar ativa em alguma empresa específica (para conseguir habilitar).
24. Toggle da flag em `FeatureFlagEmpresasModal` (ou UI equivalente) ativa/desativa o recurso para uma empresa sem necessidade de redeploy.

## Plano de rollout

1. Deploy completo com flag em `false` global.
2. Habilitar EMPRESA ADMIN via seed.
3. Validação interna na sandbox (todos os 24 itens de QA).
4. Habilitar empresas piloto via `FeatureFlagEmpresasModal`.
5. Rollout geral após estabilização.

(O resto do plano — Fases 1-4, "O que NÃO alterar", "Fora de escopo" — permanece exatamente como aprovado.)
