---
name: Auditoria do template-paused-webhook
description: Tabela template_pausado_audit registra toda invocação do webhook com payload, IP, UA, status e duração; cobre o gap do template_pausado_log que só nasce após o lock ser adquirido
type: feature
---

Tabela `public.template_pausado_audit` (RLS ON, SELECT só para
Administrador/TI/Master; service_role escreve com `GRANT ALL`).

Diferença para `template_pausado_log`:

- `template_pausado_log` só nasce **depois** do lock atômico (STEP 1) ser
  adquirido. Se o payload chega malformado, sem `id_meta`, com `id_meta`
  inexistente, ou cai em exceção, **não há rastro** no log.
- `template_pausado_audit` é gravado em **toda** invocação do
  `template-paused-webhook`, incluindo:
  - payload JSON inválido (`status_final='id_meta_missing'`);
  - `id_meta` que não bate com nenhum template
    (`status_final='template_nao_encontrado'`, `template_encontrado=false`);
  - lock já adquirido por execução paralela
    (`status_final='ignored_duplicate_request'`);
  - sucesso (`status_final='awaiting_approval'` ou `'failed'`);
  - exceção (`status_final='exception'` + `erro`).

Campos: `request_id`, `id_meta_recebido`, `payload_bruto` (jsonb),
`client_ip`, `user_agent`, `status_final`, `template_encontrado`,
`eventos_impactados_count`, `erro`, `duracao_ms`, `created_at`.

Use sempre que precisar provar "alguém chamou esse webhook com X
`id_meta`?" — antes desta tabela, a única evidência era logs voláteis da
edge function.
