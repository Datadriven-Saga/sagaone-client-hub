## Objetivo
Permitir editar o **Nome** do lead na aba "Dados Pessoais" do `AtendimentoModal`, principalmente para leads criados sem nome (ex.: "Lead sem nome #1295002").

## Dificuldade
Baixa. O modal já busca o contato real de `contatos` (`contatoData`) no `useEffect`. Hoje o campo Nome é apenas um `<p>` estático usando `dadosCliente.nome` (mock). Basta trocar por um input controlado ligado ao `contatoData.nome` e salvar em `contatos.nome`.

## Mudanças em `src/components/AtendimentoModal.tsx`
1. Adicionar estado local `nomeEdit` inicializado com `contatoData?.nome` quando o contato carrega.
2. Na aba **Dados Pessoais**, substituir o `<p>` do nome por:
   - `<Input>` controlado + botão **Salvar** (habilitado só quando `nomeEdit !== contatoData.nome` e não vazio).
3. Ao salvar:
   - `supabase.from('contatos').update({ nome }).eq('id', item.id)`
   - Atualizar `contatoData` local e disparar um `CustomEvent('lead-nome-updated', { detail: { contatoId, nome } })` (mesmo padrão já usado para temperatura) para o Kanban refletir sem reload.
   - Toast de sucesso/erro.
4. Manter os demais campos (CPF, celular, e-mail) como estão (mock), fora do escopo.

## Kanban (opcional, mesmo arquivo de listener existente)
Se o card exibir "Lead sem nome #<id>", o listener do evento `lead-nome-updated` pode atualizar o `title` local para refletir imediatamente. Se preferir, deixamos para o próximo refresh natural — confirmar.

## Permissão / RLS
Já coberto pelas policies existentes em `contatos` (o usuário que enxerga o lead no Kanban tem update via `user_can_access_empresa`). Sem migração necessária.

## Fora de escopo
- Edição de telefone/e-mail/CPF (mock hoje).
- Validação de duplicidade por telefone.

Confirma que quer também atualizar o título do card no Kanban em tempo real?