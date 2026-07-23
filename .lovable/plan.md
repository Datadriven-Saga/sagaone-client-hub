
# Restaurar acesso da Iris com `iris.vcamargo@gruposaga.com.br`

## Diagnóstico verificado (via banco)

- Hoje `2026-07-23 14:04:19` o admin `240d8c4e-f7d2-4201-87b5-7e7873dbd218` deletou o profile `d896d921-…` cujo email era **`iris.vcamargo@gruposaga.com.br`** (nome `Iris Camargo`, `tipo_acesso = CRM`). Está preservado em `public.deleted_users_archive`.
- Em `14:07:12` uma segunda conta `_ris.vcamargo@saganet.onmicrosoft.com` (id `b874bc97-…`) também foi arquivada.
- Em `14:08:43` o SSO Azure entrou novamente e o auto-provisioning criou **um novo** `auth.users` `948a55ae-b9c2-4c34-9e63-54cbdfd3dddc` com email `_ris.vcamargo@saganet.onmicrosoft.com`, profile `iris virginia flausino de camargo`, e já veio com 90+ empresas (`is_ativa = BMW GYN`).
- **Em `auth.users` não existe nenhuma linha com `iris.vcamargo@gruposaga.com.br`** hoje — só o registro `948a55ae` com o email errado do Azure.

## Causa do email estranho

O Azure AD dela está com `userPrincipalName = _ris.vcamargo@saganet.onmicrosoft.com` (underscore no lugar do "i" e domínio `.onmicrosoft.com`). Isso é config do Azure AD, não do SagaOne — mas afeta o auto-provisioning aqui todo login que ela fizer.

## O que vou fazer (só depois da sua aprovação)

### Etapa 1 — Restaurar o usuário canônico
1. Atualizar o auth user existente `948a55ae-…` trocando o email para `iris.vcamargo@gruposaga.com.br` (via `auth.admin.updateUserById` na edge `manage-users`, ou UPDATE direto em `auth.users` se preferir SQL — recomendo o primeiro).
2. Atualizar o `public.profiles` do mesmo id para:
   - `nome_completo = 'Iris Camargo'` (do archive)
   - `tipo_acesso = 'CRM'` (do archive)
   - `status = 'ativo'`
3. Manter as `user_empresas` que o SSO já criou (BMW GYN ativa + 90 outras). **Confirmar com você** se ela deve ficar em todas essas empresas ou apenas nas originais dela (o archive não guarda a lista de empresas anteriores — só o profile).

### Etapa 2 — Prevenir o loop de auto-provisioning
Enquanto o Azure AD dela continuar com UPN `_ris...saganet`, o próximo login SSO vai:
- Ou reaproveitar o user `948a55ae` (se o auto-provisioning casar pelo `oid`/`sub` do Azure) — **desejado**;
- Ou criar OUTRO auth user com o email `_ris...saganet` — **problema, cai no mesmo ciclo**.

Preciso verificar em `supabase/functions/azure-auto-provision` (ou nome equivalente) qual campo é usado para match — se for `email`, mudar para `sub`/`provider_id` para evitar recriação.

### Etapa 3 (opcional, recomendo pedir ao TI)
Corrigir o UPN da Iris no Azure AD para `iris.vcamargo@gruposaga.com.br`. Sem isso, todo login SSO dela vai vir com email errado.

## Perguntas antes de executar

1. Restauro as empresas dela conforme o `948a55ae` está hoje (BMW GYN + 90 outras vinculadas pelo SSO), ou você quer que eu deixe apenas as empresas que ela tinha antes? *(o archive não tem essa lista — precisaria você informar ou eu remover todas menos BMW GYN)*
2. Você já pediu ao TI para corrigir o UPN no Azure AD, ou quer que eu deixe uma trava no código para o auto-provisioning aceitar o UPN errado apenas se casar com email conhecido?

## Arquivos que serão tocados

- `supabase/functions/manage-users/index.ts` — adicionar action `restore_user` (ou usar `update_user` existente) para trocar email do auth user e atualizar profile do archive.
- Investigar `supabase/functions/*` que fazem o auto-provisioning SSO (a determinar após leitura) — ajustar match por `sub`/`provider_id` em vez de email, caso ainda seja por email.

Nenhuma migração de schema é necessária.
