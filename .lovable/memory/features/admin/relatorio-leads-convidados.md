---
name: Relatório Leads Convidados
description: Relatório histórico de leads que passaram pelo status "Convidado" em /resultados/relatorios, controlado por feature flag per_empresa
type: feature
---
Tela em `/resultados/relatorios` (componente `RelatorioConvidadosTab`) extrai todos os leads que passaram pelo status "Convidado" em uma loja, baseado no histórico de `logs_movimentacao_contatos` (não em `contatos.status` atual).

**Feature flag:** `relatorio_leads_convidados` (scope `per_empresa`, ativada por loja em /administracao/feature-flags). A RPC já valida server-side via `feature_flag_empresas`, retornando vazio se desativada.

**RPC:** `get_relatorio_convidados(p_empresa_id, p_date_start, p_date_end, p_prospeccao_ids)` — SECURITY DEFINER, usa `DISTINCT ON (contato_id, prospeccao_id)` para 1 linha por lead/evento, aceita os valores `'Convidado'` e `'convidados'` em `status_novo`.

**Filtros UI:** data início, data fim, evento (single-select). Exporta CSV com BOM UTF-8 para abrir corretamente no Excel.

**Índice de performance:** `idx_logs_movimentacao_status_convidado` (parcial em status_novo IN ('Convidado','convidados')).
