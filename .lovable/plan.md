## Plano: Campo `agente_ia` + correção Pri + retroativo

### Parte 1 — Schema (migration)
- `ALTER TABLE contatos ADD COLUMN IF NOT EXISTS agente_ia TEXT[] DEFAULT '{}'`
- Índice GIN `idx_contatos_agente_ia`
- Função `add_agente_ia(p_contato_id UUID, p_agente TEXT)` SECURITY DEFINER, idempotente
- **Pré-execução:** validar schema de `contatos` via `supabase--read_query`

### Parte 2 — `supabase/functions/prospeccao-status/index.ts`
Substituir o bloco "Atribuir responsável Pri IA" por:
```ts
if (isAdminToken && PRI_IA_USER_ID) {
  await supabaseClient.rpc('add_agente_ia', { p_contato_id: contato.id, p_agente: 'pri' });
}
```
- Pri deixa de tocar em `responsavel_email`/`vendedor_nome`
- Log de movimentação continua com `usuario_id = PRI_IA_USER_ID`

### Parte 3 — Encerrar evento "NÃO USAR" (`aab16a3b...`)
- Dry-run SELECT
- `UPDATE prospeccoes SET data_fim = now() - interval '1 day'`
- `SELECT encerrar_eventos_finalizados();`
- Validar `snapshot_realizado = true`
- **NÃO tocar em cf0f2db2**

### Parte 4 — Retroativo
**4.1** Dry-run: contar leads que a Pri tocou em dba30612 e cf0f2db2

**4.2** Carimbar `agente_ia` com `'pri'` nos leads tocados pela Pri nos **dois** eventos (apenas adiciona ao array; status preservado)

**4.3** Limpar responsável da Pri APENAS em dba30612, em **todos os leads sem exceção de status**:
```sql
-- Dry-run agregando por status (apenas para visibilidade, não filtra)
SELECT c.status::text, count(*)
FROM contatos c
JOIN eventos_prospeccao ep ON ep.contato_id = c.id
WHERE ep.prospeccao_id = 'dba30612-...'
  AND c.responsavel_email = 'pri.ia@sagadatadriven.com.br'
GROUP BY 1;

-- Aplicar (todos os status)
UPDATE contatos c
SET responsavel_email = NULL, vendedor_nome = NULL, updated_at = now()
FROM eventos_prospeccao ep
WHERE ep.contato_id = c.id
  AND ep.prospeccao_id = 'dba30612-...'
  AND c.responsavel_email = 'pri.ia@sagadatadriven.com.br';
```
- **Nenhum status é alterado**, em nenhum caso
- Leads `Novo` → entram na distribuição automática das prospectoras (evento de ligação)
- Leads em status avançado (Convidado, Confirmado, etc.) → ficam sem responsável; gestora de leads atribui manualmente depois
- **NÃO tocar em cf0f2db2** (Pri trabalha lá)

**4.4** Validação final agregada por status + situação responsável + agente

### Parte 5 — Filtro Kanban
- Investigar RPCs `get_kanban_columns` / `get_contatos_paginated` e localizar token `__pri_ia__`
- Trocar critério: `responsavel_email = 'pri.ia@...'` → `'pri' = ANY(c.agente_ia)`
- Frontend: rótulo "Pri IA (atuou)"; "Sem responsável" continua `IS NULL`
- Validar que `auto_atribuir_leads_vendedor` distribui leads `Novo` sem responsável (incluindo os recém-liberados) e não consulta `agente_ia`

### Parte 6 — Histórico (`contato_timeline`)
- Validar tipos permitidos em `contato_timeline.tipo`
- Modificar `add_agente_ia` para retornar boolean (true se adicionou)
- Edge function: se true, INSERT em `contato_timeline` (tipo `agente_ia_atribuido` ou tipo existente compatível)
- Mudanças de responsável humano continuam logadas pelo mecanismo atual

### Parte 7 — Dashboards performance
- Param opcional `p_agente_ia TEXT DEFAULT NULL` em `get_resumo_stats`, `get_ranking_vendedores`, `get_desempenho_vendedores`
- Filtro: `(p_agente_ia IS NULL OR p_agente_ia = ANY(c.agente_ia))`
- **Sem overload** — `CREATE OR REPLACE` mantendo assinatura única
- Frontend `Resultados.tsx`/`Relatorios.tsx`: dropdown "Agente IA: Todos / Pri"

### Ordem de execução
1. Migration Parte 1
2. Edge function Parte 2 (auto-deploy)
3. Teste manual via admin-token
4. Parte 3 (encerrar NÃO USAR)
5. Parte 4.2 (carimbar — ambos eventos)
6. Parte 4.3 (dry-run + limpar responsável em todos os leads dba30612)
7. Parte 5 (filtro Kanban)
8. Parte 6 (timeline)
9. Parte 7 (RPCs + frontend dashboards)

### Regras obrigatórias
- Antes de cada migration/CREATE OR REPLACE: consultar schema real
- Operações de dados via insert tool, não migration
- Dry-run obrigatório em 3, 4.2 e 4.3
- cf0f2db2 nunca tem responsável limpo
- **Status nunca é alterado** em nenhum lead, em nenhuma etapa do retroativo

### Riscos
- `contato_timeline.tipo` pode rejeitar novo valor — fallback: tipo existente genérico
- Mecanismo do filtro `__pri_ia__` no Kanban precisa ser confirmado no banco antes de alterar
- Leads avançados ficam órfãos de responsável até gestora reatribuir manualmente (comportamento desejado)
