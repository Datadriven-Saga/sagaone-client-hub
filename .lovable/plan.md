# Corrigir RLS de `departamento_permissoes` para que overrides do Permission Flags valham para todos os perfis

## Problema

A tabela `departamento_permissoes` armazena os overrides do Permission Flags. Hoje só **Admin/Master/TI** conseguem fazer `SELECT` (RLS restritiva). O hook `useUserAccessType` lê essa tabela no cliente para montar as permissões do usuário logado.

Quando um CRM (ou Vendedor, SDR, Gerente, Recepcionista, Diretor, Proprietário, Coordenadora) carrega o app, o `SELECT` volta vazio por RLS, e o resolvedor cai nos **defaults** do `PermissionRegistry`. Resultado: qualquer toggle ligado/desligado no Permission Flags para esses perfis é silenciosamente ignorado em runtime.

Sintoma reportado: CRM com `canUseStoreSeat = true` configurado não vê o menu "Cadeiras" nem consegue acessar `/cadeiras`.

## Correção

### 1. Migração de RLS

Trocar a política única (FOR ALL Admin/Master/TI) por duas políticas:

- **SELECT**: liberado para `authenticated` (a tabela é configuração pública do app; não contém dados sensíveis — só flags por perfil).
- **INSERT / UPDATE / DELETE**: restrito a Admin/Master/TI (comportamento atual).

```sql
DROP POLICY IF EXISTS departamento_permissoes_admin_master_ti
  ON public.departamento_permissoes;

CREATE POLICY departamento_permissoes_select_authenticated
  ON public.departamento_permissoes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY departamento_permissoes_write_admin_master_ti
  ON public.departamento_permissoes
  FOR ALL TO authenticated
  USING (get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso,'Master'::tipo_acesso,'TI'::tipo_acesso]))
  WITH CHECK (get_current_user_access_type() = ANY (ARRAY['Administrador'::tipo_acesso,'Master'::tipo_acesso,'TI'::tipo_acesso]));
```

Confirmar que os GRANTs já existem para `authenticated` (a tabela já é usada por Admin/Master/TI). Se faltar, adicionar `GRANT SELECT ON public.departamento_permissoes TO authenticated;`.

### 2. Sem alteração de código frontend

`useUserAccessType` já lê a tabela inteira e resolve overrides corretamente. Após a migração, o CRM passará a enxergar o override e o item "Cadeiras" aparecerá automaticamente (basta recarregar a sessão).

### 3. Validação

- CRM logado → menu **Cadeiras** aparece, rota `/cadeiras` abre.
- Vendedor/SDR sem override permanecem sem o menu (defaults inalterados).
- Admin/Master/TI continuam podendo editar Permission Flags; demais perfis recebem erro de RLS se tentarem escrever (esperado).

## Riscos

- **Exposição**: `departamento_permissoes` passa a ser legível por qualquer usuário autenticado. Conteúdo é apenas `{departamento, permissao, ativo, valor}` — não há PII nem segredos. Aceitável.
- **Cache**: usuários logados precisam recarregar para reler os overrides (comportamento normal do hook).

## Fora de escopo

- Mudar defaults do `PermissionRegistry`.
- Mover a resolução de permissões para o servidor (RPC SECURITY DEFINER) — alternativa mais robusta, mas maior. Pode entrar como follow-up se quisermos esconder a config do cliente.
