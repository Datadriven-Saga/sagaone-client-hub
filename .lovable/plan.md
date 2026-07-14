## Sim — voltar ao formato antigo

Clicar no botão de telefone volta a abrir o app de telefone nativamente (mobile: discador; desktop: handler configurado como FaceTime/Teams/Skype ou "Escolher um app"), exatamente como era antes de virar `<button>` com `window.open`.

## O que mudou (e por quê "vai direto na pergunta")

Antes: `<a href="tel:+55...">` — o navegador/SO cuidava de abrir o discador.
Hoje: `<button onClick>` que chama `window.open('tel:...', '_self')` e imediatamente abre o `AlertDialog` "Você realizou a ligação?". No desktop sem handler o `window.open` não mostra nada visível, e o dialog sobe por cima — dá a impressão de que pulou o discador.

## Correção — `src/components/KanbanCard.tsx`

1. Trocar o `<button onClick={handlePhoneClick}>` do ícone de telefone por um `<a href="tel:+55{phone}">`, mantendo o mesmo estilo/tooltip. O `onClick` do anchor apenas faz `stopPropagation` e `setShowCallConfirm(true)` — quem dispara o discador é o próprio `href`, tratado pelo SO como sempre foi.
2. Remover `window.open('tel:...', '_self')` de `handlePhoneClick` (a função deixa de ser necessária; a lógica migra para o `onClick` do anchor).
3. Manter intactos: `AlertDialog` de confirmação, `handleConfirmCall`, incremento de tentativas via `increment_tentativas_chamada`, e o `Dialog` de mover o lead após confirmar. Nada de RPC, RLS, edge function ou webhook muda.

### Resultado
- Mobile: toca no ícone → abre o app de telefone nativo (como antes).
- Desktop: clica → navegador abre o handler `tel:` do sistema (como antes).
- Em ambos, a caixinha "Você realizou a ligação?" aparece por cima para registrar a tentativa e, se confirmar, oferecer mover o lead.
