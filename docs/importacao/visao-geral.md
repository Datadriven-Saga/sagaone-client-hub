# Importação de Bases — Visão Geral

**Área:** Importação
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Conjunto de fluxos que **inserem/atualizam leads** (`contatos`) e os **vinculam a eventos de prospecção** (`eventos_prospeccao`). Todos convergem para a RPC crítica `bulk_upsert_contatos`.

## Pontos de entrada

| Origem | Interface | Backend | Doc |
|---|---|---|---|
| **Planilha** (XLSX/XLS/CSV) | `UploadPlanilha` em Prospecção → Adicionar Clientes | Storage `import-files` → Edge `process-import` → `bulk_upsert_contatos` | [importacao-planilha.md](./importacao-planilha.md) |
| **Pool / DataLake** | Botão "Segmentar Base" | RPCs `get_pool_clientes_for_empresa` + `importar_pool_para_evento` | [importacao-pool.md](./importacao-pool.md) |
| **Ingestão contínua** (jobs) | — (automático) | Edge `ingest-base-clientes` → `bulk_upsert_contatos` | [ingest-base-clientes.md](./ingest-base-clientes.md) |
| **API pública PRI** | POST externo | Edge `create-lead-pri` → `bulk_upsert_contatos` (evento único) | [../apis/create-lead-pri.md](../apis/create-lead-pri.md) |
| **API pública Ligação** | POST externo | Edge `create-lead-ligacao` | pendente |
| **API pública genérica** | POST externo | Edge `create-lead` | pendente |

## Fluxo comum

```
entrada
  → normalização de telefone (55 + 9º dígito)
  → bulk_upsert_contatos
       ├─ INSERT/UPDATE em contatos (conflito por telefone_normalizado + empresa_id)
       ├─ vínculo em eventos_prospeccao (IF NOT EXISTS)
       ├─ checagem de contato_quarentena (por telefone/marca/canal)
       ├─ checagem de global_opt_outs
       └─ registro em quarentena_logs se bloqueado
  → import_logs (origem = 'planilha' | 'pool' | 'ingest' | 'api')
  → bases_importadas (metadados do arquivo, quando planilha)
```

## Regras invariantes

- **Dedup canônico:** `(empresa_id, telefone_normalizado)`. Nome/e-mail nunca decidem duplicidade.
- **Status nunca regride:** upsert preserva `status` mais avançado.
- **PRI IA** só é definida como responsável em contatos **novos** e sem `responsavel_email`.
- Todo insert em `eventos_prospeccao` é **idempotente** — vínculo duplicado é ignorado.
- Quarentena e opt-out são checados **antes** de vincular ao evento.

## Métricas

`import_logs` traz por lote:
- `total_linhas`, `vinculados`, `ja_vinculados`, `bloqueados_quarentena`, `bloqueados_optout`, `invalidos`.
- **Total processado ≠ novos leads.** Fórmula usada nas telas: `Total = Vinculados + JáVinculados` (ver memory `metricas-resultado-importacao`).

## Relacionado

- [`bulk_upsert_contatos` — regras críticas](./bulk-upsert-contatos.md)
- [Quarentena](../prospeccao/quarentena.md)
- [Logs de disparos](../prospeccao/logs-disparos.md)