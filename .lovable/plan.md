
## Objetivo

Ao excluir um usuário, apagar a conta em `auth.users` mas **preservar o histórico com a identificação daquele usuário** (nome/email visíveis, não "N/A").

## Problema com a abordagem anterior

`ON DELETE SET NULL` destrava a exclusão, mas **zera o autor** nos logs — perdemos "quem fez". Não atende o pedido.

## Nova abordagem: arquivo de usuários deletados

### 1. Nova tabela `public.deleted_users_archive`

Snapshot do perfil no momento da exclusão. Vira a fonte de identidade quando o `auth.users` não existir mais.

```sql
CREATE TABLE public.deleted_users_archive (
  id uuid PRIMARY KEY,          -- mesmo UUID que estava em auth.users
  email text,
  nome_completo text,
  tipo_acesso text,
  deleted_at timestamptz DEFAULT now(),
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.deleted_users_archive TO authenticated;
GRANT ALL ON public.deleted_users_archive TO service_role;
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
-- Policy: admins/master leem; escrita só service_role (via edge function).
```

### 2. Remover FKs de auditoria para `auth.users`

Nas colunas de auditoria (`created_by`, `updated_by`, `criado_por`, `granted_by`, `mfa_audit_logs.user_id`, etc.) **remover a FK**, mantendo apenas a coluna `uuid`.

- O UUID **permanece** na linha de auditoria — o histórico continua registrado com o usuário original.
- Sem FK, o Postgres não bloqueia mais a exclusão.
- Tabelas alteradas (mesma lista do diagnóstico anterior):
  `agente_empresas`, `agentes_nextip`, `bases_importadas`, `controle_agentes`, `feature_flag_empresas`, `global_opt_outs`, `mfa_account_access.granted_by`, `mfa_accounts.created_by`, `mfa_audit_logs`, `mfa_feature_flags`, `mfa_master_users.created_by`, `opt_outs` (created_by e updated_by), `system_feature_flags`.

**NÃO** removo FKs de posse com `CASCADE` já existentes (`profiles.id`, `user_empresas.user_id`, `academy_*.user_id`, `mfa_password_vault.created_by`, `mfa_recovery_codes.user_id`, `mfa_master_users.user_id`, `mfa_account_access.user_id`, `mfa_accounts.user_id`) — essas devem continuar deletando junto porque são dados pessoais do usuário, não histórico de ação.

### 3. Ajustar a edge function `manage-users` (case `delete_user`)

Ordem nova:
1. Carrega o perfil do alvo (`profiles` + `auth.admin.getUserById`).
2. `INSERT INTO deleted_users_archive` com `id`, `email`, `nome_completo`, `tipo_acesso`, `deleted_by = caller.id`.
3. `supabase.auth.admin.deleteUser(user_id)` — agora funciona (sem FK bloqueando; `profiles` cascateia normalmente).
4. Retorna sucesso.

### 4. Função helper para resolver identidade em telas

```sql
CREATE OR REPLACE FUNCTION public.resolve_user_identity(_user_id uuid)
RETURNS TABLE (id uuid, nome_completo text, email text, deleted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nome_completo, u.email, false
    FROM profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.id = _user_id
  UNION ALL
  SELECT d.id, d.nome_completo, d.email, true
    FROM deleted_users_archive d
    WHERE d.id = _user_id
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = _user_id)
  LIMIT 1;
$$;
```

As telas que hoje fazem join `logs → profiles` passam a chamar essa função (ou fazem `LEFT JOIN deleted_users_archive`) para exibir "Fulano (removido)".

## O que muda para o usuário final

- Botão "Excluir usuário" volta a funcionar.
- Logs, auditoria, quarentena, MFA audit: continuam mostrando o **nome e email do autor** mesmo depois da exclusão, com um marcador visual "(removido)".
- Dados pessoais/posse do usuário (perfil, vínculos, MFA vault dele) são apagados junto — como já era.

## Ordem de execução

1. Migração: cria `deleted_users_archive` + policies + `resolve_user_identity` + `DROP CONSTRAINT` das FKs de auditoria listadas.
2. Edge function `manage-users`: adiciona snapshot antes do `deleteUser`.
3. (Opcional, próximo passo) atualizar telas de log para exibir "(removido)" — me diga se quer nesse mesmo turno ou depois.

## Teste

1. Criar usuário de teste, dar acesso a alguma coisa que grave em `mfa_audit_logs` ou `logs_cadeiras`.
2. Excluir pelo Controle de Acessos.
3. Esperado: exclusão OK; consulta `SELECT * FROM deleted_users_archive` mostra o snapshot; logs antigos continuam com o UUID dele e o join via `resolve_user_identity` traz nome+email marcados como removido.
