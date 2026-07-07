Ajustar somente o modal `CriarProspeccaoModal` para as divs encostarem de fato nas bordas internas do dialog.

## Plano

1. **Neutralizar o padding padrão do DialogContent com prioridade**
   - Trocar `p-0` por classes mais fortes, por exemplo `!p-0 sm:!p-0`, porque o componente global aplica `p-4 sm:p-6` antes.
   - Isso remove a margem cinza que aparece acima do header e abaixo do footer na imagem.

2. **Fazer header, conteúdo e footer ocuparem 100% da largura**
   - Manter `gap-0` e `overflow-hidden`.
   - Garantir que os blocos internos não recebam margem externa.
   - Deixar padding apenas dentro do conteúdo de cada bloco, não no container do dialog.

3. **Reduzir espaçamento vertical residual**
   - Remover `py-2` do header/container de conteúdo se ainda criar faixa visual indesejada.
   - Preservar o padding interno horizontal onde precisa para os textos e botões não grudarem.

## Arquivo alterado

- `src/components/CriarProspeccaoModal.tsx`

## Fora de escopo

- Não alterar regras de negócio, cadências, banco, payloads ou componentes globais de dialog.