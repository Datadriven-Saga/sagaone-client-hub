## Mudanças no header do modal

**Arquivo:** `src/components/CriarProspeccaoModal.tsx` (linhas 4687-4731)

1. **Remover "Editar Evento"/"Novo Evento" e "Etapa X de X"** — o `DialogTitle` passa a exibir apenas o `currentStepName` (ex: "Dados Gerais", "Configuração IA", "Convite"). Mantenho o `DialogTitle` para acessibilidade.
2. **Remover o `<p>` de `currentStepName` da linha 4730** (agora redundante com o título).
3. **Centralizar as bolinhas** — trocar `justify-between` do container por `justify-center`, e as bolinhas passam para `flex-1` do lado direito? Não: quero mesmo é centralizar horizontalmente o grupo de steps na linha. Solução: manter layout com título à esquerda e steps ocupando o restante centralizado — usar `flex-1 justify-center` no wrapper das bolinhas.
4. **Bolinhas futuras mais apagadas + linha tracejada:**
   - Estado "futuro" (`index > currentStep`): trocar `bg-muted text-muted-foreground` por `bg-transparent border border-dashed border-muted-foreground/40 text-muted-foreground/50`.
   - Conector: quando `index >= currentStep`, trocar `bg-muted` sólido por linha tracejada — usar `border-t border-dashed border-muted-foreground/40` num `div` sem `bg`. Para etapas já concluídas (`index < currentStep`), manter linha sólida `bg-primary/50`.

Sem mudança de lógica (steps, currentStep, tooltips permanecem).
