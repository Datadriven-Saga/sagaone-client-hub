# Como o Dashboard WhatsApp funciona hoje

Arquivo: `src/components/resultados/DashboardWhatsAppTab.tsx`

**Fluxo de dados**
1. Busca o agente WhatsApp da empresa ativa (via `agente_empresas` + `agentes_ia`, filtro por nome contendo "whatsapp/wpp/zap", preferindo "pri").
2. Lista prospecções WhatsApp da empresa (`canal='Whatsapp'`, `event_id_pri not null`) → alimenta o multi-select de eventos.
3. Para cada evento selecionado, chama `external-webhook-proxy` com endpoint `dashboard-evento-pri-whats`, agrega as respostas (`total_base`, `msg_enviada`, `msg_entregue`, `msg_lida`, `msg_respondida`, `agendado`, `optout`, `negativa_clara`, gastos USD/BRL, templates).
4. Enquanto o webhook responde, a `<Progress>` linear de 15s + skeleton são exibidos.

**O que a UI renderiza**
- **Header**: título + agente, toggle USD/BRL (com tooltip da cotação), multi-select de eventos, botão Atualizar, badge última atualização.
- **Grid de 8 KPI cards** (2/3/4 colunas): Total da base, Mensagens entregues, Leads responderam, Leads agendados, Gasto total, Taxa de leitura, Taxa resposta, Taxa agendamento. Cada card tem `label`, `value`, opcional `pctVal` (linha de %) e `hint` (texto pequeno). Cards com `threshold` (0.03) colorem verde/vermelho.
- **Card "Funil de leads"**: 6 etapas (Base → Enviada → Entregue → Lida → Respondida → Agendado). Cada etapa mostra contagem, "Δ ant" (% vs etapa anterior) e "% da base", com barra proporcional. Abaixo: cards de perdas (opt-out, negativa clara) e um resumo textual.
- **Card de templates** (fora do trecho pedido): ranking de gasto por template.

**Métricas calculadas em `metrics` (memo)**
- `taxaEntrega = entregue/enviada`
- `taxaResposta = respondida/lida` ← hoje calculada sobre lidas
- `taxaLeituraBase = lida/entregue`
- `taxaAgendBase = agendado/total_base` ← hoje calculada sobre base
- `taxaAgendResp = agendado/respondida`
- `cpoEntregue/Respondido/Agendado` = gasto ativo / respectivo denominador

---

# O que muda

Escopo: **apenas** `DashboardWhatsAppTab.tsx` (visual/apresentação). Sem tocar em edge functions, webhook ou lógica de agregação.

## 1. Aumentar tamanho dos números dos KPIs
- Trocar `text-xl` do valor principal para `text-2xl md:text-3xl`.
- Aumentar o `pctVal` de `text-sm` para `text-base md:text-lg` e o hint de `text-xs` para `text-sm`.
- Ícone do card sobe para `h-5 w-5` (hoje `h-4 w-4`).

## 2. Taxa de leitura dentro do KPI de "Mensagens entregues" via hover
- Envolver o card **Mensagens entregues** em `<TooltipProvider><Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>` mostrando:
  - `Taxa de leitura: XX,XX%`
  - `Lidas: N de N entregues`
- Ícone `Info` discreto no canto do card indicando que é hoverable.

## 3. Consolidar taxas dentro dos cards de cima (remover repetição)
Hoje há 4 cards de contagem + 4 cards de taxa/custo com informação repetida. Passa a ter **5 cards** (grid `sm:grid-cols-2 lg:grid-cols-5` ou `lg:grid-cols-4` + 1 largo):

| Card | Valor principal | Sub-linha (%) | Hint / tooltip |
|---|---|---|---|
| Total da base | `numFmt(total_base)` | `enviadas: X%` | — |
| Mensagens entregues | `numFmt(msg_entregue)` | `entrega: X% das enviadas` | tooltip com **taxa de leitura** + custo/entregue |
| Leads responderam | `numFmt(msg_respondida)` | `resposta: X% das entregues` (ver item 5) | custo/respondido |
| Leads agendados | `numFmt(agendado)` | `agendamento: X% das entregues` (ver item 5) | CPL agendado, colorido pelo threshold 3% |
| Gasto total | `money(...)` | `custo/entregue: $Y` | cotação/data (se BRL) |

Cards **removidos** por serem redundantes: "Taxa de leitura", "Taxa resposta", "Taxa agendamento" (info migrou para os cards de contagem correspondentes). Threshold 3% (verde/vermelho) fica no % dentro do card de "Leads agendados".

## 4. Funil: % em cima dos entregues no passo "Respondida"
Hoje o funil mostra três badges por etapa: contagem, `Δ ant` (etapa anterior imediata) e `% da base`. Para **Respondida** e **Agendado**, adicionar um badge extra:
- `X% dos entregues` (calculado como `count / msg_entregue`)

Ordem dos badges: contagem, Δ ant, % dos entregues (novo, só em Respondida/Agendado), % da base.

## 5. Base de cálculo padrão passa a ser "entregues"
- `taxaAgendBase` (hoje `agendado/total_base`) deixa de ser o padrão exibido; passa a usar `taxaAgendEntregue = agendado/msg_entregue`.
- `taxaResposta` passa de `respondida/lida` para `respondida/msg_entregue` no KPI card (o funil continua mostrando "Δ ant" naturalmente).
- Mantemos `taxaAgendBase` e `taxaRespostaLidas` como valores secundários para o modo opcional.

## 6. Toggle para tornar "Lidas" opcional no funil + toggle "% sobre a base"
Adicionar dois `<Switch>` compactos no header do card **Funil de leads**:
- **"Mostrar etapa Lidas"** (default: ligado). Quando desligado: o passo "Mensagem lida" some do array de `funnelSteps`, e o `Δ ant` de "Respondida" passa a ser calculado contra "Entregue".
- **"Base de cálculo: entregues / base"** (default: entregues). Quando "base": mostra `% da base` no lugar de `% dos entregues` nas linhas de Respondida/Agendado (nos KPI cards do item 3 também).

Estado local: `showLidas: boolean = true`, `baseCalc: 'entregues' | 'base' = 'entregues'`.

---

# Detalhes técnicos

- Adicionar em `metrics`:
  - `taxaAgendEntregue = safeDiv(agendado, msg_entregue)`
  - `taxaRespostaEntregue = safeDiv(msg_respondida, msg_entregue)`
- Reestruturar `kpiCards` conforme tabela do item 3, respeitando o toggle `baseCalc` para escolher entre `taxaAgendBase/taxaAgendEntregue` e `taxaRespostaEntregue/taxaResposta`.
- No card "Mensagens entregues", envolver em `Tooltip` (já importado) mostrando `taxaLeituraBase` e composição lida/entregue.
- Em `funnelSteps`, filtrar passo `lida` quando `!showLidas`. Recalcular `Δ ant` naturalmente pela nova ordem do array.
- Nos badges do funil de Respondida e Agendado, adicionar badge extra com `% dos entregues` (`safeDiv(count, msg_entregue)`).
- Ajustar classes Tailwind dos valores/hints dos KPIs conforme item 1.

**Fora de escopo**: alterar `external-webhook-proxy`, agregação, seleção de eventos, agente ou card de templates.
