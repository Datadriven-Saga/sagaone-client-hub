# Logs de disparos (`logs_disparos`)

**Área:** Prospecção
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Tabela `logs_disparos` — auditoria oficial de **todo** disparo (WhatsApp e Ligação). Popula a tela `/administracao/logs-disparos` (ver [logs-disparos admin](../administracao/logs-disparos.md) *(pendente)*).

## Origens (duas fontes coexistem)

### `origem = 'edge_function'` (atual, canônica)

Populada por:
- `process-campaign-job` → 1 linha por **batch**.
- `dispatch-leads-webhook` → 1 linha por **chamada** à Lambda.

Cada linha carrega contexto multi-tenant completo:
`empresa_id`, `marca`, `uf`, `template_id`, `template_nome`, `job_id`, `batch_index`, `total_sucesso`, `total_falha`, `valor_unitario_usd`, `custo_total_usd`.

### `origem = 'frontend'` (legado, em desativação)

Populada por `registrarLogDisparo()` chamado em `EventoBase.tsx` e `DispararCustoModal.tsx`. Grava a **intenção** de disparo (estimativa de custo antes do envio). Fire-and-forget.

**Plano:** após 1–2 semanas confirmando que `edge_function` cobre 100%, remover as chamadas de `registrarLogDisparo()` do FE.

## Custo

- **WhatsApp:** 0.06 USD por contato (fixo).
- **Ligação:** custo unitário = 0 no `logs_disparos` (o custo real vem do Vapi/Twilio, ver [ia-ligacao](./ia-ligacao.md)).
- **Cotação BRL:** Edge Functions gravam **apenas USD**. Conversão é feita sob demanda na UI via toggle "Mostrar BRL" que chama `cotacao-dolar`.

## Detalhes técnicos

- **Tabela:** `logs_disparos` (+ `logs_disparos_falhas` para detalhamento de falhas por contato).
- **Helper FE (legado):** `src/lib/dispatchErrors.ts`, `registrarLogDisparo()` em `EventoBase.tsx`.
- **RPC de filtros:** `get_logs_disparos_filtros()` (SECURITY DEFINER) — feed dos selects de marca/UF/usuário/evento.
- **Tela:** `src/pages/admin/LogsDisparos.tsx`. Filtros com debounce, totalizadores USD, export CSV até 10k linhas.
- **Memory canônica:** `architecture/prospeccao/logs-disparos-server-side`.

## Regras de negócio

- Toda linha `origem='edge_function'` é o **evento real** de envio; `origem='frontend'` é intenção estimada.
- Reconciliação: contagem por `job_id` deve bater entre `campaign_batches.total_contatos` e a soma de `total_sucesso + total_falha` das linhas `edge_function`.
- Falhas por contato ficam em `logs_disparos_falhas` (não em `logs_disparos`).

## Relacionado

- [Dispatch WhatsApp](./dispatch-whatsapp.md)
- [Auditoria](./auditoria.md)
- [Logs Disparos (admin)](../administracao/logs-disparos.md) *(pendente)*