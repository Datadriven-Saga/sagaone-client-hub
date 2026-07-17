## Objetivo

Simplificar a regra: o campo **Nome do Cliente** no `AtendimentoModal` fica editável **apenas** quando o nome do lead for exatamente `Lead sem nome` (com tolerância a maiúsculas/minúsculas e espaços em branco nas bordas). Em qualquer outro caso — nome real ou outros placeholders — o campo continua como texto fixo, sem edição.

## Alteração

Arquivo: `src/components/AtendimentoModal.tsx`

Substituir a função `isNomePlaceholder` (linhas 53-83), que hoje reconhece uma lista grande de variações (`Cliente Saga`, `SEM NOME 23/06`, `N/D`, `-`, etc.), por uma regra mínima:

```ts
const isNomePlaceholder = (nome?: string | null) => {
  if (!nome) return false;
  return nome.trim().toLowerCase() === 'lead sem nome';
};
```

Nada mais muda:
- O input, o botão **Salvar** e o `handleSalvarNome` continuam iguais.
- O `useEffect` que preenche `nomeEdit` continua chamando `isNomePlaceholder` e vai começar vazio quando o nome for `Lead sem nome`, permitindo digitar o nome real.
- Nome real (ex.: `João Silva`) e outros placeholders antigos voltam a aparecer como texto fixo.

## Fora de escopo

- Não altera nenhuma edge function, RPC, importação ou banco.
- Não altera CPF, celular, e-mail nem outros campos do modal.
- Não muda comportamento do card do Kanban nem de outras telas.

## Teste manual

1. Abrir um lead com nome `Lead sem nome` → aparece input editável + botão **Salvar**; salvar atualiza `contatos.nome`.
2. Abrir um lead com nome real (`Maria Souza`) → aparece somente o texto, sem edição.
3. Abrir um lead com `Cliente Saga`, `SEM NOME 23/06`, `-`, `N/D` → aparece somente o texto, sem edição (comportamento antigo restaurado).