# Objetivo

Introduzir o conceito de **lead** como entidade própria (única por `contato + evento`) com **status próprio**, para uso exclusivo do Kanban v2 (`/prospeccao/atendimento-v2`). Nada em produção muda de comportamento.

---

# 1. Como funciona hoje (verificado)

| Conceito | Onde vive hoje | Problema |
|---|---|---|
| Pessoa (telefone) | `contatos` (unicidade por telefone dentro da `empresa_id`) | OK |
| Vínculo pessoa↔evento | `eventos_prospeccao(contato_id, prospeccao_id, ...)` | Tabela faz dois papéis: vínculo **e** histórico de interações. Permite múltiplas linhas para o mesmo par. |
| Status | `contatos.status` (**global**, único por pessoa) | Se a pessoa aparece em 2 eventos, o status é o mesmo para ambos → métricas infladas, race conditions, UX confusa. Documentado como débito estrutural. |
| Status por evento (derivado) | `logs_movimentacao_contatos` — última linha por `(contato_id, prospeccao_id)` | Correto conceitualmente, mas **caro em leitura** (window function em toda consulta do Kanban). |
| Responsável | `contatos.responsavel_email` (**global**) | Mesmo problema do status. |

Distância do modelo desejado: o "lead por evento" **não existe como entidade**; ele é reconstruído em runtime a partir dos logs a cada render do Kanban.

---

# 2. Modelo alvo (somente v2)

Nova tabela `public.leads` — **fonte de verdade do lead por evento**, alimentada pelos mesmos gatilhos que já geram log hoje.

```text
contatos (pessoa, único por telefone)
   └── leads (N por contato, 1 por evento)
         ├─ contato_id  ──► contatos.id
         ├─ prospeccao_id ──► prospeccoes.id     UNIQUE(contato_id, prospeccao_id)
         ├─ status           (status atual DO LEAD, não do contato)
         ├─ responsavel_email
         ├─ temperatura_id
         ├─ ultima_movimentacao_at
         └─ created_at / updated_at
   └── logs_movimentacao_contatos (histórico — permanece igual)
```

Regras:
- Filtrar por contato → todos os leads (todos os eventos daquela pessoa).
- Filtrar por lead → 1 contato + 1 evento.
- `contatos.status` continua existindo e sendo escrito pelos fluxos atuais — **produção intocada**.

---

# 3. Estratégia de convivência (sem quebrar prod)

1. **Backfill idempotente** de `leads` a partir de:
   - `eventos_prospeccao` (todo par `contato_id + prospeccao_id` distinto vira 1 lead)
   - último `logs_movimentacao_contatos` daquele par define o `status` inicial
   - fallback: `contatos.status` se não houver log (mesma regra da RPC atual)
2. **Sincronização contínua** via trigger em `logs_movimentacao_contatos`:
   - após cada insert, `UPSERT` em `leads` atualizando `status`, `responsavel_email`, `ultima_movimentacao_at`.
   - assim, todo fluxo legado (importação, `mutate_contato_status_atomic`, webhooks Mobi, atribuição SDR) continua chamando o que já chama e **automaticamente** popula `leads`.
3. **Nenhum código de produção lê `leads`** nesta fase. Só o Kanban v2.
4. Feature flag `kanban_v2_leads_table` para poder desligar leitura da nova tabela e cair de volta na RPC baseada em logs, sem redeploy.

---

# 4. Ganho de performance

- Kanban v2 hoje: `get_kanban_columns` faz `DISTINCT ON` sobre `logs_movimentacao_contatos` filtrando por `prospeccao_id`. Custo cresce com histórico.
- Kanban v2 depois: `SELECT ... FROM leads WHERE prospeccao_id = ANY($1)` — 1 índice `(prospeccao_id, status)` resolve.

---

# 5. Plano de execução

## Fase A — Estrutura (migração)
1. `CREATE TABLE public.leads (...)` + GRANTs + RLS espelhando `contatos` (acesso via `user_can_access_empresa(empresa_id)` derivado do contato).
2. Índices: `UNIQUE(contato_id, prospeccao_id)`, `(prospeccao_id, status)`, `(responsavel_email, prospeccao_id)`.
3. Trigger `AFTER INSERT ON logs_movimentacao_contatos` → `UPSERT` em `leads`.
4. Backfill em batch (função `backfill_leads_from_eventos(_empresa_id)`), roda por empresa, idempotente.

## Fase B — RPC de leitura v2
5. `get_kanban_v2(p_prospeccao_ids uuid[], filtros...)` lendo apenas `leads` + join leve em `contatos` (nome/telefone). Mantém contrato semelhante a `get_kanban_columns`.

## Fase C — Kanban v2 usa a nova fonte
6. `useKanbanBasico.ts` passa a chamar `get_kanban_v2` atrás da feature flag; escrita continua em `mutate_contato_status_atomic` (que grava log → trigger popula `leads`).
7. Ajuste do README do feature para refletir a nova origem.

## Fase D — Validação
8. Job de consistência: comparar `leads.status` vs. último log por par. Alerta se divergir. Roda 1x/dia até estabilizar.
9. Tela `/administracao/diagnostico-status` ganha aba "Leads v2" reutilizando a checagem.

---

# 6. Fora de escopo (explicitamente)

- Não migrar `contatos.status` → produção segue usando o campo global.
- Não mexer em `eventos_prospeccao` (dívida arquitetural fica para depois).
- Não alterar telas antigas, webhooks Mobi, importação, SDR, quarentena, disparos WhatsApp/Voz.
- Não expor `leads` em nenhuma rota de prod.

---

# 7. Riscos & mitigação

| Risco | Mitigação |
|---|---|
| Backfill pesado em empresas grandes | Rodar por `empresa_id`, em transações pequenas, com `ON CONFLICT DO UPDATE` |
| Trigger em `logs_movimentacao_contatos` afetar caminho crítico | Trigger `AFTER INSERT`, sem `RAISE`, `SECURITY DEFINER`, testado com carga antes de habilitar |
| Divergência silenciosa `leads` vs. logs | Job de consistência da Fase D + feature flag para rollback instantâneo |
| RLS incorreta expondo leads de outra empresa | Espelhar exatamente a policy de `contatos` via `user_can_access_empresa` |

---

# 8. Detalhes técnicos (para revisão do time)

- `leads.empresa_id` denormalizado (copiado do contato no upsert) para RLS barata e índice curto.
- `status` como `text` no início (não `USER-DEFINED`) para não acoplar ao enum `status_lead` — evita migração de enum caso o Kanban v2 introduza colunas novas.
- Trigger também trata `UPDATE` em `contatos.responsavel_email` para manter espelho enquanto produção ainda escreve lá (fase de transição).
- Nenhum GRANT para `anon`; apenas `authenticated` e `service_role`.

---

# Entregáveis desta etapa

- 1 migração (tabela + índices + RLS + trigger + função de backfill).
- 1 RPC `get_kanban_v2`.
- Ajuste no hook `useKanbanBasico` + feature flag.
- Atualização do `README.md` do feature.
- Nota em `mem://architecture/prospeccao/` sobre a nova entidade e seu escopo restrito ao v2.
