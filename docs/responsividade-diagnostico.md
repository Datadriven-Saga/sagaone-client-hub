# Diagnóstico de Responsividade — SagaOne

> Diagnóstico + **plano executável em fases**. Nenhuma alteração de código feita ainda.
> Data: 2026-07-14 · Última revisão: 2026-07-14 (v3 — critérios objetivos, rollback e observabilidade)
> Escopo: Mobile (≤ 480px), Tablet (481–1024px), Desktop (≥ 1025px, incluindo ultra-wide ≥ 1920px).
> Escopo do trabalho: **apenas apresentação** (Tailwind, componentes UI, layout). Nenhuma mudança de RPC, RLS, edge function ou regra de negócio.

---

## Princípios de execução (leia antes de começar)

1. **Mobile-first e não-destrutivo.** Nenhuma fase pode regredir desktop. Mudanças em primitivos compartilhados (`Button`, `Dialog`, `Input`) entram como **variantes novas** (ex.: `size="touch"`) ou wrappers — o default só migra depois que todas as telas estiverem prontas.
2. **`overflow-x:hidden` global permanece até o fim da Fase 3.** Ele mascara bugs, mas removê-lo antes de corrigir tabelas/kanban expõe layout quebrado em produção.
3. **QA por viewport fixo:** 360, 390, 768, 1024, 1440, 1920. Playwright captura screenshots antes/depois de cada fase — a suíte é o baseline (criada na Fase 1).
4. **Ondas pequenas e mergeáveis.** Uma PR por sub-fase. Nunca abrir mais de uma onda em paralelo em Fase 3.
5. **Se algo estiver dolorido hoje, prioriza-se.** A ordem abaixo é a padrão; hotfixes de UX pontuais podem furar fila desde que caibam no princípio 1.
6. **Feature flag opcional para rollback rápido.** Wrappers novos (`ResponsiveDialogContent`, `ResponsiveTable`, Kanban mobile) expõem uma prop `legacy` ou lêem `system_feature_flags` `ui_mobile_v2` — se algum cliente reportar regressão, dá para reverter apenas o comportamento sem redeploy.
7. **Priorização baseada em uso real.** Antes de cada onda, cruzar `analytics` do último mês por rota × user-agent mobile para decidir a ordem interna. Telas com < 1% de tráfego mobile ficam por último.
8. **Nada de mudança de dados/regra.** Se algum item exigir alteração em RPC/RLS/edge/webhook, sai do plano e vira ticket separado.

---

## 0. Contexto técnico

- **Stack:** React 18 + Vite + Tailwind v3 + shadcn/ui.
- **Breakpoints ativos:** padrão Tailwind (`sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1400` via `container.screens`).
- **Detecção JS:** `useIsMobile` (`< 768px`) — usado em apenas **5 arquivos** (`AppSidebar`, `sidebar.tsx`, `responsive-table.tsx`, `Clientes.tsx`, `use-mobile.tsx`).
- **Viewport meta:** ✅ presente em `index.html` (`width=device-width, initial-scale=1.0`).
- **Guarda global anti-overflow:** ✅ existe em `src/index.css` (`body`, `#root` com `overflow-x:hidden; max-width:100%`) — isso **mascara** overflows reais em vez de resolvê-los.
- **Componentes:** ~80 componentes de domínio + 53 arquivos que renderizam `<table>` ou `<Table>`.

---

## 1. Diagnóstico de quebras visuais (layout bugs)

### 1.1 Overflow horizontal

| Severidade | Local | Sintoma | Evidência |
|---|---|---|---|
| 🔴 Alta | `src/components/DashboardLayout.tsx` + páginas internas | Conteúdo estoura mas é escondido pelo `overflow-x:hidden` global em `body`/`#root` — usuário perde acesso à parte direita da UI (tabelas, filtros, KPIs). | `src/index.css` linhas do `body`/`#root` |
| 🔴 Alta | 53 telas com `<table>` (ex.: `RecepcaoTable`, `LogsDisparos`, `LogsCadeiras`, `Empresas`, `Acessos`, `ControleGastosLigacao`, `admin/Quarentena`) | Tabelas com muitas colunas expandem além do viewport mobile. Só `responsive-table.tsx` e `Clientes.tsx` têm fallback card via `useIsMobile`. | `rg -l useIsMobile` → 5 arquivos apenas |
| 🟠 Média | `CriarProspeccaoModal.tsx` | `min-w-[200px]` em `TableHead` dentro de modal já reduzido; em mobile o header rola horizontal. | linha `TableHead className="min-w-[200px]"` |
| 🟠 Média | Barras de tabs (`ControleAgentes`, `Prospeccao`, `admin/Empresas`) | Usam `overflow-x-auto` + `whitespace-nowrap`, mas sem indicador de scroll → afordância zero em mobile. | `TabsList className="flex-nowrap overflow-x-auto"` |
| 🟠 Média | `AvatarBuilder`, `Templates`, `SimulacaoEventoModal`, `SimulacaoPriWhatsAppModal` | `DialogContent` com `sm:max-w-[750px]`/`[800px]` + `max-h-[90vh]` — em telas 320–360px o modal cola nas bordas sem padding lateral. | grep `sm:max-w-[750px]` |
| 🟡 Baixa | `Login.tsx` | Rodapé fixo `hidden sm:flex fixed bottom-4 right-4 max-w-[280px]` — some no mobile, ok. Ícones SVG com `width="18"` fixos. | linhas SVG hardcoded |

### 1.2 Fixed pixel widths (não escalam)

`rg "w-\[[0-9]+px\]"` → **212 ocorrências**. Destaques problemáticos abaixo de 375px:

- `w-[200px]` em inputs de busca (`ProdutosTab`, `Templates`) — em mobile ocupam metade da tela útil.
- `w-[80px]`, `w-[100px]` em `TableHead` de `AgenteCadenciasNova` — colunas mínimas que forçam scroll horizontal na tabela mesmo quando o conteúdo caberia.
- `min-w-[160px]` em botão primário de `ContatoRealizadoDialog` — em iPhone SE (320px) esse botão + padding do modal ultrapassa a largura útil.
- `max-w-[280px]` em tooltips de `CriarProspeccaoModal` — ok, mas está no limite.

### 1.3 Elementos cortando / encavalando (< 375px)

- **Kanban (`KanbanBoard`/`KanbanColumn`/`KanbanCard`):** não tem versão mobile. Colunas lado a lado com largura mínima → scroll horizontal duplo (página + kanban) e cards com texto truncado sem `title`.
- **`FilterBar.tsx`:** 4 ocorrências de `overflow-x-auto` — múltiplos selects/inputs em linha; em mobile viram uma tira lateral inutilizável.
- **`DashboardWhatsAppTab`:** grid de KPIs recentemente aumentados; em ≤ 640px os cards empilham mas as `hintLines` de custo saem do card em telas < 340px.
- **`AppSidebar`:** usa `useIsMobile` corretamente (drawer), mas o `main` adjacente não recalcula largura quando o drawer fecha — 1 frame de overflow visível.

### 1.4 Desalinhamentos observados

- Tabs com ícone + label (`ControleAgentes`, `pos-vendas/Agendamentos`) alinham por baseline; em mobile o ícone `h-4 w-4` fica maior que o texto reduzido por `text-xs` implícito → altura irregular.
- `DateRangePicker` abre popover com `w-auto` que pode ultrapassar o viewport à direita em telas < 400px.
- `DialogContent` com `!p-0` em `CriarProspeccaoModal` faz o conteúdo colar na borda no mobile (sem `px-4` interno de compensação).

---

## 1.5 Métricas alvo (objetivas, medíveis)

O plano é considerado bem-sucedido quando **todos** os itens abaixo forem atingidos e mantidos:

| Métrica | Baseline (medir na Fase 1) | Alvo pós-Fase 5 | Como medir |
|---|---|---|---|
| Rotas com scroll horizontal em 360px | — | **0** | Playwright: `document.documentElement.scrollWidth > innerWidth` por rota |
| Rotas com scroll horizontal em 390px | — | **0** | idem |
| Elementos interativos < 44×44 px em mobile | — | **≤ 5 por rota** (só ícones em tabelas densas com `.touch-target`) | axe-core + snapshot de `getBoundingClientRect` |
| Modais com corte de conteúdo em 812×375 (landscape) | — | **0** | Playwright: `scrollHeight ≤ clientHeight` no body do dialog |
| Ocorrências de `w-[Npx]` sem `max-w`/`w-full` | 212 | **≤ 20** (exceções documentadas) | `rg "w-\[[0-9]+px\]" \| grep -v "max-w\|w-full"` |
| CLS (Cumulative Layout Shift) em rotas críticas | medir | **≤ 0,1** | Lighthouse mobile |
| INP (Interaction to Next Paint) em Kanban mobile | medir | **≤ 200ms** | Lighthouse mobile |
| Regressões visuais desktop (Playwright diff) | 0 | **0** | comparação pixel a pixel com baseline |

Essas métricas ficam num arquivo `/tmp/browser/responsivo/report.md` gerado a cada onda e comparado com o baseline.

---

## 2. Usabilidade e acessibilidade mobile (UI/UX)

### 2.1 Área mínima de toque (WCAG 2.5.5 · 44×44 · Material 48×48)

| Componente | Altura atual | Status |
|---|---|---|
| `Button` default (shadcn) | `h-10` (40px) | 🟠 abaixo do ideal, aceitável |
| `Button size="sm"` | `h-9` (36px) | 🔴 abaixo do mínimo WCAG |
| Inputs/Selects após ajuste recente (`h-8`) | 32px | 🔴 crítico — usado no `CriarProspeccaoModal` |
| Botão fechar (X) de dialogs | ~24px | 🔴 crítico |
| Ícones-only em tabelas (editar/excluir) | 32–36px | 🔴 alvos pequenos e colados |
| Tabs (`TabsTrigger`) | `h-9` | 🟠 abaixo do mínimo |
| Checkbox / Radio | 16px visual | 🔴 hitbox pequeno |

### 2.2 Espaçamento em mobile

- `DashboardLayout` aplica `p-6` fixo em várias páginas → 48px de padding horizontal em telas de 320px consome 30% da largura útil.
- Vários `space-y-6` e `gap-6` não têm variantes `sm:`/`md:` — telas pequenas ficam com respiração excessiva **vertical** e pouca **horizontal**.
- Modais recém-ajustados (`!p-0`) inverteram o problema: sem respiro nenhum em mobile.

### 2.3 Menus, modais e tabelas

- **Sidebar:** ✅ vira drawer em `< 768px` (padrão shadcn `sidebar.tsx`).
- **Modais:** ⚠️ maioria usa `sm:max-w-[Xpx]` sem `max-h`/scroll interno — em landscape mobile (ex.: 812×375) o conteúdo é cortado sem scroll.
- **Tabelas:** ⛔ **grande maioria não se adapta**. Só 2 usam `responsive-table` ou fallback `useIsMobile`.
- **Popovers / Selects longos:** sem `PopoverContent side="bottom" align="start" collisionPadding` → cortam nas bordas em mobile.

---

## 3. Consistência de Design System e responsividade

### 3.1 Tipografia

- Não há escala tipográfica responsiva (não encontrado uso de `clamp()`, `text-base md:text-lg lg:text-xl` sistemático).
- H1 fixo em `text-3xl` em todas as landings de módulo (`Index.tsx`, `Agendamentos.tsx`, `ControleAgentes.tsx`) → em 320px quebra em 3 linhas.
- Uso misto de `text-sm`, `text-xs`, `text-[15px]` (arbitrário) → inconsistência.
- `font-family` unificado (`Roboto`) ✅.

### 3.2 Uso de breakpoints

- Predominância do prefixo `sm:` e `md:`; `lg:` e `xl:` são raros. Ultra-wide (`2xl`) só aparece no `container`.
- **Sem estratégia mobile-first consistente:** vários componentes definem estilo desktop e usam `md:hidden` para esconder no mobile, em vez do inverso.
- Páginas de administração (`admin/*`) foram desenhadas para desktop e nunca receberam tratamento mobile (nem uma classe `sm:` em várias delas).
- `container` do Tailwind está com `padding: 2rem` fixo — quebra em mobile.

### 3.3 Tokens de cor / dark mode

- ✅ Overrides em `index.css` cobrem `bg-*/text-*` hardcoded de status.
- ⚠️ Regra `.dark [style*="background: linear-gradient"] { opacity: 0.9 }` afeta qualquer inline gradient — efeito colateral silencioso, não é bug de responsividade mas polui manutenção.

---

## 4. Plano de reestruturação e recomendações

### 4.1 Fases de execução

A ordem foi montada para **destravar** as fases seguintes com o menor risco possível. Cada fase tem critério de pronto (DoD) e é mergeável sozinha.

#### Fase 0 — Instrumentação (0,25 dia · 1 PR)

Pré-requisito para tudo. Sem baseline, não há como provar melhoria nem detectar regressão.

- [x] Script `scripts/responsivo/audit.ts` que roda Playwright em 6 viewports × N rotas e emite:
  - screenshot por rota+viewport;
  - `hasHorizontalScroll: boolean`;
  - contagem de elementos interativos com bounding box < 44px;
  - (axe-core opcional — não bloqueia baseline; adicionar em iteração futura).
- [x] Lista de rotas padrão (15 rotas cobrindo prospecção, recepção, resultados, pós-vendas e administração). Ajustável via `--routes=`.
- [x] Saída em `/tmp/browser/responsivo/<timestamp>/` (screenshots + `report.md` + `report.json`).
- [x] Comando `bun run responsivo:audit` documentado no `README.md`.

**DoD:** relatório baseline gerado; métricas da seção 1.5 preenchidas com números reais.

#### Fase 1 — Fundações (baixo risco · 0,5 dia · 1 PR)

Prepara tokens e primitivos sem tocar em telas existentes.

- [ ] `tailwind.config.ts`: `container.padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' }`.
- [x] `tailwind.config.ts`: `container.padding` responsivo aplicado.
- [x] **Tipografia fluida com limites seguros** em `src/index.css` `@layer components` — `.h1`, `.h2`, `.h3`, `.body-lg`, `.body` usando `clamp(min, preferred, max)`. Os `min` são ancorados no pior caso (viewport 320–360px) e os `max` evitam quebras indesejadas em ultra-wide:
  - `.h1` → `clamp(1.5rem, 1.2rem + 1.6vw, 2.25rem)` (24px → 36px)
  - `.h2` → `clamp(1.25rem, 1.05rem + 1vw, 1.75rem)` (20px → 28px)
  - `.h3` → `clamp(1.125rem, 1rem + 0.6vw, 1.375rem)` (18px → 22px)
  - `.body-lg` → `clamp(0.9375rem, 0.9rem + 0.25vw, 1.0625rem)` (15px → 17px)
  - `.body` → `clamp(0.875rem, 0.85rem + 0.15vw, 0.9375rem)` (14px → 15px)
  - Regra: nunca deixar `min` cair abaixo de 14px para body, 18px para H3, 20px para H2, 24px para H1 (garante legibilidade em 320px sem hifenização forçada).
- [x] `button.tsx`: variante `size="touch"` (`h-11 w-11 min-w-11 min-h-11`) adicionada. Default inalterado.
- [x] Utilitário `.touch-target` em `src/index.css` — pseudo-elemento `::before` de 44×44 centrado, sem alterar tamanho visual do ícone nem layout desktop.
- [x] Wrapper `ResponsiveDialogContent` em `src/components/ui/responsive-dialog.tsx` com scroll interno único, `max-h-[90dvh]`, slots `header`/`footer` opcionais e `overscroll-contain`.
- [x] Utilitário `.scroll-fade-x` (mask-image) adicionado a `src/index.css`.
- [x] Hook `useBreakpoint(bp)` em `src/hooks/useBreakpoint.ts` — fonte única de verdade via `matchMedia`.
- [x] Hook `useScrollIntoViewOnFocus()` em `src/hooks/useScrollIntoViewOnFocus.ts` — ativa em ≤ 768px, delay 300ms para o teclado virtual.

**DoD:** build passa; nenhum comportamento visual muda; `bun run responsivo:audit` continua verde (nenhuma regressão vs. baseline da Fase 0).

#### Fase 2 — Modais e hitboxes (risco baixo · 1 dia · 1 PR)

- [ ] Migrar para `ResponsiveDialogContent`: `CriarProspeccaoModal`, `SimulacaoEventoModal`, `SimulacaoPriWhatsAppModal`, `Templates`, `AvatarBuilder`, `ContatoRealizadoDialog`.
- [ ] ~~Substituir `!p-0` do `CriarProspeccaoModal` por padding responsivo~~ — **cancelado**: `!p-0` é requisito explícito do usuário (divs devem encostar nas bordas). Padding interno responsivo será resolvido dentro do body do modal, não no wrapper.
- [ ] **Formulários densos em coluna única no mobile**: no `CriarProspeccaoModal` e nas etapas de cadência/config, todos os `grid grid-cols-2` / `grid-cols-3` de campos devem colapsar para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Nada de dois inputs de datetime lado a lado em 360px — campos espremidos abaixo de ~150px viram inutilizáveis com o teclado aberto.
- [x] Botão fechar (X) do `Dialog`: `h-11 w-11` em mobile / `sm:h-8 sm:w-8` desktop (`src/components/ui/dialog.tsx`).
- [ ] Ícones de ação em tabelas ganham `.touch-target` só em mobile (via classe condicional `md:before:hidden` para não alterar layout desktop).
- [x] Trocar `vh` → `dvh` em `max-h` de modais e `calc(100vh-...)` de telas full-screen (sweep em toda a `src/`).
- [ ] **Prevenção de teclado virtual em modais longos**: qualquer input próximo ao final de um modal (últimos 30% do body) deve, ao receber foco em mobile (`window.matchMedia('(max-width: 768px)')`), executar `element.scrollIntoView({ block: 'center', behavior: 'smooth' })` **após** um `setTimeout(..., 300)` (aguardar o teclado virtual abrir). Adicionar hook utilitário `useScrollIntoViewOnFocus()` para padronizar. Também usar `visualViewport` API quando disponível para reagir a mudanças de altura do teclado. Regra: nenhum campo obrigatório pode ficar oculto atrás do teclado.

**DoD:** métrica "modais com corte em 812×375" = 0; screenshots comparativos aprovados; nenhuma regressão desktop.

#### Fase 3 — Tabelas responsivas (risco médio · 3–5 dias · 4 PRs)

Objetivo: eliminar overflow horizontal **real** para permitir remoção do `overflow-x:hidden` global.

> **Progresso base (execução do plano priorizado, sem PR por página):** o primitivo `src/components/ui/table.tsx` foi hardenizado — wrapper com `overflow-x:auto`, `role="region"` + `tabIndex=0` (WCAG 2.1.1), scroll inercial iOS, `wrapperClassName` opcional, e cells/heads com padding compacto (`p-2 sm:p-4`, `h-10 sm:h-12`). Isso propaga automaticamente para todas as ~53 telas com `<Table>` sem tocar em cada arquivo. Falta ainda a migração para `<ResponsiveTable>` por onda (Admin → Operacional → Restantes) para colapsar em cards abaixo de `md`.

> **Onda A concluída (colapso de colunas por breakpoint):** `LogsDisparos`, `LogsCadeiras`, `QuarentenaTable`, `OptOutGlobal`, `QuarentenaLogs`, `LogsNotificacoesEmailTab`, `ControleEmpresasTab`, `Agentes` (tabela principal) e `VisaoGeral` (Agentes + Cronograma) receberam `hidden {sm,md,lg,xl}:table-cell` nas colunas secundárias, mantendo identificador + status/ações sempre visíveis. `Empresas` já usava lista em cards responsiva; `Webhooks` já é grid de cards. Tsgo verde.

- [ ] Consolidar `<ResponsiveTable>` genérico com `columns` + `renderCard(row)`, breakpoint em `md`.
- [ ] **Renderização condicional via JS para tabelas volumosas** (Logs, Quarentena, Webhooks, Recepção com > 200 linhas): usar hook `useBreakpoint('md')` baseado em `window.matchMedia('(min-width: 768px)')` para renderizar **apenas** a árvore de `<table>` OU a árvore de `<Card>`, nunca as duas. Renderizar ambas com `hidden md:block` / `md:hidden` duplica o custo de reconciliação e trava o Kanban/Logs em celulares médios. Tabelas pequenas (< 50 linhas) podem manter o toggle CSS puro.
  ```tsx
  const isDesktop = useBreakpoint('md');
  return isDesktop ? <DataTable ... /> : <CardList ... />;
  ```
- [~] **Onda A — Admin** (uso interno, menor risco): `admin/LogsDisparos`, `LogsCadeiras`, `Quarentena` já com colunas secundárias `hidden md:table-cell`/`lg:table-cell`/`xl:table-cell` (só as essenciais aparecem em < md). `Webhooks` não usa `<Table>` (grid de cards, já responsivo). Falta: `Empresas`, `Acessos`, `ControleGastosLigacao`.
- [ ] **Onda B — Operacional**: `RecepcaoTable`, tabelas de `pos-vendas/*`, `Templates`, `prospeccao/EventoBase`.
- [ ] **Onda C — Restantes**: varredura das 53 telas. As que couberem naturalmente em mobile só ganham `overflow-x-auto` + `.scroll-fade-x`.
- [ ] `FilterBar` em mobile: colapsar em `Sheet` com botão "Filtros (N)". **Chips de filtros ativos fixos no topo da tabela** — ao fechar o Sheet, cada filtro aplicado (empresa, período, status, busca) aparece como `<Badge variant="secondary">` com botão `x` para remoção individual, ordenados horizontalmente com scroll horizontal se necessário. O usuário nunca precisa reabrir o Sheet para saber o que está filtrando. Adicionar botão "Limpar todos" quando houver ≥ 2 chips.
- [ ] **Só ao fim das ondas**: remover `overflow-x:hidden` de `body`/`#root` em `src/index.css`. Rodar Playwright completo antes. **Rollback:** se surgir regressão em produção, reabilitar as duas linhas via hotfix imediato — a remoção não bloqueia nada, é apenas revelação de bugs remanescentes.

**DoD:** métrica "rotas com scroll horizontal em 360/390" = 0; suíte Playwright sem regressões desktop; `overflow-x:hidden` global removido.

#### Fase 4 — Kanban mobile e dashboards (risco médio · 2 dias · 2 PRs)

- [ ] Kanban (`KanbanBoard`/`KanbanColumn`/`KanbanCard`) em `< md`:
  - view "coluna única" com `snap-x snap-mandatory` **+ indicadores persistentes de navegação**: uma **barra de abas de status fixa no topo** (sticky) mostrando todas as colunas como chips (`<TabsList>` compacta), com o chip ativo destacado, sincronizada com o scroll via `IntersectionObserver`. Clicar em um chip faz `scrollIntoView({ inline: 'start', behavior: 'smooth' })` na coluna correspondente. Adicionar também **paginação por pontos** (`•••••`) abaixo do header como reforço visual — o usuário sempre sabe onde está e quantas colunas existem.
  - drag-and-drop só em desktop; em mobile, ação **"Mover para →"** no card via **`IconButton` de três pontinhos (⋮)** posicionado no canto superior direito do card com `size="touch"` (44×44) e ícone visual `w-4 h-4`. Ao tocar, abre um `Sheet` ou `DropdownMenu` com a lista de colunas destino — reaproveita o fluxo já implementado em `KanbanCard.tsx` (Contato realizado → mover).
  - `title` em textos truncados dos cards (acessibilidade + tooltip nativo).
- [ ] `DashboardWhatsAppTab`: `hintLines` do card de custo empilhados verticalmente em < 360px (`text-[11px]`).
- [ ] `DashboardLayout`: `p-3 sm:p-4 lg:p-6` (em vez de `p-6` fixo).
- [ ] Grid de KPIs: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` consistente.

**DoD:** fluxo SDR completo em 390px validado por Playwright (Kanban → abrir card → mudar status → voltar); INP ≤ 200ms medido no Lighthouse mobile.

#### Fase 5 — Limpeza e escala tipográfica (baixo risco · 0,5 dia · 1 PR)

- [ ] Substituir `text-3xl` fixo dos H1 de landings de módulo pela classe `.h1` (fluida, Fase 1).
- [ ] **Varredura dos 212 `w-[Npx]` com estratégia combinada**: converter cada largura rígida para `w-full max-w-[Npx]` (ou `min-w-0 flex-1 max-w-[Npx]` dentro de flex containers). Isso preserva o dimensionamento ideal no desktop **e** permite encolhimento fluido no mobile sem overflow. Exceções permitidas apenas para elementos verdadeiramente fixos (avatares, ícones decorativos, sparklines).
  - Padrão de refactor:
    - `w-[200px]` (input de busca) → `w-full max-w-[200px]`
    - `w-[80px]` (TableHead) → remover ou trocar por `min-w-[80px]` (deixa expandir)
    - `min-w-[160px]` (botão em modal) → `w-full sm:w-auto sm:min-w-[160px]`
- [ ] Revisar `.dark [style*="background: linear-gradient"] { opacity: 0.9 }` (efeito colateral silencioso) — restringir ou remover.
- [ ] Atualizar este documento marcando o que foi entregue e anexar o relatório final de métricas.
- [ ] Rodar `bun run responsivo:audit` uma última vez e arquivar o relatório em `docs/historico/responsividade-<data>.md`.

### 4.1.1 Resumo cronograma

| Fase | Escopo | Duração | Bloqueia próxima? |
|---|---|---|---|
| 0 | Instrumentação (baseline + audit script) | 0,25 dia | **Sim** (todas dependem) |
| 1 | Fundações (tokens, wrappers, baseline) | 0,5 dia | Não |
| 2 | Modais + hitboxes | 1 dia | Não |
| 3 | Tabelas + remoção do overflow global | 3–5 dias | **Sim** (remoção só após ondas) |
| 4 | Kanban mobile + dashboards | 2 dias | Não |
| 5 | Tipografia + limpeza de `w-[Npx]` | 0,5 dia | Não |

**Total:** ~7,25 a 9,25 dias úteis, ~10 PRs pequenas.

### 4.2 Páginas/componentes críticos

- `src/components/KanbanBoard.tsx`, `KanbanColumn.tsx`, `KanbanCard.tsx`
- `src/components/RecepcaoTable.tsx`
- `src/components/FilterBar.tsx`
- `src/pages/admin/LogsDisparos.tsx`, `LogsCadeiras.tsx`, `Quarentena.tsx`, `Empresas.tsx`, `Acessos.tsx`, `ControleGastosLigacao.tsx`, `Webhooks.tsx`
- `src/components/CriarProspeccaoModal.tsx`
- `src/components/pos-vendas/ConfiguracoesPosVendasTab.tsx` (grid denso de config)
- `src/components/resultados/DashboardWhatsAppTab.tsx` (KPIs + hintLines em mobile)
- `src/components/DashboardLayout.tsx` (padding fixo)

### 4.3 Abordagens técnicas recomendadas

1. **Tabelas → cards em mobile:** consolidar em `<ResponsiveTable>` com prop `columns` e `renderCard`. Substituir `<table>` por esse wrapper.
2. **Layout com CSS Grid:** trocar `flex` + `w-[Npx]` de dashboards por `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4` — evita overflow e é mobile-first natural.
3. **Modais:** criar variantes `DialogContent size="sm|md|lg|full"` com regras responsivas embutidas — eliminar `sm:max-w-[Xpx]` espalhado.
4. **Kanban mobile:** usar `snap-x snap-mandatory` + navegação por chips de status; em desktop mantém multi-coluna.
5. **Tipografia fluida:** `font-size: clamp(0.9rem, 0.85rem + 0.3vw, 1rem)` para body; escala equivalente para headings.
6. **Hitbox:** ajustar `buttonVariants` — `sm: h-10`, `default: h-11`, `icon: h-11 w-11`. Ajustar close button do `Dialog` para `h-10 w-10`.
7. **Adotar `dvh` em vez de `vh`** em modais/full-screen para não quebrar com URL bar do Safari mobile.
8. **Auditoria contínua:** adicionar Playwright viewport tests (320, 375, 768, 1024, 1440, 1920) capturando screenshots por rota.

### 4.4 Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Remoção do `overflow-x:hidden` expõe overflow em tela não coberta pelo audit | Média | Alto | Fase 3 varre 100% das 53 tabelas + Playwright em todas as rotas listadas na Fase 0 antes da remoção |
| Wrapper `ResponsiveDialogContent` quebra modal customizado (ex.: `CriarProspeccaoModal` com `!p-0`) | Média | Médio | Migração modal-a-modal com screenshot antes/depois; wrapper aceita `bodyClassName` para override |
| Substituir `<table>` por `<ResponsiveTable>` em Logs de alto volume degrada performance | Baixa | Alto | Fase 3 usa renderização condicional via JS (não CSS) — Kanban/Logs testados no Lighthouse antes do merge |
| Kanban mobile com `snap-x` conflita com drag-and-drop residual | Média | Médio | DnD desativado em `< md`; testes E2E cobrem o fluxo "Mover para →" |
| Ícones com `.touch-target` capturam clique de linha adjacente da tabela | Baixa | Médio | Pseudo-elemento é `pointer-events` só no wrapper; QA em tabela densa (Logs, Empresas) |
| Regressão em cliente durante rollout | Baixa | Alto | Feature flag `ui_mobile_v2` (princípio 6) permite reverter comportamento por empresa |

### 4.5 Fora de escopo (backlog separado)

- Redesenho do fluxo de check-in da Recepção (é UX, não responsividade).
- PWA / instalação offline.
- Refatoração de `contatos.status` global (débito estrutural — não é responsividade).
- Mudanças em RPC/RLS/edge functions.
- Internacionalização (i18n) de labels que quebram em outros idiomas.

---

## 5. Resumo executivo do risco

| Categoria | Estado atual | Risco de negócio |
|---|---|---|
| Overflow horizontal | Mascarado por CSS global | 🔴 Alto — usuário mobile perde funcionalidades |
| Tabelas em mobile | 51/53 não adaptadas | 🔴 Alto — operação (Recepção, Logs, Admin) inviável em celular |
| Kanban em mobile | Não adaptado | 🔴 Alto — fluxo principal do SDR |
| Hitbox / WCAG | Múltiplos alvos < 44px | 🟠 Médio — acessibilidade + erros de toque |
| Modais em mobile | Padrão inconsistente | 🟠 Médio — cortes em landscape |
| Tipografia responsiva | Ausente | 🟠 Médio — quebras de H1 em telas pequenas |
| Dark mode | ✅ Coberto | 🟢 Baixo |
| Sidebar / drawer | ✅ Funcional | 🟢 Baixo |

---

## 6. Ponto de partida

**Começar pela Fase 0 (instrumentação) + Fase 1 (fundações) no mesmo dia** — juntas são reversíveis, não alteram nenhuma tela e destravam todas as fases seguintes:

1. **Fase 0:** script `bun run responsivo:audit`, baseline em `/tmp/browser/responsivo/`, relatório de métricas preenchido.
2. **Fase 1:**
   - Ajustar `tailwind.config.ts` (container padding).
   - Adicionar tokens tipográficos `.h1/.h2/.body` em `src/index.css`.
   - Adicionar variante `size="touch"` no `Button` e utilitário `.touch-target`.
   - Criar wrapper `ResponsiveDialogContent`.
   - Criar hooks `useBreakpoint` e `useScrollIntoViewOnFocus`.
3. Rodar `responsivo:audit` novamente e confirmar 0 regressões.

Ao terminar, marcar os checkboxes das Fases 0 e 1 acima e abrir a Fase 2.

### Checklist de aprovação antes de começar

- [ ] Ordem das fases aprovada?
- [ ] Alguma tela pontual precisa furar fila (hotfix)?
- [ ] OK começar direto pelas Fases 0 + 1 (sem tocar em telas)?
- [ ] Métricas da seção 1.5 são as certas para "concluído"?
- [ ] Usar feature flag `ui_mobile_v2` para rollback ou dispensável?