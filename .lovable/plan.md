# Plano — Histórico limpo + Ketley enxergando leads

Dois pontos, tratados em fronts independentes. Nada será alterado antes de aprovação e cada front tem dry-run.

---

## Cenário atual (auditado agora)

Logs artificiais criados hoje em `logs_movimentacao_contatos` com `usuario_id = NULL`:

```text
75.174  Reset de herança — lead sem histórico neste evento
20.776  Correção automática — desfaz reset indevido para Novo mantendo responsável atual
 1.436  Reset de herança T7 — lead sem histórico neste evento
 1.381  Correção automática — desfaz reset T7 indevido para Novo mantendo responsável atual
    83  auto-trigger (fallback de migracao)
```

Esses registros são a fonte de duas dores:
- Poluem a **timeline** do lead ("Alterado pelo sistema").
- Servem, ao mesmo tempo, de **fonte de verdade** do status por evento hoje (a "Correção automática" é o que segura os leads em Atribuído/Em Espera/etc.). Portanto **não podemos apagar do `logs_movimentacao_contatos`** — apagar volta tudo para "Novo".

Sobre Ketley (`ketley.d1de4a79@...`): perfil ativo, cadeira ativa, membro da equipe do evento Colorado, 15 leads em "Novo" **por evento**. Não vê porque `get_kanban_columns_limited` (usado pelo SDR) filtra por `contatos.status` global — os 15 leads têm status global diferente de "Novo" (herdado de outro evento). O Admin já usa status por evento (`get_contato_status_por_evento`) e enxerga.

---

## Front A — Histórico sem "Alterado pelo sistema"

**Objetivo:** o usuário nunca mais vê linhas de sistema na timeline do lead, sem perder o efeito do status por evento.

**Estratégia (não destrutiva):** manter `logs_movimentacao_contatos` intacto. Atuar em duas camadas:

1. **RPC `get_contato_timeline`** — adicionar filtro que oculta eventos de sistema:
   ```sql
   WHERE contato_id = p_contato_id
     AND NOT (
       tipo = 'status_change'
       AND (usuario_id IS NULL OR usuario_nome ILIKE 'Sistema%')
       AND (
         descricao ILIKE '%Reset de herança%'
         OR descricao ILIKE '%Correção automática%'
         OR descricao ILIKE '%auto-trigger%'
       )
     )
   ```
   Efeito imediato em toda UI que consome a timeline (`ContatoTimeline.tsx`). Sem migração de dados.

2. **Limpeza cosmética em `contato_timeline`** (opcional, roda depois de validar) — `DELETE` só das linhas do dia 2026-07-20 que casam com o mesmo predicado acima. Reduz o tamanho da tabela. Backup em CSV antes.

**O que NÃO muda:**
- `logs_movimentacao_contatos` (mantém a "Correção automática" — é ela que sustenta o status por evento hoje).
- `contatos.status`, `responsavel_email`, kanban, webhooks, importador, cadência.

**Dry-run antes de aplicar:**
- Contar quantas linhas por lead ficariam ocultas (esperado: ~1 linha "reset" + ~1 "correção" para ~20k leads).
- Amostrar 5 leads reais e mostrar a timeline "antes/depois".

---

## Front B — Ketley (e outros SDRs de terceiros) enxergarem os leads

**Objetivo:** SDR passa a ver as colunas do Kanban usando **status por evento**, alinhado ao Admin. Sem afetar visibilidade entre equipes, sem afetar Admin, sem tocar dados.

**Alteração única — `public.get_kanban_columns_limited`:**
- Trocar `c.status` global pela função `public.get_contato_status_por_evento(c.id, p.id)` nas 10 colunas.
- Manter TODOS os demais filtros como estão hoje:
  - filtro por `prospeccaoIds` (obrigatório — mantém proteção contra 57014),
  - filtro por equipe (`prospeccao_equipe_membros`) — SDR continua vendo só sua equipe,
  - filtros de responsável, busca, datas, `tentativas_chamada`.
- Assinatura preservada (mesmo nome, mesmos parâmetros) — nenhum call site muda.

**Por que é seguro:**
- Read-only: função `STABLE`, não escreve nada.
- Mesma lógica que o Admin já usa há semanas em produção.
- Sem exposição cruzada: o filtro de equipe é aplicado antes do status.
- Reversível em segundos (basta recriar a versão anterior).

**Dry-run antes de aplicar:**
1. Executar as duas versões (atual vs. proposta) em paralelo para a `empresa_id` da Ketley + evento Colorado e comparar contagens por coluna.
2. Repetir para 3 SDRs de outras empresas (amostragem cega) para garantir que a contagem só **sobe** onde havia lead escondido — nunca inventa lead fora da equipe.
3. Só então aplicar via `supabase--migration`.

---

## Ordem de execução

```text
1. Front A passo 1  (RPC get_contato_timeline)   — migração pequena, efeito UI imediato
2. Front B          (RPC get_kanban_columns_limited) — migração pequena, destrava Ketley
3. Front A passo 2  (limpeza cosmética em contato_timeline) — opcional, roda depois de 24h
```

Cada passo entra em migração separada, com rollback documentado no próprio arquivo.

## Critério de sucesso

```text
- Timeline do lead não mostra mais linhas "Reset de herança" ou "Correção automática"
- Ketley e demais SDRs veem os leads que já estão nas equipes deles, coluna Novo por evento
- Contagens do Admin permanecem idênticas
- Nenhuma mudança em contatos, responsáveis, webhooks, cadências ou importador
- Rollback em <2 min por front (recriar RPC anterior)
```

## Próximo passo se aprovar

Rodo os dois dry-runs (A e B), colo os números aqui e só depois abro as migrações.
