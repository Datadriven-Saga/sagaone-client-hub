# Diagnóstico de Responsividade — SagaOne

> Diagnóstico + **plano executável em fases**. Nenhuma alteração de código feita ainda.
> Data: 2026-07-14 · Última revisão: 2026-07-14
> Escopo: Mobile (≤ 480px), Tablet (481–1024px), Desktop (≥ 1025px, incluindo ultra-wide ≥ 1920px).
> Escopo do trabalho: **apenas apresentação** (Tailwind, componentes UI, layout). Nenhuma mudança de RPC, RLS, edge function ou regra de negócio.

---

## Princípios de execução (leia antes de começar)

1. **Mobile-first e não-destrutivo.** Nenhuma fase pode regredir desktop. Mudanças em primitivos compartilhados (`Button`, `Dialog`, `Input`) entram como **variantes novas** (ex.: `size="touch"`) ou wrappers — o default só migra depois que todas as telas estiverem prontas.
2. **`overflow-x:hidden` global permanece até o fim da Fase 3.** Ele mascara bugs, mas removê-lo antes de corrigir tabelas/kanban expõe layout quebrado em produção.
3. **QA por viewport fixo:** 360, 390, 768, 1024, 1440, 1920. Playwright captura screenshots antes/depois de cada fase — a suíte é o baseline (criada na Fase 1).
4. **Ondas pequenas e mergeáveis.** Uma PR por sub-fase. Nunca abrir mais de uma onda em paralelo em Fase 3.
5. **Se algo estiver dolorido hoje, prioriza-se.** A ordem abaixo é a padrão; hotfixes de UX pontuais podem furar fila desde que caibam no princípio 1.

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

#### Fase 1 — Fundações (baixo risco · 0,5 dia · 1 PR)

Prepara tokens e primitivos sem tocar em telas existentes.

- [ ] `tailwind.config.ts`: `container.padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' }`.
- [ ] `src/index.css` `@layer components`: criar `.h1`, `.h2`, `.h3`, `.body-lg`, `.body` com `clamp()` (não substituir usos ainda, apenas disponibilizar).
- [ ] `button.tsx`: adicionar variante `size="touch"` (`h-11 w-11`). Default permanece.
- [ ] Utilitário `.touch-target` (min 44×44) para ícones em tabelas.
- [ ] Wrapper `ResponsiveDialogContent`: `w-[calc(100vw-1rem)] sm:max-w-[var(--size)] max-h-[90dvh] overflow-y-auto p-4 sm:p-6` — coexiste com `DialogContent`.
- [ ] Utilitário `.scroll-fade-x` (mask-image) para `TabsList` com overflow.
- [ ] **Baseline Playwright** em `/tmp/browser/responsivo/`: 10 rotas × 6 viewports (360/390/768/1024/1440/1920). Salvar como referência visual.

**DoD:** build passa; nenhum comportamento visual muda; suíte de screenshots gerada.

#### Fase 2 — Modais e hitboxes (risco baixo · 1 dia · 1 PR)

- [ ] Migrar para `ResponsiveDialogContent`: `CriarProspeccaoModal`, `SimulacaoEventoModal`, `SimulacaoPriWhatsAppModal`, `Templates`, `AvatarBuilder`, `ContatoRealizadoDialog`.
- [ ] Substituir `!p-0` do `CriarProspeccaoModal` por padding responsivo (`p-3 sm:p-4`) para não colar nas bordas em mobile.
- [ ] Botão fechar (X) do `Dialog`: `h-10 w-10` em mobile.
- [ ] Ícones de ação em tabelas ganham `.touch-target` só em mobile.
- [ ] Trocar `vh` → `dvh` em `max-h` de modais e telas full-screen.

**DoD:** abrir cada modal em 360, 390 e 812×375 (landscape) sem cortes; screenshots comparativos aprovados.

#### Fase 3 — Tabelas responsivas (risco médio · 3–5 dias · 4 PRs)

Objetivo: eliminar overflow horizontal **real** para permitir remoção do `overflow-x:hidden` global.

- [ ] Consolidar `<ResponsiveTable>` genérico com `columns` + `renderCard(row)`, breakpoint em `md`.
- [ ] **Onda A — Admin** (uso interno, menor risco): `admin/LogsDisparos`, `LogsCadeiras`, `Quarentena`, `Empresas`, `Acessos`, `ControleGastosLigacao`, `Webhooks`.
- [ ] **Onda B — Operacional**: `RecepcaoTable`, tabelas de `pos-vendas/*`, `Templates`, `prospeccao/EventoBase`.
- [ ] **Onda C — Restantes**: varredura das 53 telas. As que couberem naturalmente em mobile só ganham `overflow-x-auto` + `.scroll-fade-x`.
- [ ] `FilterBar` em mobile: colapsar em `Sheet` com botão "Filtros (N)".
- [ ] **Só ao fim das ondas**: remover `overflow-x:hidden` de `body`/`#root` em `src/index.css`. Rodar Playwright completo antes.

**DoD:** nenhuma rota apresenta scroll horizontal em 360/390; suíte Playwright sem regressões desktop.

#### Fase 4 — Kanban mobile e dashboards (risco médio · 2 dias · 2 PRs)

- [ ] Kanban (`KanbanBoard`/`KanbanColumn`/`KanbanCard`) em `< md`:
  - view "coluna única" com chips de status no topo (`snap-x snap-mandatory`);
  - drag-and-drop só em desktop; em mobile, ação "Mover para →" no card via menu;
  - `title` em textos truncados dos cards.
- [ ] `DashboardWhatsAppTab`: `hintLines` do card de custo empilhados verticalmente em < 360px (`text-[11px]`).
- [ ] `DashboardLayout`: `p-3 sm:p-4 lg:p-6` (em vez de `p-6` fixo).
- [ ] Grid de KPIs: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` consistente.

**DoD:** fluxo SDR completo em 390px (Kanban → abrir card → mudar status → voltar) sem scroll horizontal e sem toques errados.

#### Fase 5 — Limpeza e escala tipográfica (baixo risco · 0,5 dia · 1 PR)

- [ ] Substituir `text-3xl` fixo dos H1 de landings de módulo pela classe `.h1` (fluida, Fase 1).
- [ ] Varredura dos 212 `w-[Npx]` — priorizar os que causaram overflow real; converter para `min-w-0 flex-1` ou tokens.
- [ ] Revisar `.dark [style*="background: linear-gradient"] { opacity: 0.9 }` (efeito colateral silencioso) — restringir ou remover.
- [ ] Atualizar este documento marcando o que foi entregue.

### 4.1.1 Resumo cronograma

| Fase | Escopo | Duração | Bloqueia próxima? |
|---|---|---|---|
| 1 | Fundações (tokens, wrappers, baseline) | 0,5 dia | Não |
| 2 | Modais + hitboxes | 1 dia | Não |
| 3 | Tabelas + remoção do overflow global | 3–5 dias | **Sim** (remoção só após ondas) |
| 4 | Kanban mobile + dashboards | 2 dias | Não |
| 5 | Tipografia + limpeza de `w-[Npx]` | 0,5 dia | Não |

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

## 6. Próximos passos sugeridos (sem executar)

## 6. Ponto de partida

**Começar pela Fase 1 completa em um único passe** — é reversível, não altera nenhuma tela e destrava todas as fases seguintes:

1. Ajustar `tailwind.config.ts` (container padding).
2. Adicionar tokens tipográficos `.h1/.h2/.body` em `src/index.css`.
3. Adicionar variante `size="touch"` no `Button` e utilitário `.touch-target`.
4. Criar wrapper `ResponsiveDialogContent`.
5. Gerar suíte Playwright baseline (screenshots das 10 rotas × 6 viewports).

Ao terminar, marcar os checkboxes da Fase 1 acima e abrir a Fase 2.

### Checklist de aprovação antes de começar

- [ ] Ordem das fases aprovada?
- [ ] Alguma tela pontual precisa furar fila (hotfix)?
- [ ] OK começar direto pela Fase 1 (sem tocar em telas)?