# Adicionar coluna "Em Espera" na aba Desempenho

Adiciona uma coluna nova entre **Atrib.** e **Conv.** na tabela de desempenho dos vendedores, replicando o status "Em Espera" do Kanban (`contatos.status = 'Em Espera'`).

## Mudanças

### 1. Migration SQL — `get_desempenho_vendedores`
Recriar a função para devolver mais uma coluna `em_espera bigint`:
- `alive_result`: `count(*) FILTER (WHERE ec.status = 'Em Espera')::bigint AS em_espera`
- `snap_result`: idem sobre `sr.status`
- Acrescentar `sum(em_espera)` no `SELECT` final e o campo no `RETURNS TABLE`.

Nenhuma outra função é alterada.

### 2. `src/components/resultados/DesempenhoTab.tsx`
- Interface `VendedorDesempenho`: adicionar `emEspera: number`.
- Tipo `SortColumn`: adicionar `'emEspera'`.
- No `map` do RPC: ler `row.em_espera`.
- Array `columns`: inserir `{ key: 'emEspera', label: 'Espera' }` logo após `atribuidos`.
- Adicionar `<TableCell>` correspondente na linha do vendedor (entre Atrib. e Conv.).
- A linha TOTAL já itera `columns`, então soma automaticamente.

Não mexer em estilos, layout ou no cálculo de pontuação.

## Verificação
- Recarregar a aba Desempenho de um evento ativo: nova coluna "Espera" aparece entre Atrib. e Conv., com a mesma contagem da coluna "Em Espera" do Kanban.
- Linha TOTAL soma corretamente.
- Ordenação ao clicar no header funciona.
