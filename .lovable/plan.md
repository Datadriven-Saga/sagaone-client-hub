## Ajuste — filtrar por feature flag no trigger

Hoje o trigger `trg_dispatch_movimentacao_lead_webhook` dispara o `pg_net.http_post` para todo INSERT em `logs_movimentacao_contatos` com `status_novo IN ('Confirmado','Check-in','Descartado')`. A validação de `webhook_movimentacao_lead` por empresa só acontece dentro do edge function, então empresas sem a flag continuam recebendo chamadas HTTP desnecessárias (custo de `pg_net` + invocação do edge).

### Mudança

Migration que recria `tg_dispatch_movimentacao_lead_webhook` adicionando, antes do `net.http_post`:

1. Resolver `empresa_id` a partir de `NEW.contato_id` (via `contatos.empresa_id`) — o log não carrega empresa diretamente.
2. Curto-circuito por `public.is_feature_enabled_for_empresa('webhook_movimentacao_lead', empresa_id)`. Se `false` ou `NULL`, `RETURN NEW` sem chamar `pg_net`.
3. Manter `RAISE LOG` para auditoria (`skip flag_disabled empresa=…`).
4. Manter o filtro de status atual (`Confirmado/Check-in/Descartado`) como primeiro guard — barato, evita resolver empresa para movimentos inelegíveis.
5. Continuar com `EXCEPTION WHEN OTHERS` engolindo erros para não bloquear o INSERT.

O edge `trigger-webhook` mantém todas as validações (flag, canal, status, Pri IA) como defense-in-depth — ninguém precisa confiar só no trigger.

### Não muda

- Lógica do edge `_shared/movimentacao-lead-webhook.ts`.
- Filtro de canal (`Mensal`/`Grande Evento`) continua só no edge (canal é por evento, não por empresa).
- Fluxo FE da Recepção / Kanban.

### Verificação

1. Empresa com flag ON → INSERT de Check-in dispara `pg_net` (conferir `net._http_response` + log do edge).
2. Empresa com flag OFF → INSERT de Check-in **não** dispara (sem linha nova em `net._http_response`, log Postgres mostra `skip flag_disabled`).
3. Status inelegível (`Convidado`) continua skipped por design.
