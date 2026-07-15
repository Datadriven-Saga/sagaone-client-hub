## Objetivo

Ajustar `src/components/KanbanCard.tsx`:

1. **Esconder o badge de origem** quando o usuário logado for SDR.
2. **Consolidar os dois popups atuais** (confirmar ligação + mover lead) em **um único `Popover` inline** ancorado num botão dentro do card. A contagem de tentativa continua **igual ao fluxo atual**: só incrementa quando o usuário clica em **"Sim"** — nunca só por mover.

## Fluxo final (UX)

1. Card mostra sempre um botão compacto **"Ligação"** na faixa onde hoje aparece a origem.
2. Botão inicia **`disabled`** com tooltip: "Clique em ligar antes de registrar/mover".
3. Usuário clica no ícone de telefone → SO abre o discador (`href="tel:"` preservado). Marca `callInitiated = true` → botão habilita.
4. Usuário clica no botão → abre `Popover`, **etapa 1**: "Você realizou a ligação para {nome}?" com **Sim** / **Não**.
   - **Não** → fecha popover, mantém `callInitiated = true`, nada é gravado.
   - **Sim** → chama `supabase.rpc('increment_tentativas_chamada', { p_contato_id: item.id })` (mesmo RPC de hoje), atualiza contador otimista, toast "Tentativa registrada" e avança para etapa 2 no mesmo popover.
5. **Etapa 2**: título "Mover lead para…" com 3 botões fixos: **Em Espera**, **Convidados**, **Confirmados**, mais link "Fechar sem mover".
   - Destino → `await onMoveItem(item.id, targetId)`; fecha popover; reseta `callInitiated`.
   - "Fechar sem mover" → fecha popover; reseta `callInitiated` (a tentativa já foi contada).

## Mudanças em `src/components/KanbanCard.tsx`

### 1. Detectar SDR
- Importar `useUserAccessType`; derivar `isSDR`.
- Condicionar `{origin && (...)}` a `!isSDR`.

### 2. Estados
- Novos: `callInitiated`, `popoverOpen`, `popoverStep: 'confirm' | 'move'`, `isBusy`.
- Remover: `showCallConfirm` + `AlertDialog`, `showMovePicker` + `Dialog`, `pendingCallConfirmation` e listeners de `focus`/`visibilitychange`/`pageshow` — o gatilho passa a ser o clique explícito no botão inline.

### 3. Botão inline
- Renderizado no mesmo container onde hoje está a origem, sempre visível.
- SDR: assume o espaço vazio deixado pela origem oculta.
- Não-SDR: fica ao lado da origem.
- `disabled` até `callInitiated === true`. Tooltip explica o estado.

### 4. Popover
- Usa `@/components/ui/popover` ancorado no botão.
- `stopPropagation` em todos os cliques internos (não dispara `onCardClick` nem drag do dnd-kit).
- `onOpenChange` só fecha se `!isBusy`.
- Etapa 2 filtra os 3 destinos por `availableColumns` (`emespera`, `convidados`, `confirmados`); se um ID não existir na visão atual, esconde só aquele botão.

### 5. Botão de telefone
- `onClick`: seta `callInitiated = true` e nada mais. Sem timeouts, sem popup automático.

## Mapeamento de riscos

| # | Risco | Mitigação |
|---|---|---|
| 1 | Regressão na contagem de tentativas | RPC `increment_tentativas_chamada` chamado **apenas no clique "Sim"**. Idêntico ao fluxo atual. |
| 2 | Usuário clica em ligar mas não liga → botão habilita sem ligação real | Aceitável (mesmo do fluxo atual). Não gera contagem porque exige "Sim" explícito. |
| 3 | Popover disparar drag do dnd-kit | `stopPropagation` no trigger e no conteúdo; não propagar `listeners`/`attributes` do sortable. |
| 4 | `availableColumns` sem algum dos 3 IDs | Filtrar por presença; esconder botões ausentes; se nenhum sobrar, exibir "Sem destinos disponíveis". |
| 5 | Duplo-clique registrando 2 tentativas | `isBusy` desabilita botões durante o RPC. |
| 6 | Movimento falhar após tentativa contada | Toast de erro; **não** desfaz o incremento (mesmo comportamento de hoje). Popover permanece na etapa 2 para retry. |
| 7 | Reset de `callInitiated` no momento errado | Reseta apenas em: (a) destino com sucesso, (b) "Fechar sem mover" após "Sim", (c) `item.id` mudar. Nunca ao clicar "Não". |
| 8 | SDR sem espaço visual pro botão | Botão ocupa a área antes usada pela origem — sem novo layout. |
| 9 | Não-SDR passa a ver botão que antes não existia | Intencional (pedido do usuário). |
| 10 | Realtime sobrescrever `localTentativas` durante a operação | `useEffect` de sync com `item.tentativas_chamada` já existe; incremento otimista converge quando o backend responde. |

## Fora de escopo

- `KanbanColumn`, `KanbanBoard`, RPCs, RLS, docs, memory — sem alterações.

## Verificação

- `tsgo` para tipos.
- Preview `/prospeccao/atendimento`:
  - SDR: origem some, botão aparece no lugar.
  - Botão inicia `disabled`; clicar no telefone habilita.
  - "Sim" incrementa contador e avança para os 3 destinos; "Não" só fecha; mover funciona; "Fechar sem mover" mantém a tentativa contada.
