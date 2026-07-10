## Objetivo

Adicionar barra de progresso de meta nos 3 cards de KPI (Impactos, Respostas, Agendamentos) preenchendo o espaço em branco atual.

## Metas (calculadas sobre a base total)

- **Impactos** (msgs entregues): meta 95% da base
- **Respostas**: meta 30% da base
- **Agendamentos**: meta 3% da base

O card **Total** não recebe barra (é a base).

## Comportamento da barra

- Trilho cinza (`bg-muted`)
- Preenchimento com gradiente do funil: `from-blue-500 to-emerald-500`
- Largura = `min(100%, valor_atual / meta * 100)`
- Rótulo pequeno abaixo: `X% da meta` (ex: `72% da meta de 95%`)

## Alterações em `src/components/resultados/DashboardWhatsAppTab.tsx`

1. No `useMemo` de `kpiCards`, adicionar em cada um dos 3 cards os campos:
   - `goal`: fração da meta (0.95, 0.30, 0.03)
   - `goalBaseVal`: valor atual comparado à base (`m.msg_entregue / m.total_base`, etc.)

2. No render do card (após o bloco `pctVal`), renderizar condicionalmente (se `kpi.goal` existir):

   ```tsx
   <div className="mt-2">
     <div className="h-1.5 rounded-full bg-muted overflow-hidden">
       <div
         className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
         style={{ width: `${Math.min(100, (kpi.goalBaseVal / kpi.goal) * 100)}%` }}
       />
     </div>
     <p className="text-[10px] text-muted-foreground mt-1">
       {pctFmt(kpi.goalBaseVal)} da meta de {pctFmt(kpi.goal)}
     </p>
   </div>
   ```

Nenhuma alteração em lógica de negócio — apenas apresentação.
