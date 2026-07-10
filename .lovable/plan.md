Consolidar todos os custos no card "Gasto total"

## Alterações em `src/components/resultados/DashboardWhatsAppTab.tsx`

1. **Remover `hint` de custo dos cards de Leads**:
   - Impactos: remover `Custo/entregue: ...`
   - Respostas: remover `Custo/respondido: ...`
   - Agendamentos: remover `CPL agendado: ...`

2. **Consolidar tudo no card "Gasto total"**:
   - Manter valor principal (gasto total na moeda ativa)
   - Adicionar como linhas abaixo:
     - Custo/entregue: `moneyVal(cpoEntregue)`
     - Custo/respondido: `moneyVal(cpoRespondido)`
     - CPL agendado: `moneyVal(cpoAgendado)`
   - Usar `subHint`/lista compacta para caber no card (texto pequeno, uma linha por métrica)

Nenhuma alteração em lógica de cálculo — só reorganização visual.