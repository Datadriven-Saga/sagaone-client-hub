## Problema

O webhook de movimentação de lead está **sendo chamado** corretamente pelo trigger do banco (vimos nos logs do `trigger-webhook` os payloads do Vini e Cesar saindo). A Lambda do MobiGestor, porém, devolve **HTTP 403 "Authorization data is wrong!"** em todas as chamadas.

## Causa raiz

`supabase/functions/_shared/movimentacao-lead-webhook.ts` (linha 204) envia o token `SAGA_ONE` no header errado:

```ts
headers: {
  "Content-Type": "application/json",
  ...(SAGA_ONE ? { "x-saga-one": SAGA_ONE } : {}),  // ❌ nome errado
},
```

Todos os outros disparos do projeto (templates novos, gatilhos, followups em `trigger-webhook/index.ts`) usam:

```ts
"saga_one_supabase": SAGA_ONE   // ✅ formato aceito pela Lambda
```

Por isso o MobiGestor rejeita só este endpoint — o secret `SAGA_ONE` é o mesmo, o nome do header é que diverge.

## Correção

Arquivo único: `supabase/functions/_shared/movimentacao-lead-webhook.ts`

- Trocar `"x-saga-one"` por `"saga_one_supabase"` na chamada `fetch` (linha 204), alinhando com o padrão usado em `trigger-webhook` e demais funções.

## Validação

1. Mover um lead de Convidado → Check-in num evento Mensal/Grande Evento com flag `webhook_movimentacao_lead` ativa (ex.: HYUNDAI É AGORA, mesmo evento do Vini).
2. Conferir nos logs de `trigger-webhook` que aparece `[movimentacao-lead] ✅ status=200` em vez de `status=403 Authorization data is wrong!`.
3. Confirmar no MobiGestor que o lead chegou e, se aplicável, que `codigo_proposta` voltou e foi salvo em `contatos`.

## Fora de escopo

- Não mexer no trigger SQL, nas flags ou no formato do payload — tudo isso já está funcionando.
- Não rotacionar o `SAGA_ONE`; o valor está correto.
