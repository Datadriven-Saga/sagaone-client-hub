## Objetivo

Em `/prospeccao/eventos`, ao criar/editar um evento **IA WhatsApp**:

1. Quando o webhook externo recusa o evento (geralmente por descrição inadequada), capturar o campo `raw` da resposta e mostrar ao usuário uma mensagem amigável — mesmo padrão usado em `/prospeccao/templates` (rejeição da Meta).
2. Parar de chamar o webhook `pri-config`, que retorna 404 (`The requested webhook "POST pri-config" is not registered`).
3. Tornar o retorno de `send-crm-event-email` mais silencioso/amigável: sem toast vermelho, sem alarme quando todos/parte dos envios falham — apenas informação discreta.

## Arquivos afetados

- `src/components/CriarProspeccaoModal.tsx`
- `src/lib/sendCrmEventEmail.ts` (apenas se necessário ajustar mensagem)

Nenhuma mudança de schema, RLS ou edge function.

## Mudanças

### 1. Capturar erro `raw` do webhook de criação do evento IA WhatsApp

Hoje, em `triggerNovoEventoCriadoWebhooks` (linha ~2391), só capturamos `event_id` em caso de sucesso. Se o webhook recusar (HTTP 200 ou 4xx contendo `{ "raw": "..." }`), retornamos `null` silenciosamente e o fluxo cai no `throw new Error('Não foi possível criar o evento...')` genérico (linha ~1651).

Ajustes:

- Alterar o retorno de `triggerNovoEventoCriadoWebhooks` de `string | null` para `{ eventIdPri: string | null; rejectionMessage?: string }`.
- Após `supabase.functions.invoke('external-webhook-proxy', ...)`, inspecionar `proxyResponse`:
  - Se vier `proxyResponse?.raw` (string) **e** não vier `event_id/event_id_pri/id_evento`, capturar em `rejectionMessage`.
  - Também tentar `proxyResponse?.message`, `proxyResponse?.error` como fallback.
- No callsite (linhas 1494 e 1621), se `rejectionMessage` for definido **e** `finalEventIdPri` for nulo:
  - Reverter o `prospeccoes` insert (igual ao bloco atual em 1641–1649).
  - Exibir um `toast` **informativo** (sem `variant: "destructive"`), título tipo "Não foi possível criar o evento" e descrição com o texto de `raw` (preservando quebras de linha; pode usar `duration: 12000` como em Templates).
  - `return;` sem lançar erro (evita o toast vermelho do catch global).

Aplicar mesma lógica na edição (linha 1494 / bloco 1499–1513): se vier `rejectionMessage` e não vier `event_id_pri`, mostrar o mesmo toast amigável e abortar (sem reverter, já que é update).

### 2. Remover chamada `pri-config`

A função `callWebhook` (linhas 1750–1857) faz `external-webhook-proxy` com `endpoint: 'pri-config'` que está sempre 404. Manter esse fluxo só polui logs e atrasa a criação.

- Remover as duas chamadas a `callWebhook(data)` (linhas 1488 e 1615) e seus usos das variáveis `priConfigResult` / `eventIdPriFromWebhook`.
- Simplificar o bloco 1624–1654: `finalEventIdPri = eventIdPriFromGatilhos` (única fonte real do ID hoje).
- Excluir a definição da função `callWebhook` inteira (1750–1857) — não é mais referenciada.
- Atualizar o bloco de edição (1486–1513) para usar apenas `editEventIdPri` vindo de `triggerNovoEventoCriadoWebhooks`.

### 3. Feedback amigável do `send-crm-event-email`

Hoje (linhas 1550–1575 e provavelmente outro callsite na criação), o `.then` exibe `toast({ variant: "destructive" })` quando há `erros > 0`, `!success` ou `total_destinatarios === 0`.

- Remover `variant: "destructive"` nesses três cenários.
- Substituir por toast padrão (cinza), com mensagens discretas:
  - Sucesso parcial / total de falhas: apenas um `toast` informativo curto, ex. "Notificação de evento processada" + descrição opcional com contagem. Sem ícone de erro.
  - Nenhum CRM encontrado: toast informativo, não destrutivo.
  - Falha geral (`!success`): toast informativo, log do erro no `console.warn` apenas.
- Garantir que o mesmo tratamento exista nos dois callsites (edição e criação) — replicar o trecho de 1550–1575 também no bloco de criação se ainda não tiver.

Opcional (somente se for trivial): em `src/lib/sendCrmEventEmail.ts`, ajustar a mensagem do `message` para algo neutro tipo `"Processado: X enviado(s), Y falha(s)"` — mas não é obrigatório, pois o UI passa a montar a string.

## Validação

- Criar evento IA WhatsApp com descrição inválida → toast amigável com texto do `raw`, evento revertido, sem erro vermelho.
- Criar evento IA WhatsApp válido → fluxo normal, event_id_pri salvo via gatilho, sem chamada a `pri-config` nos logs.
- Editar evento IA WhatsApp com descrição inválida → toast amigável, edição não regride o `event_id_pri` existente.
- Conferir Network: nenhuma chamada a `external-webhook-proxy` com `endpoint: pri-config`.
- Conferir resultado do `send-crm-event-email` com erros: aparece toast neutro, não vermelho.
