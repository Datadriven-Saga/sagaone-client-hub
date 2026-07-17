## Contexto

No `AtendimentoModal`, o campo "Nome do Cliente" só fica editável quando `contatos.nome` está vazio. Porém, em vários leads o valor gravado é literalmente a string `"Lead sem nome"` (placeholder salvo em base) — nesse caso o campo aparece como texto estático, sem possibilidade de edição, como mostra o vídeo.

## Objetivo

Permitir editar o nome sempre que o lead estiver sem nome real, incluindo os casos em que o valor gravado é um placeholder tipo `"Lead sem nome"`, `"lead sem nome"`, `"sem nome"` ou variações com espaços/caixa.

## Alterações

**`src/components/AtendimentoModal.tsx`**

1. Criar helper local `isNomePlaceholder(nome?: string)` que retorna `true` quando:
   - `nome` é vazio/`null`/`undefined`, OU
   - `nome.trim().toLowerCase()` bate com um dos placeholders: `"lead sem nome"`, `"sem nome"`, `"cliente sem nome"`, `"nome não informado"`, `"não informado"`.
2. Trocar a condição atual `!(contatoData?.nome && contatoData.nome.trim())` (linha 355) por `isNomePlaceholder(contatoData?.nome)` para renderizar o input+botão de salvar nesse cenário.
3. Ao carregar `contatoData` (linha ~83, `setNomeEdit`), se `isNomePlaceholder(data.nome)` for `true`, inicializar `nomeEdit` como string vazia (em vez de repetir o placeholder no input) para que o usuário digite o nome do zero.
4. Manter o restante do fluxo `handleSalvarNome` intacto: salva em `contatos.nome`, dispara `lead-nome-updated` e atualiza o `contatoData` local. O título do modal (`Lead sem nome`) já reage via `contatoData.nome`, então passará a exibir o nome real após salvar.

## Fora do escopo

- Não alterar Kanban, card de lista ou webhooks.
- Não mexer em `bulk_upsert_contatos` nem no valor default gravado na importação (débito conhecido — só tratamos na UI).
- Sem migração de dados dos leads já gravados com `"Lead sem nome"`.

## Validação

- Abrir lead com `nome = "Lead sem nome"`: campo aparece como input vazio + botão Salvar habilitado ao digitar.
- Abrir lead com `nome = null`: comportamento igual ao anterior (já funcionava).
- Abrir lead com nome real (ex.: "João Silva"): continua como texto estático, sem input.
- Após salvar, título do modal e header (`Lead sem nome`) atualizam para o novo nome sem precisar reabrir.
