## Objetivo
Substituir o loader `Loader2` do `DashboardWhatsAppTab` por um skeleton do dashboard + barra de progresso linear de 15s que aparece enquanto o webhook responde, e some assim que os dados chegam.

## Arquivos

### 1. `src/components/resultados/DashboardWhatsAppSkeleton.tsx` (novo)
Skeleton fiel ao layout real do dashboard:
- Header (título + subtítulo)
- Toggle USD/BRL + seletor de eventos + botão Atualizar
- Grid de 8 KPI cards (2/3/4 colunas responsivas)
- Card de gastos por template com barras
Usa `<Skeleton />` do shadcn, seguindo o padrão de `src/components/resultados/ResultadosSkeleton.tsx`.

### 2. `src/components/resultados/DashboardWhatsAppTab.tsx`
- Adicionar estado `webhookProgress` (0–100) e `webhookStartTime`.
- Ao iniciar `fetchDashboardData`: registrar timestamp e iniciar um `setInterval` (100ms) que preenche linearmente até 100% em 15s.
- Ao terminar (sucesso ou erro): limpar o interval e zerar `webhookProgress`.
- Substituir os dois blocos de loading:
  - Linha 600–606 (loading inicial): renderizar `<DashboardWhatsAppSkeleton />` com a barra de progresso `<Progress value={webhookProgress} />` no topo.
  - Linha 755–759 (loading em refresh): renderizar apenas a barra de progresso fixa no topo do conteúdo, mantendo métricas antigas visíveis se existirem; se `!metrics`, renderizar o skeleton.
- Barra de progresso: `<Progress>` do shadcn já importado, altura `h-1`, com texto pequeno "Consultando webhook…".

## Comportamento
- Barra preenche linearmente em 15s (interval de 100ms adicionando ~0.67%).
- Se o webhook responder antes de 15s → interval é limpo e barra some.
- Se demorar mais que 15s → barra fica em 100% até resposta chegar.
- Não altera lógica de fetch, parsing ou apresentação dos dados.

## Fora de escopo
- Sem mudanças no `EventoSelectorWhatsApp`, edge functions, ou lógica de negócio.