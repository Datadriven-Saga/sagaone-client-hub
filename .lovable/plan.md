## Objetivo

Deixar o campo **Nome do Cliente** na aba "Dados Pessoais" do `AtendimentoModal` editável **apenas** quando o lead estiver sem nome (ex.: “Lead sem nome #1295002”). Se já tiver nome, o campo continua sendo exibido como texto estático (como era antes).

## Regra

- `contatos.nome` vazio/nulo → renderiza `<Input>` + botão **Salvar**.
- `contatos.nome` preenchido → renderiza `<p>` estático com o nome (comportamento original).

## Mudanças em `src/components/AtendimentoModal.tsx`

1. Manter o fetch atual de `contatoData` (já traz `nome` real do banco).
2. Derivar `leadSemNome = !contatoData?.nome?.trim()`.
3. Na aba Dados Pessoais:
   - Se `leadSemNome`: mostrar `<Input>` controlado por `nomeEdit` + botão **Salvar** (validação: não vazio, máx. 100).
   - Caso contrário: mostrar `<p className="text-sm font-medium">{contatoData.nome}</p>`.
4. Ao salvar com sucesso:
   - `update contatos.nome`
   - Atualiza `contatoData` local (o campo passa automaticamente para modo texto).
   - Dispara `CustomEvent('lead-nome-updated', { detail: { contatoId, nome } })` para o Kanban refletir sem reload (listener já existe conforme plano anterior; se não estiver ativo no card, deixamos para o próximo refresh natural).

## Fora de escopo

- Editar CPF, celular, e-mail (seguem mock).
- Editar nome de leads que já têm nome (não é a intenção agora — se um dia quiser, adicionamos um ícone de lápis).
- Alterar título do `DialogHeader` (continua usando `item.title`).