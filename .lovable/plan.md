
# Plano — 3 fases, sem quebrar prod

## Fase 1 — Corrigir `auto_atribuir_leads_vendedor` (estanca o sangramento)

**Migração única** que reescreve a função para:

1. Materializar `leads_disponiveis` com **`(contato_id, prospeccao_id)`** — evento em que o SDR está pegando o lead fica explícito.
2. `PERFORM set_config('app.status_change_logged','true', true);` antes do `UPDATE contatos` → suprime `trg_log_contato_status` e evita o fallback que grava no evento errado.
3. Após o `UPDATE`, `INSERT` explícito em `logs_movimentacao_contatos` (um por par contato+evento) com:
   - `status_anterior = 'Novo'`, `status_novo = 'Atribuído'`
   - `prospeccao_id` = evento correto do SDR
   - `usuario_id = user_id_param`
   - `observacoes = 'auto-atribuição SDR/Vendedor'`
4. Manter comportamento externo: mesma assinatura `(user_id_param uuid)`, mesmo retorno `integer` (nº atribuído), mesmo limite de 30, mesmas regras de filtro (canal `Grande Evento`/`Mensal`, membership em `prospeccao_equipe_membros`, `get_contato_status_por_evento = 'Novo'`).

**O que NÃO alterar:** `count_vendedor_leads_pendentes`, `vendedor_precisa_leads`, `mutate_contato_status_atomic`, RLS de `contatos`, hook `useAutoAtribuirLeads`.

**Rollback:** re-aplicar a definição atual (guardada como snapshot na descrição da migration).

**Testes obrigatórios (rodo antes de responder):**
- SDR pede leads em evento A → todos os logs novos são em A, evento B intocado.
- Contador dos 30 continua respeitando (comparar `count_vendedor_leads_pendentes` antes/depois).
- Zero novos logs `auto-trigger (fallback de migracao)` gerados pela chamada.
- Amostra de 3 SDRs reais (Ketley + 2 outros com divergência global/evento) — confirmar que ficam com N leads visíveis no Kanban do evento pedido.

---

## Fase 2 — Destravar "Mover lead" para SDR/terceiros (menor risco)

**Escolha:** promover `mutate_contato_status_atomic` para **`SECURITY DEFINER` com validação interna** (opção 2b do diagnóstico). É a alternativa que não mexe em RLS global de `contatos` (evita efeito colateral em importador, edges, pri.ia) e resolve o bloqueio para SDR/terceiros vindos de `user_empresas`.

**Migração única:**

1. `ALTER FUNCTION public.mutate_contato_status_atomic(...) SECURITY DEFINER`.
2. `SET search_path = public` (já tem).
3. No início da função, **validar autorização** — bloqueia se falhar:
   - `p_usuario` deve ser `auth.uid()` ou o caller deve ter role admin/TI/master.
   - Buscar `empresa_id` do contato e exigir `public.user_can_access_empresa(empresa_id, auth.uid()) = true`.
   - Se `p_prospeccao IS NOT NULL`, exigir uma de: responsável pelo contato (email match), membro de `prospeccao_equipe_membros` do evento, ou admin/TI/master.
   - Falhar com `RAISE EXCEPTION 'sem permissão'` + `ERRCODE 42501` para o FE tratar.
4. Manter o resto igual (flag `app.status_change_logged`, INSERT em `logs_movimentacao_contatos`, RETURN).
5. `GRANT EXECUTE` já existe para `authenticated, service_role`.

**Compatibilidade:**
- Admin/TI/master: já passavam por RLS, continuam passando pela validação interna (bypass explícito).
- SDR/terceiros com equipe: hoje falham silenciosamente na RLS de UPDATE → agora passam pela validação interna e conseguem mover.
- Callers automatizados (edges `prospeccao-status`, `confirm-presence`) usam service_role → passam.
- pri.ia: continua funcionando (usa service_role).

**O que NÃO alterar:** políticas RLS de `contatos`, edge `prospeccao-status` (assinatura da RPC não muda), FE (`atualizarStatusContato`, `KanbanCard.onMoveItem`), trigger `trg_dispatch_movimentacao_lead_webhook`.

**Rollback:** `ALTER FUNCTION ... SECURITY INVOKER` + remover bloco de validação.

**Testes obrigatórios:**
- SDR membro da equipe move lead do Kanban → 200 OK, log gravado no evento correto, 1 webhook `movimentacao_lead_kanban`.
- SDR **não** membro tenta mover lead do mesmo evento → 403 (`ERRCODE 42501`), sem UPDATE, sem log.
- Admin move em qualquer empresa acessível → OK.
- Terceiro (external seat) com equipe → OK.
- Edge `confirm-presence` (checkin recepção) → continua funcionando via service_role.

---

## Fase 3 — Neutralizar logs `auto-trigger` sem apagar dados

Objetivo do usuário: **preservar histórico**, desde que não afete fluxo padrão.

Os logs `auto-trigger (fallback de migracao)` afetam o fluxo em **um** ponto: `get_contato_status_por_evento` pega o log mais recente com `status_novo IS NOT NULL` — se o log espúrio for o mais recente, ele "vira" o status por-evento e polui o Kanban.

**Migração única — patch cirúrgico em `get_contato_status_por_evento`:**

```sql
CREATE OR REPLACE FUNCTION public.get_contato_status_por_evento(
  p_contato_id uuid, p_prospeccao_id uuid
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    (SELECT lm.status_novo
       FROM public.logs_movimentacao_contatos lm
      WHERE lm.contato_id = p_contato_id
        AND lm.prospeccao_id = p_prospeccao_id
        AND lm.status_novo IS NOT NULL
        AND COALESCE(lm.observacoes,'') NOT ILIKE 'auto-trigger%'
        AND COALESCE(lm.observacoes,'') NOT ILIKE '%fallback de migracao%'
      ORDER BY lm.data_movimentacao DESC
      LIMIT 1),
    (SELECT c.status::text FROM public.contatos c WHERE c.id = p_contato_id),
    'Novo'
  );
$$;
```

**Efeito:**
- Kanban por-evento passa a ignorar logs espúrios — status volta ao que era antes do trigger errado.
- Logs continuam intactos em `logs_movimentacao_contatos` (auditoria preservada).
- Timeline já filtra esses logs (`get_contato_timeline` — feito na Fase A anterior).
- Fluxo padrão (novo log real do SDR/vendedor via Fase 1/2) tem `observacoes` legítimo → aparece normalmente.

**O que NÃO alterar:** `logs_movimentacao_contatos` (nenhum DELETE/UPDATE), `mutate_contato_status_atomic`, RLS.

**Rollback:** recriar a função sem os dois `NOT ILIKE`.

**Testes obrigatórios:**
- Lead do JEEP T9 com log espúrio "auto-trigger → Atribuído" hoje → após deploy, `get_contato_status_por_evento` retorna o status anterior (o correto).
- Lead com log real do SDR (Fase 1 aplicada) → retorna o status correto do log real.
- Lead sem logs no evento → fallback para `contatos.status` (mantido).

---

## Ordem de execução

```text
1. Fase 1 — migration auto_atribuir_leads_vendedor
2. Validar (3 SDRs reais, sem novos auto-trigger)
3. Fase 2 — migration mutate_contato_status_atomic
4. Validar (Ketley move lead OK, não-membro bloqueado)
5. Fase 3 — migration get_contato_status_por_evento
6. Validar (Kanban do JEEP T9 volta aos status reais)
7. Report antes/depois: divergência global × por-evento nos eventos ativos
```

Zero mudanças em FE. Zero DELETE em tabelas. Cada fase é revertível isoladamente com uma migration.
