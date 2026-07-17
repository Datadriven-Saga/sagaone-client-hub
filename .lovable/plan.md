## Objetivo

Ampliar a lista de placeholders reconhecidos como "lead sem nome" no `AtendimentoModal`, para que o campo "Nome do Cliente" fique editável em todos os casos onde o valor gravado é um marcador (não um nome real). Cobre ~41 mil leads já existentes sem tocar em backend, importação ou banco.

## Onde alterar

Apenas `src/components/AtendimentoModal.tsx`, no helper `isNomePlaceholder` (linhas 53-64).

## Nova regra de detecção

Um nome é considerado placeholder quando, após `trim()` + `toLowerCase()`, se encaixa em qualquer um destes critérios:

1. Vazio, `null` ou `undefined`.
2. Match exato com a lista:
   - `lead sem nome`
   - `sem nome`
   - `sem nome no contato`
   - `cliente sem nome`
   - `nome não informado`
   - `cliente`
   - `cliente saga`
   - `não informado`
   - `n/d`
   - `nd`
   - `n/a`
   - `na`
   - `-`
   - `null`
   - `undefined`
3. Match por regex `^sem nome( \d{1,2}[\/ -]\d{1,2}([\/ -]\d{2,4})?)?$` — pega `SEM NOME`, `SEM NOME 26 05`, `SEM NOME 23/06`, `SEM NOME 20 05 2026`, etc.
4. Match por regex `^lead( \d+)?$` — pega `Lead`, `Lead 123`.

## Comportamento resultante

- Leads com `Lead sem nome`, `Cliente Saga`, `Cliente`, `SEM NOME 23 06`, `-`, `N/D` etc. → aparecem com `<Input>` + botão **Salvar**, campo iniciando vazio para o usuário digitar o nome real.
- Leads com nome real (ex.: `João Silva`) → continuam como texto fixo, sem edição (comportamento atual preservado).
- Ao salvar, `handleSalvarNome` atualiza `contatos.nome`, dispara `lead-nome-updated` e mostra toast — sem mudanças aqui.

## Fora de escopo

- Não altera `process-import`, `bulk_upsert_contatos`, `create-base-ligacao` nem qualquer edge function.
- Não faz migração de dados existentes (nomes placeholder continuam gravados como estão até o usuário editar).
- Não altera CPF, celular ou e-mail (continuam somente leitura).
- Não altera nenhum outro componente que exiba `contato.nome`.

## Teste manual pós-implementação

Abrir o `AtendimentoModal` para leads com cada um dos valores abaixo e confirmar que aparece o input editável:
- `Lead sem nome`
- `Cliente Saga` / `Cliente SAGA` / `Cliente`
- `SEM NOME` / `SEM NOME 23 06`
- `-` / `N/D`

E confirmar que um lead com nome real (ex.: `Maria Souza`) continua aparecendo como texto, sem input.
