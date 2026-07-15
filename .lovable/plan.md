## Diagnóstico

O fluxo ainda parece “pular” o aplicativo de telefone porque o clique no ícone faz duas coisas ao mesmo tempo:

1. dispara o `href="tel:..."`, que deveria abrir o discador nativo;
2. no mesmo clique, abre imediatamente o modal “Você realizou a ligação?”.

Mesmo com o `<a href="tel:">` restaurado, esse `setShowCallConfirm(true)` imediato pode tomar a tela/foco antes do sistema operacional mostrar o app de telefone ou o seletor de aplicativo. Por isso a experiência continua parecendo que vai direto para a pergunta.

## Plano de correção

1. **Deixar o clique de telefone como ação nativa pura**
   - O botão de ligar continuará sendo um `<a href="tel:+55...">`.
   - No clique, não abrirá nenhum modal imediatamente.
   - O clique só deve impedir que o card do Kanban abra por trás, sem bloquear o `tel:`.

2. **Abrir a pergunta somente depois que o usuário voltar ao sistema**
   - Ao clicar para ligar, salvar temporariamente qual lead iniciou a ligação.
   - Escutar quando a aba/app voltar ao foco (`visibilitychange`, `focus` ou `pageshow`).
   - Só então mostrar “Você realizou a ligação?”.

3. **Manter o restante do fluxo igual**
   - Se responder “Sim”, continua registrando tentativa via `increment_tentativas_chamada`.
   - Depois disso, continua oferecendo mover o lead no Kanban.
   - Se responder “Não”, apenas fecha.

4. **Validar o comportamento**
   - Clicar no ícone de telefone deve primeiro acionar o app/discador do dispositivo.
   - A pergunta só aparece depois do retorno ao sistema, não no mesmo instante do clique.

## Resultado esperado

O comportamento volta ao padrão antigo: clicou no telefone, o navegador/SO tenta abrir imediatamente o aplicativo de ligação. A confirmação deixa de competir com o discador e passa a aparecer apenas depois do retorno ao SagaOne.