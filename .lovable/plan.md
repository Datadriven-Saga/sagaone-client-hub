## Filtro por data na Visão Administrativa — WhatsApp

Em `/resultados/whatsapp` (Visão Administrativa), adicionar dois campos de data ao bloco "Filtros", ao lado dos atuais Nome da Empresa / Marca / UF, para filtrar a lista de eventos pelo intervalo `data_inicio` e `data_fim` exibido em cada item.

### Comportamento

- Dois inputs `type="date"`: **Data início (a partir de)** e **Data fim (até)**.
- Regra de filtragem (client-side, já que `allEvents` está em memória):
  - "Data início (a partir de)" mantém eventos cujo `data_inicio >= valor`.
  - "Data fim (até)" mantém eventos cujo `data_fim <= valor` (fallback para `data_inicio` quando `data_fim` for nulo).
  - Eventos sem nenhuma data são ocultados quando há qualquer filtro de data preenchido.
- Botão "Limpar" e o badge de "filtros ativos" passam a considerar também os dois campos de data.
- Resetar `visibleCount` para `PAGE_SIZE` ao alterar qualquer filtro (mesmo padrão dos demais).

### Onde mexer

- `src/components/resultados/AdminDashboardWhatsApp.tsx`
  - Novos states: `filterDataInicio`, `filterDataFim`.
  - Adicionar dependências no `useMemo` de filtragem (linha ~225) e aplicar a regra acima.
  - Inserir os dois inputs no grid de filtros (linha ~574-595), mantendo o layout responsivo.
  - Atualizar a contagem/condição de "filtros ativos" e o `onClick` do botão Limpar (linhas 562, 598, 603).

### Fora de escopo

- Não alterar a query ao Supabase (filtro é aplicado em memória, igual aos outros).
- Não mexer em `AdminDashboardLigacao` nem na visão não-admin.
