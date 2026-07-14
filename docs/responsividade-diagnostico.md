# Diagnóstico de Responsividade — SagaOne

> Documento de diagnóstico apenas. **Nenhuma alteração foi feita em código ou estilos.**
> Data: 2026-07-14 · Escopo: Mobile (≤ 480px), Tablet (481–1024px), Desktop (≥ 1025px, incluindo ultra-wide ≥ 1920px).

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

### 4.1 Prioridades (ordem sugerida)

| # | Alvo | Motivo | Esforço |
|---|---|---|---|
| 1 | Remover `overflow-x:hidden` global de `body`/`#root` **após** corrigir estouros reais | O hide global esconde bugs e impede diagnóstico. | M |
| 2 | Padronizar tabelas via `responsive-table` (card em mobile) | 53 telas afetadas. Impacto direto na Recepção, Logs, Admin, Prospecção. | G |
| 3 | Kanban mobile (view "coluna atual + swipe") | Kanban é fluxo principal e hoje é inutilizável em mobile. | G |
| 4 | Aumentar hitboxes para 44px+ em Buttons `sm`, X de dialog, ações em tabela | WCAG. Correção transversal via variants do `button.tsx` e `dialog.tsx`. | P |
| 5 | Modais: padrão `w-[calc(100vw-2rem)] sm:max-w-[Xpx] max-h-[90dvh] overflow-y-auto` + `p-4 sm:p-6` | Corrige colagem nas bordas e cortes em landscape. | P |
| 6 | Escala tipográfica responsiva | Criar `.h1/.h2/.body` no `@layer components` com `clamp()`. | P |
| 7 | `container` Tailwind: `padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' }` | Reduz sufocamento em mobile. | XS |
| 8 | Migrar `w-[Npx]` → tokens Tailwind ou `min-w-0 flex-1` em contextos flex | 212 ocorrências. Fazer por página. | M |
| 9 | Adicionar indicadores de scroll nas `TabsList overflow-x-auto` (fade lateral) | Afordância. | XS |

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

1. Aprovar priorização da seção 4.1.
2. Criar branch `chore/responsividade-fase-1` para itens 1, 4, 5, 7, 9 (baixo risco, ganho imediato).
3. Planejar migração de tabelas (item 2) e Kanban mobile (item 3) como épicos separados com QA visual dedicado por breakpoint.
4. Ativar suíte Playwright multi-viewport antes de refatorar, para ter baseline visual.