---
name: Revalidação imediata anti-duplicidade usa eventos_prospeccao
description: Antes da Lambda no caminho immediate, filtrar leads do batch por eventos_prospeccao.data_disparo_ia por (prospeccao_id, contato_id). Sem fallback em contatos.data_disparo_ia.
type: feature
---

No caminho immediate de `process-campaign-job`, antes de montar o
payload da Lambda, revalidar os leads do batch consultando
`eventos_prospeccao` por `(prospeccao_id, contato_id)` e descartar
quem já tem `data_disparo_ia IS NOT NULL`.

- Gate canônico = `eventos_prospeccao.data_disparo_ia` (mesmo gate do
  caminho scheduled).
- **Não** ler `contatos.data_disparo_ia` no hot path — tabela grande
  demais, custo alto para o caso degenerado.
- Contatos pulados são contabilizados em `skipped_already_dispatched`
  no log `🏁 [BG] Batch finalizado ...`.