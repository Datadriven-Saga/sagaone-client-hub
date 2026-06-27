## Diagnóstico confirmado

- O check-in do Fernando gravou **dois logs no mesmo instante**:
  - `auto-trigger (fallback de migracao)` para outra prospecção, sem `vendedor_atendimento_nome`.
  - `Check-in via Recepção` para a prospecção correta, com `vendedor_atendimento_nome = Romilson`.
- Isso explica o payload que você viu: ele veio do **log automático gerado pelo update direto em `contatos.status`**, antes do log manual com Romilson.
- O problema principal não é só UI: o fluxo de recepção ainda faz `supabase.from('contatos').update({ status: 'Check-in' })`, o que aciona o trigger defensivo `trg_log_contato_status` e dispara webhook sem os campos de atendimento.

## Plano de correção

1. **Parar o disparo duplicado no check-in multi**
   - Trocar o update direto de status dentro de `registrarCheckinMulti` por uma mutação atômica que silencie o trigger defensivo.
   - Garantir que somente o log intencional do check-in gere o webhook.

2. **Preservar o vendedor digitado/selecionado**
   - Manter `vendedor_atendimento_nome` e `vendedor_atendimento_email` no insert de `logs_movimentacao_contatos`.
   - O webhook correto continuará enviando:
     - `email_vendedor`: usuário logado que operou o sistema.
     - `vendedor_atendimento_nome`: vendedor que irá atender, ex. `Romilson`.
     - `vendedor_atendimento_email`: e-mail somente se foi selecionado da lista.

3. **Corrigir também o fluxo single/QR Code**
   - Ajustar `registrarCheckin` para não fazer update direto de status sem suprimir o trigger.
   - Esse fluxo hoje não recebe vendedor de atendimento, então não vou adicionar campo novo nele a menos que você peça; vou apenas impedir duplicidade.

4. **Ajuste pequeno de UX do combobox**
   - Quando o usuário digitar um nome livre e confirmar, fechar o popover e manter exatamente o texto digitado.
   - Evitar que Enter selecione item errado ou reabra dropdown.

5. **Validação pós-correção**
   - Conferir que um novo check-in gera **apenas um log relevante** para a prospecção selecionada.
   - Conferir que o payload do `trigger-webhook` contém `vendedor_atendimento_nome` quando preenchido.
   - Não alterar o destino do webhook nem regras do MobiGestor.

## O que não vou alterar

- Não vou mexer em `bulk_upsert_contatos`, importação ou quarentena.
- Não vou remover o trigger defensivo global `trg_log_contato_status`; ele ainda protege outros call sites legados.
- Não vou mudar o significado de `email_vendedor`: ele continua sendo quem executou a ação no sistema, não o vendedor de atendimento.