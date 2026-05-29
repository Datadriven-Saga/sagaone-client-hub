---
name: Logs Disparos Server-Side
description: logs_disparos agora é populado pelas Edge Functions (origem='edge_function') com contexto multi-tenant, USD apenas, BRL via toggle de cotação na UI
type: architecture
---
`logs_disparos` é populado em 2 caminhos:
- **Frontend (legado)**: `registrarLogDisparo()` em `EventoBase.tsx` e `DispararCustoModal.tsx` insere com `origem='frontend'`. Log de intenção/custo estimado. Fire-and-forget.
- **Edge Function (atual)**: `process-campaign-job` insere 1 linha por batch e `dispatch-leads-webhook` insere 1 linha por chamada, ambas com `origem='edge_function'`, contexto completo (empresa_id, marca, uf, template_id, template_nome, job_id, batch_index, total_sucesso, total_falha).

Edge function NÃO armazena cotação nem BRL — só USD (`valor_unitario_usd`, `custo_total_usd`). Whatsapp = 0.06 USD/contato, Ligação = 0 USD (custo vem do Vapi/Twilio).

UI `/administracao/logs-disparos`: filtros por data/marca/UF/usuário/evento/origem, busca com debounce, totalizadores em USD, toggle "Mostrar BRL" que invoca edge `cotacao-dolar` sob demanda, export CSV até 10k linhas. Filtros usam RPC `get_logs_disparos_filtros()` (SECURITY DEFINER).

Plano de transição: validar 1-2 semanas que `origem='edge_function'` cobre todos os disparos, depois remover os calls de `registrarLogDisparo()` do frontend.
