# Fluxo de Importação do Pool (Segmentar Base)

Documento operacional do botão **"Segmentar Base"** disponível em **Prospecção → Adicionar Clientes**.
Atualizado em jun/2026 — paridade total com o fluxo de importação por planilha.

## Visão geral

```
UI (ImportarDoDataLake.tsx)
  └── get_pool_facets_for_empresa()        → opções de filtro (DDD, motivo, status…)
  └── get_pool_clientes_for_empresa()      → preview paginado (keyset)
  └── pool_segmentacoes (INSERT)           → log de segmentação salva
  └── importar_pool_para_evento()          → vinculação efetiva + governança
        ├── logs_prospeccoes  (acao='importacao_pool')   ← histórico do evento
        └── import_logs       (origem='pool')            ← auditoria unificada
```

## Permissões

Geridas em **/administracao/controle-acessos** → módulo **Base / Contatos**.

| Chave | Quem usa | O que libera | Valor extra |
|---|---|---|---|
| `canImportPoolFull` | Master, Admin, CRM (padrão) | Vê dados completos, edita nome/telefone, importa para qualquer evento | `dias_max` |
| `canImportPoolReadOnly` | Demais perfis (padrão desligado) | Telefone mascarado (`6298****`), sem edição, importa só para eventos autorizados | `dias_max`, `eventos_permitidos` (`todos` ou `futuros`) |

A permissão legada `canImportPool` foi removida.
Master ignora overrides — sempre Full.

## Validações server-side

### `get_pool_clientes_for_empresa`
1. `user_can_access_empresa` — empresa ativa pertence ao usuário.
2. `get_pool_permission` — kind = `full` | `readonly` | `none`. Recusa quando `none`.
3. Clamp do `dias_atras` solicitado pelo `dias_max` da permissão (o front pode pedir 365, mas o RPC retorna no máximo o limite do usuário).
4. Mascaramento de telefone (`LEFT(digits,4) || '****'`) quando o kind é `readonly`.

### `importar_pool_para_evento(empresa, evento, itens, segmentacao_id?)`
Ordem dos checks (em loop, item-a-item, dentro de `BEGIN/EXCEPTION` que conta `errors`):

1. **Evento encerrado (ReadOnly + `eventos_permitidos='futuros'`)** — se `prospeccoes.data_fim < hoje`, recusa toda a importação retornando `blocked_evento_encerrado = total` com `message`.
2. **Janela (`dias_max`)** — usa `pool_clientes_externos.criado_em_origem`. Se null ou anterior à janela, conta em `blocked_janela`.
3. **Opt-out global** (`global_opt_outs`) — pulado quando `empresas.bypass_compliance = true`.
4. **Opt-out externo** (snapshot do dia em `external_optout_snapshots` para `marca_api × uf`) — pulado em bypass. Se não houver snapshot válido, não bloqueia (paridade com `process-import`, que faz fail-closed na hora de carregar o snapshot — aqui usamos o snapshot já carregado).
5. **Quarentena de marca** (`contato_quarentena` por `telefone_normalizado × marca × canal='whatsapp'`) — respeita `quarentena_exclusoes`, feature flag `quarentena_marca_ativa`, eventos `is_teste=true` e bypass.
6. **Upsert em `contatos`** + vínculo em `eventos_prospeccao` + append em `pool_clientes_externos.importado_em_evento_ids`.

Bypass de compliance (`empresas.bypass_compliance = true`) desliga opt-out global, opt-out externo e quarentena — mesmo comportamento do `bulk_upsert_contatos`.

## Contadores retornados

| Campo | Significado |
|---|---|
| `inserted` | Novos `contatos` criados |
| `updated` | Contatos existentes que tiveram dados atualizados |
| `linked` | Vinculações novas em `eventos_prospeccao` |
| `already_linked` | Já estavam no evento |
| `blocked_quarentena` | Bloqueados pela quarentena da marca |
| `blocked_optout_global` | Telefone na lista negra global |
| `blocked_optout_externo` | Telefone na lista oficial de opt-out (snapshot do dia) |
| `blocked_janela` | Fora da janela `dias_max` do usuário |
| `blocked_evento_encerrado` | ReadOnly tentando importar para evento já encerrado |
| `errors` | Falhas individuais capturadas no laço |
| `total` | Total de itens enviados |
| `modo` | `full` ou `readonly` |

## Auditoria

- **`pool_segmentacoes`** — 1 linha por preview confirmado (avançar para edição), contendo `nome` auto, `filtros`, `total_resultados`.
- **`logs_prospeccoes`** — 1 linha com `acao='importacao_pool'`, `usuario_id`, `detalhes` (JSON: segmentacao_id, modo, dias_max, eventos_permitidos, contadores).
- **`import_logs`** — 1 linha com `origem='pool'`, status `done`, contadores principais e `message` com IDs auxiliares.

## Checklist de liberação para outros perfis

Antes de marcar `canImportPoolFull` ou `canImportPoolReadOnly` para um novo perfil:

- [ ] Admin Master → slider ilimitado, importa qualquer evento.
- [ ] CRM (`dias_max=90`) → slider trava em 90 mesmo chamando o RPC direto.
- [ ] SDR (`dias_max=30`, `eventos_permitidos='futuros'`) → bloqueado para eventos com `data_fim < hoje`; telefone mascarado; sem edição inline.
- [ ] Perfil sem permissão → opção "Segmentar Base" desabilitada e RPC rejeita com `Sem permissão para Segmentar Base`.
- [ ] Lead em quarentena / opt-out global / opt-out externo aparece como bloqueado no toast e não vincula.
- [ ] `logs_prospeccoes` ganha 1 entrada `importacao_pool` por importação.
- [ ] `import_logs` ganha 1 entrada com `origem='pool'`.

## Áreas críticas — NÃO mexer sem teste completo

- `bulk_upsert_contatos` permanece intocado; toda a paridade vive em `importar_pool_para_evento`.
- Não alterar RLS de `eventos_prospeccao` nem a visibilidade SDR/vendedor.
- Não migrar o fluxo de planilha para reaproveitar este RPC sem reavaliar a feature `self-chaining` e os limites de batch.