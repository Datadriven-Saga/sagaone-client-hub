# Plano: Reorganizar KPIs do Dashboard WhatsApp

## Objetivo
Agrupar os 4 KPIs de leads sob uma seção **"Leads"** com cards renomeados: **Total**, **Impactos**, **Respostas**, **Agendamentos**. Manter o card **Gasto total** como está hoje.

## Alterações

### `src/components/resultados/DashboardWhatsAppTab.tsx`
1. Adicionar título de seção **"Leads"** acima da grid de KPIs.
2. Renomear os labels no array `kpiCards`:
   - "Total da base" → **Total**
   - "Mensagens entregues" → **Impactos**
   - "Leads responderam" → **Respostas**
   - "Leads agendados" → **Agendamentos**
3. Manter o card **Gasto total** inalterado (mesma posição, mesmo conteúdo).
4. Manter toda a lógica de cálculo, tooltips, hints, ícones, threshold e toggles existentes.

### `src/components/resultados/DashboardWhatsAppSkeleton.tsx`
- Adicionar skeleton de título de seção (h-6 w-24) acima dos cards KPI para representar "Leads". Manter os 5 skeleton cards (4 leads + gasto).

## Não alterar
- Card **Gasto total** (permanece como está).
- Lógica de fetch, agregação e cálculo de métricas.
- Seletor de evento, funil de leads, tabela de gastos por template.
- Cores, gradientes e tipografia.

## Critérios de aceitação
- Título "Leads" aparece acima dos 4 primeiros KPIs.
- Labels renomeados exatamente para Total, Impactos, Respostas, Agendamentos.
- Card Gasto total intocado.
- Build passa sem erros.