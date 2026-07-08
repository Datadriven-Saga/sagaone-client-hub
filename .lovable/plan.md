Desabilitar o multiselect de eventos no dashboard WhatsApp e voltar para single-select, preservando a lógica existente de arrays para reativação futura.

Escopo: `src/components/resultados/DashboardWhatsAppTab.tsx` — seletor de eventos no cabeçalho do dashboard.

Alterações:
1. Substituir a lógica de toggle por seleção única.
   - `toggleEventSelection` passa a substituir `selectedEventIds` pelo ID clicado, garantindo apenas um evento selecionado.
2. Remover controles de multi-seleção do popover.
   - Remover os botões "Todos" e "Limpar" do header.
   - Remover o `<Checkbox>` e o ícone de `<Check>` de cada item da lista.
   - Remover o footer "X de Y evento(s) selecionado(s)".
3. Simplificar o texto do trigger.
   - Remover a ramificação para "N eventos selecionados".
   - Texto padrão: "Selecione um evento".
4. Manter `selectedEventIds` como array internamente.
   - Não reescrever estados para evitar regressões; apenas garantir que o array nunca tenha mais de um elemento.

Critérios de aceite:
- Ao clicar em um evento, apenas ele fica selecionado.
- O popover não exibe mais checkboxes, botões "Todos"/"Limpar" ou footer de contagem.
- O botão trigger mostra o nome do evento selecionado ou "Selecione um evento".
- Fetch de dashboard continua lendo `selectedEventIds[0]` (já usa o primeiro ID).

Fora do escopo:
- Investigar por que o multiselect não funcionava (será tratado em momento posterior).
- Alterar chamadas ao webhook, agregação de métricas ou estrutura de dados.