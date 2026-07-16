## Objetivo

Dois ajustes cirúrgicos em `src/components/KanbanCard.tsx`. **Nada mais muda.**

## O que **NÃO** muda (garantia explícita)

Fluxo atual do telefone fica **intacto**:

1. Usuário clica no ícone de telefone → abre app de ligação (`tel:`).
2. Ao voltar pro sistema (listener de `focus` / `visibilitychange` / `pageshow` que já existe), aparece a pergunta *"Você realizou a ligação?"*.
3. Se **Sim** → `supabase.rpc('increment_tentativas_chamada', …)` incrementa o contador (comportamento atual preservado).
4. Se **Não** → nada é gravado.

Esse pedaço **não é tocado**: estados, listeners, RPC e diálogo de confirmação pós-retorno continuam iguais.

## O que muda

### 1. Renomear o botão
- Label atual: **"Ligação"**.
- Novo label: **"Mover lead"**.
- Mesmo ícone, posição, estilo e regra de `disabled` (segue habilitando só após `callInitiated`).
- Tooltip do estado desabilitado passa a: *"Clique em ligar antes de mover o lead"*.

### 2. Popover do botão "Mover lead" → uma etapa só
- Remover a **etapa 1** do popover (a pergunta "Você realizou a ligação para {nome}?" com Sim/Não que existia **dentro** do popover).
- Ao clicar em **"Mover lead"**, o popover abre **direto** na lista de destinos que já existe hoje:
  - **Em Espera**, **Convidados**, **Confirmados** (filtrados por `availableColumns`).
  - Link **"Fechar sem mover"**.
- Comportamento de cada destino segue igual: `await onMoveItem(item.id, targetId)` → fecha popover.
- Remover estado `popoverStep` (agora só existe uma tela). `isBusy` fica se ainda é usado para desabilitar destinos durante o move.

> Importante: a **contagem de tentativa** já é feita pelo fluxo do telefone descrito acima. Não vai haver contagem no popover — não duplica pergunta.

## Fora de escopo

- Fluxo do ícone de telefone e diálogo pós-retorno.
- Regra de origem oculta para SDR.
- `KanbanColumn`, `KanbanBoard`, RPCs, RLS, docs.

## Riscos

| # | Risco | Mitigação |
|---|---|---|
| 1 | Remover a etapa do popover apagar acidentalmente o RPC de tentativa | O RPC vive no diálogo pós-retorno do telefone, não no popover. Antes de codar, confirmar isso lendo o arquivo e só remover o bloco visual/estado do popover. |
| 2 | `callInitiated` não resetar corretamente após mover | Manter o reset atual no sucesso do move e no unmount/troca de `item.id`. |
| 3 | Destinos ausentes na visão atual | Filtro por `availableColumns` já existe; sem mudança. |

## Verificação

- `tsgo` para tipos.
- Preview `/prospeccao/atendimento`:
  - Botão mostra **"Mover lead"** e inicia `disabled`.
  - Clicar no telefone abre discador; ao voltar, aparece a pergunta atual e "Sim" continua incrementando o contador.
  - Clicar em **"Mover lead"** abre o popover **direto** nos 3 destinos + "Fechar sem mover", sem pergunta intermediária.
