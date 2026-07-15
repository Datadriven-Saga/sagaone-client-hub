## Confirmação do fluxo atual

Sim, é exatamente esse o comportamento hoje no `KanbanCard.tsx`:

1. Usuário clica no botão de telefone → dispara o `tel:` nativo (abre o app de ligação do dispositivo).
2. Nenhum diálogo aparece na hora — apenas marcamos `pendingCallConfirmation = true` e guardamos o timestamp.
3. Só quando o usuário **volta ao SagaOne** (aba fica visível novamente + passou pelo menos 800ms) é que a pergunta "Você realizou a ligação?" aparece.
4. Se responder "Sim", incrementa tentativas e mostra os atalhos para mover o lead no Kanban.

Ou seja: já está no padrão antigo que você pediu — clique = abre discador nativo, confirmação = só no retorno.

## Plano

Nenhuma alteração de código é necessária. O comportamento atual já corresponde ao padrão antigo solicitado.

Se ao testar no seu dispositivo a pergunta ainda aparecer **antes** de sair do sistema, me avisa qual dispositivo/navegador para eu investigar (pode ser cache do bundle antigo — um hard refresh resolve na maioria dos casos).
