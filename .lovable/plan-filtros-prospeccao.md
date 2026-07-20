# Plano: Filtros de Prospecção (Desktop + Mobile)

Arquivo alvo: `src/components/ProspeccaoGlobalFilter.tsx` (usado em `/prospeccao/eventos` e telas correlatas).

## Diagnóstico atual

Hoje o popover de "Filtros" empilha 7 grupos num único painel de 480px (desktop) ou `100vw-1rem` (mobile), com scroll interno. Problemas observados nas capturas (image-881 e image-882):

- Painel muito longo — usuário precisa rolar para achar "Temperatura" / "Mostrar encerrados".
- Duas listas grandes (Eventos e Vendedores) ocupam ~50% da altura cada uma, sem forma de recolher.
- Grupos de importância desigual têm o mesmo peso visual (Status = 1 select simples ocupa mesma linha que datas).
- No mobile o popover cobre metade da tela e ainda exige scroll dentro de scroll (lista dentro do popover dentro da página).
- Filtro "Dados do Lead" duplica a barra de busca principal.
- Não há indicação de quais grupos têm filtro aplicado quando o painel está fechado além do contador total.

## Objetivos

1. Reduzir a altura visual do painel usando seções colapsáveis (accordion).
2. Reorganizar por frequência de uso (Eventos e Status primeiro; Temperatura, Datas e "encerrados" recolhidos por padrão).
3. Eliminar redundância (remover "Dados do Lead" de dentro do painel — já existe a busca principal).
4. Padrão mobile próprio via `Sheet` inferior fullscreen (reaproveita `MobileFiltersSheet`).
5. Sinalizar por seção quantos filtros estão ativos (badge no header do accordion).

## Estrutura proposta do painel

```
Filtros                           Limpar todos · X
  [Eventos v]         (2)   <- aberto por padrao
    busca | Todos/Limpar | lista checkbox (max-h 200px)

  [Status v]          (1)   <- aberto por padrao
    Select

  [Vendedor/Responsavel v]  (0)   <- fechado
  [Periodo v]               (0)   <- fechado (Data inicio + Data fim, 2 cols)
  [Temperatura v]           (0)   <- fechado (chips)
  [Preferencias v]          (0)   <- fechado (toggle Mostrar encerrados)
```

Regras:
- Um grupo abre automaticamente se tiver filtro aplicado.
- Contador `(n)` ao lado do titulo do grupo.
- "Dados do Lead" do painel e removido (a barra externa ja cobre esse caso).
- Botao "Limpar todos" fica no header do popover.

## Desktop

- Popover mantem `w-[480px]`, `align="start"`.
- Substituir o `grid grid-cols-2` por `Accordion type="multiple"` (shadcn), com `defaultValue` = grupos com filtro aplicado + `["eventos","status"]`.
- Header de cada `AccordionItem` mostra: titulo + badge count + botao "Limpar" (so quando `n > 0`, `stopPropagation`).
- Reduz altura visivel de ~720px para ~360px quando so Eventos/Status estao abertos.

## Mobile

- Substituir `PopoverContent` por `Sheet side="bottom"` quando `useIsMobile()` for `true`.
- Sheet ocupa `h-[90dvh]` com header fixo (titulo + Limpar + X), corpo scrollavel e footer fixo com "Aplicar" e "Cancelar".
- Em mobile, aplicar so emite `onFiltersChange` ao clicar "Aplicar" (draft interno), evitando reload do Kanban a cada checkbox.
- Chips de filtros ativos abaixo da barra de busca continuam visiveis, com `x` individual.

## Chips de filtros ativos

Ja existem via `getActiveFilters()`. Ajustes:
- Mostrar sempre na linha logo abaixo da barra (sem duplicar "Dados do Lead").
- Em mobile, tornar horizontalmente rolaveis (`overflow-x-auto whitespace-nowrap`).
- Botao "Limpar todos" so aparece quando `activeFilters.length > 1`.

## Detalhes tecnicos

1. Novo hook interno `useAppliedFiltersDraft(filters)` para o modo mobile (aplicar/cancelar).
2. Reaproveitar `Accordion` de `@/components/ui/accordion`.
3. `useIsMobile()` ja disponivel; escolher `Popover` vs `Sheet`.
4. Manter a API publica (`ProspeccaoGlobalFilterProps`) intacta.
5. Remover o campo "Dados do Lead" duplicado dentro do painel; `showSearchBar` continua governando a busca externa.
6. Guardar `openSections` em `useState` derivado dos filtros aplicados na abertura.

## Fora do escopo

- Estrutura do estado `ProspeccaoGlobalFilters` (mantida).
- Regras de RLS/RPC do Kanban.
- Layout da barra superior de Prospeccao (`Prospeccao.tsx`).

## Verificacao

- `bun run build` sem erros.
- Playwright headless: abrir `/prospeccao/eventos` em 390px e 1280px, capturar painel aberto/fechado.
- Regressao manual: filtrar por evento unico, multi-eventos, periodo, temperatura, limpar todos.
