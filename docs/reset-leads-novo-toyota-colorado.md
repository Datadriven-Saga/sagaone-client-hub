# Reset de Leads para "Novo" — Investigação e Plano de Correção

**Data da análise:** 23/07/2026
**Loja de referência:** Toyota Colorado (`empresa_id = 424f681c-...`)
**Sintoma reportado:** Leads com histórico de atribuição a vendedores voltaram
para o status `Novo` e ficaram sem `responsavel_email`, mesmo com logs de
`Responsável atribuído` preservados no timeline do card.

---

## 1. O que aconteceu

Auditoria em `contatos`, `logs_movimentacao_contatos` e `contatos_responsavel_rejeicoes`
para a Toyota Colorado confirmou:

- **Histórico íntegro:** todos os eventos de atribuição continuam gravados —
  nenhum log foi apagado.
- **632 leads em `Novo`** no momento da análise.
  - **80 leads** possuem histórico anterior de `Atribuído` a um vendedor.
  - **553 leads** estão sem `responsavel_email` preenchido no `contatos`.
- **Exemplos concretos:**
  - *Maria Mirtene* e *Gleyciane* aparecem com sequência
    `Atribuído → Novo` disparada por ferramentas automatizadas segundos após a
    atribuição.

Ou seja: o dado histórico está correto, mas o **estado atual** (`status` e
`responsavel_email` em `contatos`) foi sobrescrito por três fontes diferentes.

---

## 2. Causas identificadas

### 2.1. Job de manutenção `reset_leads_evento_sem_log` (20/07/2026)

A função `public.reset_leads_evento_sem_log` executou uma varredura em massa e
moveu **1.104 leads** para `Novo` porque não encontrou log **específico do
evento em curso** — mesmo os leads que estavam atribuídos globalmente no
`contatos.status`.

Causa raiz: a função tratava ausência de log por evento como "lead nunca teve
status" e resetava para `Novo`, ignorando o status global vigente.

**Mitigação já aplicada:** a função foi bloqueada com `RAISE EXCEPTION` para
impedir novas execuções acidentais (via cron, dashboard ou chamada manual).

### 2.2. Automação Pri IA / n8n em eventos encerrados

A edge function `prospeccao-status` recebeu **204 alterações para `Novo`**
atribuídas ao usuário `thais.bsouza` (Pri IA/n8n), muitas delas em eventos
cuja `data_fim` já era passada. O fluxo automatizado continuou "limpando"
leads mesmo após o encerramento do evento, revertendo atribuições legítimas.

### 2.3. `mutate_contato_status_atomic` zera `responsavel_email` ao ir para `Novo`

A RPC atômica que muta status limpa `responsavel_email` sempre que o novo
status é `Novo`. Combinada com 2.1 e 2.2, isso explica por que os leads
resetados também apareceram sem responsável — mesmo com o log de atribuição
ainda visível no timeline.

---

## 3. Por que o histórico "some" da UI

Ele não some: continua em `logs_movimentacao_contatos`. O card mostra o
histórico corretamente. O que muda é o **estado atual** (`contatos.status` e
`contatos.responsavel_email`), que é o que a Kanban e a fila do SDR leem.
O usuário percebe como "voltou para novo e perdeu o vendedor".

---

## 4. Plano de correção

### Fase 1 — Contenção (já feito)

- [x] Bloquear `reset_leads_evento_sem_log` com `RAISE EXCEPTION`.
- [x] Rollback dos 22.157 logs impactados em 45 eventos (execução anterior).

### Fase 2 — Correção de comportamento (a executar, com aprovação)

1. **Bloquear escrita em eventos encerrados** na edge `prospeccao-status`:
   rejeitar `PUT/PATCH` quando `prospeccoes.data_fim < CURRENT_DATE`,
   retornando `409` com motivo explícito.
   Impacto: evita que n8n/Pri IA continue mexendo em eventos já finalizados.
2. **Restaurar os 80 leads da Toyota Colorado** que voltaram para `Novo`:
   script idempotente que, para cada lead impactado, lê o último log de
   `Atribuído` em `logs_movimentacao_contatos` e restaura `status` +
   `responsavel_email` em `contatos`, sem apagar logs.
3. **Auditoria transversal:** rodar o mesmo diagnóstico para as demais lojas
   Toyota/Jeep já reportadas (Anápolis, Goianésia, T7, T9) e listar os leads
   candidatos a restauração antes de executar.

### Fase 3 — Prevenção

1. Revisar `mutate_contato_status_atomic`: só limpar `responsavel_email`
   quando a transição para `Novo` for **manual e explícita** (parâmetro
   `p_clear_owner`), nunca em resets automáticos.
2. Adicionar `evento_encerrado` como motivo de rejeição em
   `prospeccao-status` e refletir no dashboard de diagnóstico.
3. Manter `reset_leads_evento_sem_log` bloqueada. Se a operação de fato
   precisar de uma reciclagem de leads, criar RPC nova (`v2`) que exija
   `evento_id` explícito e nunca opere em massa cross-evento.

---

## 5. O que **não** alterar nesta rodada

- `bulk_upsert_contatos` (zona crítica — regra do projeto).
- Estrutura de `logs_movimentacao_contatos` (histórico preservado).
- Triggers `trg_dispatch_movimentacao_lead_webhook` e
  `trg_log_contato_status` — o fluxo de webhook único já está correto.

---

## 6. Testes obrigatórios antes de fechar

- Restaurar 1 lead piloto na Toyota Colorado e validar Kanban + fila SDR.
- Tentar `PUT prospeccao-status` em evento com `data_fim` passada e
  confirmar `409`.
- Rodar diagnóstico em Toyota Anápolis para confirmar ausência de novos
  resets após o bloqueio.
- Verificar que `mutate_contato_status_atomic` continua limpando
  `responsavel_email` **apenas** quando chamado com a flag explícita.

---

## 7. Referências

- `.lovable/memory/architecture/webhooks/movimentacao-lead-single-source.md`
- `docs/prospeccao/kanban-e-status.md`
- `docs/prospeccao/atribuicao-sdr.md`
- RPC `public.mutate_contato_status_atomic`
- Edge function `supabase/functions/prospeccao-status/index.ts`