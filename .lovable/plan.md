## Objetivo

Evitar nova parada do SSO por expiração silenciosa do client secret do Azure AD. Registrar a rotação atual e disparar alertas automáticos para admins antes do próximo vencimento.

## Premissas confirmadas

- Secret Azure acabou de ser rotacionado hoje (2026-07-06).
- Assumir validade de **24 meses** → alerta começa **23 meses depois** (janela de ~30 dias antes de expirar). Reforço semanal enquanto não for renovado.
- Email já disponível via `RESEND_API_KEY` (Resend). Sem necessidade de novo provedor.
- Alertas vão para usuários com `canAccessAdminConfig` (Master / TI / Admin).

## Banco

Nova tabela `sso_secret_rotations`:

```text
- id
- provider              (default 'azure')
- client_id
- rotated_at            (timestamp)
- expires_at            (timestamp)
- alert_at              (expires_at - interval '30 days')
- last_alerted_at       (nullable)
- alert_count           (default 0)
- created_by            (uuid, nullable)
```

RLS: leitura e escrita restritas a `canAccessAdminConfig` via `has_permission`. `service_role` full.

Seed inicial:

```text
provider     = 'azure'
client_id    = 'e00d4b5a-ae41-426f-ada6-ad136b7bd835'
rotated_at   = now()
expires_at   = now() + interval '24 months'
alert_at     = expires_at - interval '30 days'
```

Cron `pg_cron` diário chamando a edge function (via `pg_net`).

## Edge Function `check-sso-secret-expiration`

Fluxo diário:

1. Seleciona rotações ativas onde `alert_at <= now()` e (`last_alerted_at IS NULL` OR `now() - last_alerted_at >= 7 dias`) e `expires_at > now() - 7 dias`.
2. Para cada uma:
   - Lista admins alvo via query em `profiles` + `has_permission('canAccessAdminConfig')`.
   - Cria notificação in-app (`tipo = 'sso_secret_expirando'`, título "Client Secret Azure expira em X dias", link `/administracao`).
   - Envia email via **Resend** (`RESEND_API_KEY`) usando template simples HTML com: dias restantes, client_id, passo a passo curto de renovação, link do Azure Portal e do Supabase Auth Providers.
   - Atualiza `last_alerted_at = now()`, incrementa `alert_count`.
3. Se `expires_at < now()`, marca alerta como crítico (título e cor diferente, envia diariamente até renovar).

Também registra em `logs_notificacoes_email` (tabela já existe).

## Frontend

Em `/administracao`, novo bloco no topo (apenas se `canAccessAdminConfig`):

- Card "SSO Microsoft — Client Secret"
- Mostra `expires_at`, dias restantes e status (verde > 60d, amarelo 30–60d, vermelho < 30d ou vencido).
- Botão **"Registrar nova rotação"** abre modal:
  - Campo `expires_at` (default: hoje + 24 meses)
  - Campo opcional `client_id`
  - Ao salvar: insere nova linha em `sso_secret_rotations`, marca as anteriores como `resolved_at = now()` (adicionar coluna) e zera alertas.

Sem mudanças em nenhum outro fluxo.

## Docs

- `docs/arquitetura/autenticacao-e-sessao.md`: nova seção "Rotação do Client Secret Azure" com o processo e onde ver o alerta.
- `.lovable/plan.md`: marcar SSO como resolvido e apontar para o novo alerta automático.

## Fora de escopo

- Migração para autenticação por certificado no Azure (apenas mencionar como recomendação futura).
- Alertas por WhatsApp/SMS.
- Mexer no fluxo de login OTP já implementado.
- Alertas para outros providers.

## Ordem de execução

1. Migração: tabela + índice + RLS + grants + seed + cron.
2. Edge Function `check-sso-secret-expiration` + template de email Resend.
3. UI card + modal em `/administracao`.
4. Docs.

## Perguntas rápidas

1. Confirma validade padrão de **24 meses** com alerta 30 dias antes + reforço semanal? Se preferir 60 ou 90 dias, ajusto.
2. Email deve ir só para Master/TI/Admin (`canAccessAdminConfig`), ou quer incluir uma lista fixa adicional (ex.: `ti@gruposaga.com.br`)?
