## Objetivo
Adicionar menu "Algoritmos" na sidebar com 3 sub-grupos colapsáveis (Compra, Venda, Pós-Vendas), cada um com suas sub-páginas. Cada página renderiza um placeholder "Em construção" usando o layout atual. Acesso controlado por 3 permissões dedicadas (uma por sub-grupo) registradas no `PermissionRegistry`.

## Estrutura do menu

```text
Algoritmos (CodeMerge)                 ← canAccessAlgoritmos (OR das 3 abaixo)
├── Compra                              ← canAccessAlgoritmosCompra
│   ├── Avaliação de Compra
│   ├── Políticas de Compra
│   └── Simulação de Compra
├── Venda                               ← canAccessAlgoritmosVenda
│   ├── Atualizar Price
│   └── Histórico de Precificação
└── Pós-Vendas                          ← canAccessAlgoritmosPosVendas
    ├── Políticas Pós-Vendas
    └── Eventos Pós-Vendas
```

## Rotas

Padrão `/algoritmos/<grupo>/<item>`:

- `/algoritmos/compra/avaliacao`
- `/algoritmos/compra/politicas`
- `/algoritmos/compra/simulacao`
- `/algoritmos/venda/atualizar-price`
- `/algoritmos/venda/historico-precificacao`
- `/algoritmos/pos-vendas/politicas`
- `/algoritmos/pos-vendas/eventos`

Todas usam o mesmo componente `AlgoritmoEmConstrucao` (recebe título via prop ou lê da rota), embrulhado em `PermissionProtectedRoute` com a permissão do sub-grupo.

## Permissões (RBAC via departamento_permissoes)

Adicionar em `src/components/controle-acessos/PermissionRegistry.ts`:

- Novo módulo: `{ id: "algoritmos", label: "Algoritmos", icon: "GitMerge", description: "Algoritmos de Compra, Venda e Pós-Vendas", order: 17 }`
- 3 entries:
  - `canAccessAlgoritmosCompra` — visualizar
  - `canAccessAlgoritmosVenda` — visualizar
  - `canAccessAlgoritmosPosVendas` — visualizar
- Defaults em `getDefaultPermissions`: as 3 = `isAdmin` (admins/master por padrão; demais perfis liberados via overrides na tela de Controle de Acessos).

Não há mudanças de banco — `departamento_permissoes` já trata as novas keys dinamicamente via `resolvePermissions`.

## Página em construção

Novo componente `src/pages/algoritmos/EmConstrucao.tsx`:
- Usa `DashboardLayout` (mesmo wrapper das demais páginas)
- Card centralizado: ícone (Construction), título do item, subtítulo "Em construção", descrição curta
- Mantém tokens semânticos do design system (sem cores diretas)

## Arquivos alterados/criados

1. `src/components/controle-acessos/PermissionRegistry.ts` — novo módulo + 3 permissões + defaults
2. `src/hooks/useUserAccessType.ts` — expor `canAccessAlgoritmosCompra/Venda/PosVendas` (opcional; sidebar pode ler direto de `permissions[...]`)
3. `src/components/AppSidebar.tsx` — novo item "Algoritmos" colapsável com 3 sub-grupos aninhados (também colapsáveis); cada sub-grupo só aparece se a permissão correspondente for true; o item "Algoritmos" só aparece se pelo menos uma das 3 for true. Ícone: `GitMerge` (lucide-react)
4. `src/pages/algoritmos/EmConstrucao.tsx` — novo placeholder reutilizável
5. `src/App.tsx` — registrar as 7 rotas com `PermissionProtectedRoute permissionKey="canAccessAlgoritmos<Grupo>"` e lazy-load do `EmConstrucao`

## Notas técnicas

- A sidebar atual usa `Collapsible` para um nível. Para o segundo nível (Compra/Venda/Pós-Vendas dentro de Algoritmos) será adicionado um `Collapsible` aninhado, reaproveitando o helper `renderCollapsibleMenu` ou criando uma variante simples. Estado de cada um: `useState(currentPath.startsWith('/algoritmos/<grupo>'))`.
- Nada de RLS no banco — RBAC é client-side via `PermissionProtectedRoute`, igual aos demais menus do projeto. As páginas em construção não consultam dados.
- Master continua com tudo true (override no `useUserAccessType`).
