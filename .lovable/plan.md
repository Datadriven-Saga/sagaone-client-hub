## Objetivo

Criar a página inicial do **Entra Dados** em `/entra-dados`, que servirá como hub para visualizar todas as bases, tabelas e de-paras mantidos pelo módulo. Nesta etapa, apenas o **visual** (mock de dados), sem backend nem novas tabelas.

Convenção definida: futuras tabelas exclusivas do módulo terão prefixo **`enda_`** (ex.: `enda_bases`, `enda_tabelas`). Nada será criado agora.

---

## 1. Rota e navegação

- Nova rota `/entra-dados` em `src/App.tsx`, apontando para `src/pages/EntraDados.tsx`.
- Em `src/components/AppSidebar.tsx`:
  - Adicionar o item **Visão Geral** (`/entra-dados`, ícone `LayoutDashboard`) como primeiro subitem do grupo "Entra Dados", antes do **De-Para**.
  - Manter o grupo abrindo automaticamente nas rotas `/entra-dados` ou `/de-para` (já implementado).

---

## 2. Tela `EntraDados.tsx`

Layout simples, alinhado ao padrão visual do projeto (mesmos `Card`, `Badge`, espaçamento das outras páginas como `DePara.tsx`).

```text
+--------------------------------------------------------+
| Entra Dados                       [+ Nova base]        |
| Hub de bases, tabelas e de-paras do time               |
+--------------------------------------------------------+
| [KPI: Bases]  [KPI: Tabelas]  [KPI: De-Paras]          |
+--------------------------------------------------------+
| Filtros: [busca]  [tipo: todos | base | tabela | depara]
+--------------------------------------------------------+
| Cards/Grid de itens:                                   |
|   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   |
|   │ icone + tipo │ │ icone + tipo │ │ icone + tipo │   |
|   │ nome         │ │ nome         │ │ nome         │   |
|   │ descricao    │ │ descricao    │ │ descricao    │   |
|   │ badge ativo  │ │ badge ativo  │ │ badge ativo  │   |
|   │ [Abrir]      │ │ [Abrir]      │ │ [Abrir]      │   |
|   └──────────────┘ └──────────────┘ └──────────────┘   |
+--------------------------------------------------------+
```

Detalhes:

- **Header**: título "Entra Dados" + subtítulo curto. Botão `+ Nova base` (apenas visual, abre toast "em breve").
- **KPIs (3 cards)**: Bases, Tabelas, De-Paras — números vindos do mock.
- **Filtros**: input de busca por nome + `Tabs` (Todos / Bases / Tabelas / De-Paras).
- **Grid responsivo** (`grid md:grid-cols-2 lg:grid-cols-3 gap-4`) de cards com:
  - Ícone por tipo (`Database` para base, `Table` para tabela, `GitMerge` para de-para).
  - Nome, descrição curta, badge "Ativo".
  - Botão **Abrir**: se for de-para → navega para `/de-para`; demais tipos → toast "em breve".
- **Mock interno** no arquivo: um array de itens incluindo pelo menos um item real de de-para (estático, sem chamar a edge function ainda) e 2–3 placeholders de bases/tabelas para ilustrar.

Sem chamadas à edge function, sem hooks novos, sem alterações em `DePara.tsx` ou na função `de-para-s3`.

---

## 3. Critérios de sucesso

1. Rota `/entra-dados` existe e renderiza a nova página.
2. Sidebar mostra **Visão Geral** dentro de **Entra Dados**, acima de **De-Para**.
3. KPIs, filtros e grid de cards aparecem com dados mockados.
4. Clicar em **Abrir** num card de de-para leva para `/de-para`.
5. Nenhuma tabela nova no banco, nenhuma alteração em edge function.

---

## Observações

- Quando formos para o passo de dados reais, criaremos as tabelas com prefixo `enda_` (ex.: `enda_bases`, `enda_tabelas`, `enda_deparas`) e um RPC/endpoint único para listar tudo agregando o S3 atual dos de-paras.
- Mantém escopo cirúrgico: só UI + rota + 2 itens no sidebar.
