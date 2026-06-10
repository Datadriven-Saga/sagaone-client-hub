## Reestruturar menu Pós-Vendas

Transformar o item "Pós-Vendas" da sidebar em um dropdown (igual Prospecção/Algoritmos), com 4 grupos. Cada sub-item leva a uma tela própria, eliminando o sistema atual de abas em `/pos-vendas/:tab`.

### Estrutura final do menu

```text
Pós-Vendas ▾
├── Peças ▸
│     ├── Gatilhos          → /pos-vendas/pecas/gatilhos
│     └── Lojas             → /pos-vendas/pecas/lojas
├── Entregas ▸
│     ├── Gatilhos Saga Conecta → /pos-vendas/entregas/gatilhos
│     └── Lojas Saga Conecta    → /pos-vendas/entregas/lojas
├── Agendamentos            → /pos-vendas/agendamentos
└── Paty Geral ▸
      ├── Templates         → /pos-vendas/paty/templates
      └── Cadência Conversacional → /pos-vendas/paty/cadencia
```

A rota antiga `/pos-vendas` e `/pos-vendas/:tab` redireciona para `/pos-vendas/pecas/gatilhos` (primeiro item).

### Mudanças

**`src/components/AppSidebar.tsx`**
- Remover o item flat de Pós-Vendas (linhas 340–360).
- Adicionar bloco `Collapsible` nível 1 ("Pós-Vendas", ícone `PackageCheck`) contendo:
  - 3 chamadas a `renderAlgGroup` (Peças, Entregas, Paty Geral) para grupos com sub-itens (nível 2 já existente).
  - 1 item simples direto (Agendamentos, ícone `Calendar`).
- Adicionar states: `isPosVendasOpen`, `isPosPecasOpen`, `isPosEntregasOpen`, `isPosPatyOpen` inicializados pelo `currentPath.startsWith(...)` correspondente.

**Roteamento (`src/App.tsx`)**
- Trocar rotas antigas `/pos-vendas` e `/pos-vendas/:tab` por 7 rotas dedicadas:
  - `/pos-vendas` → `<Navigate to="/pos-vendas/pecas/gatilhos" replace />`
  - `/pos-vendas/pecas/gatilhos` → nova página
  - `/pos-vendas/pecas/lojas` → nova página
  - `/pos-vendas/entregas/gatilhos` → nova página
  - `/pos-vendas/entregas/lojas` → nova página
  - `/pos-vendas/agendamentos` → nova página
  - `/pos-vendas/paty/templates` → nova página (envolve `TemplatesPaty`)
  - `/pos-vendas/paty/cadencia` → nova página
- Manter o mesmo guard usado hoje no `/pos-vendas`.

**Novas páginas em `src/pages/pos-vendas/`** (wrappers finos que envelopam o componente existente no `DashboardLayout` com título e breadcrumb apropriado, sem alterar a lógica de cada tab):
- `PecasGatilhos.tsx` → usa `PecasTemplatesSection`
- `PecasLojas.tsx` → usa `PecasLojasSection`
- `EntregasGatilhos.tsx` → usa `EntregasTab`
- `EntregasLojas.tsx` → usa `LojasTab`
- `Agendamentos.tsx` → usa `AgendamentosTab`
- `PatyTemplates.tsx` → usa o conteúdo do `TemplatesPaty` atual
- `PatyCadencia.tsx` → usa `CadenciaConversacionalTab`

**`src/pages/pos-vendas/PosVendas.tsx`**
- Deletar (substituído pelas rotas dedicadas + redirect).

### Detalhes técnicos

- Nenhuma alteração na lógica de negócio dos componentes (`EntregasTab`, `LojasTab`, `PecasTemplatesSection`, `PecasLojasSection`, `AgendamentosTab`, `CadenciaConversacionalTab`, `TemplatesPaty`). Mudança é puramente de navegação e enquadramento.
- O componente `EntregasTab` (gatilhos Saga Conecta) e `LojasTab` (lojas Saga Conecta) ganham títulos novos nas páginas wrappers para refletir o rótulo "Saga Conecta" do menu.
- Permissão `canSeePosVendas` continua controlando a visibilidade do grupo raiz.
- Padrão visual segue exatamente o nível-2 já usado em Algoritmos (`renderAlgGroup`), garantindo consistência.

### Riscos

- Bookmarks antigos para `/pos-vendas/entregas`, `/pos-vendas/templates` etc. deixam de funcionar — mitigado pelo redirect raiz (porém sub-rotas antigas com `:tab` cairão no 404). Posso adicionar redirects 1:1 por tab antiga se desejar.
