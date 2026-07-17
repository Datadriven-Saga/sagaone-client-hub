
# Continuação do plano de responsividade — itens pendentes

Baseado em `docs/responsividade-diagnostico.md`, os itens ainda não concluídos estão distribuídos nas Fases 2, 3, 4 e 5. Abaixo, agrupei por onda mergeável, em ordem de risco crescente.

## Onda 1 — Fase 4: Kanban mobile e KPIs (risco baixo)

1. **KanbanCard — ação "Mover" via ícone ⋮ no card (mobile only)**
   - Adicionar `IconButton` (⋮, `size="icon"` com `.touch-target`) no canto superior direito do card, visível só em `< md`.
   - Ao tocar, abre `DropdownMenu`/`Sheet` reaproveitando a lista de colunas destino já existente no fluxo "Mover lead" atual.
   - Não desativar drag-and-drop em desktop; em mobile o DnD já é impraticável e o botão passa a ser a via oficial.
2. **Tooltips nativos em texto truncado do KanbanCard**
   - Confirmar `title={item.title}` no título (o doc marca como feito, revalidar) e adicionar em `description`/`assignee` quando truncados.
3. **Grid de KPIs consistente**
   - Padronizar `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` em `DashboardWhatsAppTab` e demais dashboards com KPIs (Ligação, Resumo). Trocar `flex` + `w-[Npx]` remanescentes por grid.

## Onda 2 — Fase 3: performance de tabelas grandes + Onda C

4. **Renderização condicional via JS para tabelas volumosas**
   - Em `admin/LogsDisparos`, `admin/LogsCadeiras`, `admin/Quarentena`, `admin/Webhooks` e `RecepcaoTable`, substituir o toggle CSS (`hidden md:*`) por `useBreakpoint('md')` decidindo entre `<Table>` completa (desktop) e lista de `<Card>` (mobile). Evita reconciliar duas árvores.
   - Manter tabelas < 50 linhas com o toggle CSS atual (mais simples).
5. **Onda C — varredura das telas restantes**
   - Sweep automatizado: adicionar `overflow-x-auto` + `.scroll-fade-x` em qualquer `<Table>` ainda sem wrapper responsivo, garantindo que nenhuma rota volte a apresentar scroll horizontal na página inteira depois da remoção do `overflow-x:hidden` global.

## Onda 3 — Fase 2 tail: teclado virtual em modais longos

6. **Aplicar `useScrollIntoViewOnFocus` nos formulários longos**
   - `CriarProspeccaoModal` (campos de texto/datetime), `SimulacaoEventoModal` e `ConfiguracoesPosVendasTab`. Passar `ref` nos `Input`/`Textarea` mais baixos do body do modal, sem alterar layout.

## Onda 4 — Fase 5: cleanup, doc e audit final

7. **Última varredura de `w-[Npx]`**
   - Alvo: reduzir de ~25 para ≤ 20 ocorrências problemáticas. Focar em botões/badges que apareçam em telas < 360px; deixar `TableHead`/popovers documentados como exceção.
8. **Rodar `bun run responsivo:audit`**
   - Comparar métricas com baseline; arquivar em `docs/historico/responsividade-<data>.md`.
9. **Atualizar `docs/responsividade-diagnostico.md`**
   - Marcar checkboxes concluídos, anexar relatório final e listar exceções remanescentes.

## Fora de escopo desta execução

- Refactor de `contatos.status` (débito estrutural).
- Novas features de UX no Kanban além do botão "Mover".
- Qualquer mudança em RPC/RLS/edge functions.

## Detalhes técnicos

- Nenhum arquivo em `supabase/` será tocado.
- `KanbanBoard` já expõe `moveItem` (usado pelo fluxo atual de "Mover lead"); a Onda 1 apenas adiciona um segundo entry-point no card via ⋮ com o mesmo callback.
- Para a Onda 2, o hook `useBreakpoint('md')` já existe (`src/hooks/useBreakpoint.ts`).
- Nenhum default de primitivo shadcn muda; tudo entra como classes utilitárias ou variantes já criadas nas Fases 1–2.
- Cada onda é uma PR independente; se qualquer onda quebrar visualmente uma tela, ela é revertida sem afetar as demais.
