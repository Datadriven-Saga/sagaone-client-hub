## Diagnóstico confirmado

No caso da Keile (`contato_id=99655a8a-4b00-49bc-a2ec-c55a0201f3c8`), o log correto foi gravado com `vendedor_atendimento_nome = Pedro`.

O `trigger-webhook` também recebeu esse campo:

```text
vendedor_atendimento_nome: "Pedro"
vendedor_atendimento_email: ""
```

Mas o payload final enviado para o MobiGestor saiu sem esses campos. Portanto o problema não está mais na tela nem no insert do log: está na Edge Function/shared helper implantado que não está refletindo a versão atual do código, ou está executando uma versão sem os campos anexados ao payload final.

## Plano de correção

1. **Reforçar o handler do webhook**
   - Ajustar `supabase/functions/trigger-webhook/index.ts` para normalizar `vendedor_atendimento_nome` e `vendedor_atendimento_email` logo na entrada do gatilho `movimentacao_lead_kanban`.
   - Garantir que esses campos sejam preservados ao chamar `dispararMovimentacaoLeadKanban`.

2. **Blindar o helper compartilhado**
   - Ajustar `supabase/functions/_shared/movimentacao-lead-webhook.ts` para sempre copiar `vendedor_atendimento_nome` e `vendedor_atendimento_email` para o payload final quando vierem preenchidos nos `dados`.
   - Adicionar log explícito antes do envio mostrando se os campos de vendedor de atendimento foram anexados.

3. **Redeploy direcionado da Edge Function**
   - Reimplantar `trigger-webhook` após a mudança para eliminar a suspeita de código antigo rodando no Supabase.

4. **Validação pós-correção**
   - Conferir logs da Edge Function após um novo check-in.
   - Critério de sucesso: o log `[movimentacao-lead] dispatching` deve incluir:

```json
{
  "vendedor_atendimento_nome": "<nome digitado/selecionado>",
  "vendedor_atendimento_email": "<email se existir, ou string vazia>"
}
```

## Observação

O payload que você colou mostra `email_vendedor: aila.gsouza@...`; esse campo é o usuário operador logado/quem fez o check-in. O novo campo do vendedor que irá atender deve ir separado como `vendedor_atendimento_nome` e `vendedor_atendimento_email`, sem substituir `email_vendedor`.