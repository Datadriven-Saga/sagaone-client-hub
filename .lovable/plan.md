## Objetivo

Ajustar o `RecepcaoMultiContatoPicker` (modal que aparece ao buscar por 4 últimos dígitos) para:

1. Mostrar o telefone completo (sem mascarar) — facilita a recepcionista confirmar o lead certo na hora do check-in.
2. Permitir editar/corrigir o nome do contato diretamente no card antes de selecioná-lo (muitos vêm como "luiz", "Lara" sem sobrenome, etc).

## Mudanças

### 1. `src/components/RecepcaoMultiContatoPicker.tsx`

- Remover `maskPhone(...)` e usar `formatPhoneForDisplay(c.telefone)` (já importado) para mostrar o número completo, ex.: `(62) 9 9999-5252`.
- Adicionar um ícone-botão de lápis (`Pencil` do `lucide-react`) ao lado do nome. Ao clicar:
  - Troca o `<span>` do nome por um `<Input>` inline (controlled), com botões `Salvar` / `Cancelar`.
  - Clique no input/botões NÃO dispara o `onSelect` do card (usar `e.stopPropagation()` e mudar o wrapper de `<button>` para `<div>` com botão "Selecionar" próprio, evitando aninhamento de buttons).
- Ao salvar:
  - Chama `supabase.from('contatos').update({ nome: novoNome.trim() }).eq('id', c.id)`.
  - Em caso de sucesso: toast `"Nome atualizado"` e atualiza o item localmente (estado interno do picker, sobrescrevendo `nome` para refletir na UI sem refetch).
  - Em erro: toast destrutivo com a mensagem.
- Validação: `trim().length >= 2`, senão desabilita Salvar.

### 2. Tipagem

- `ContatoSufixoMatch` já tem `id`, `nome`, `telefone`, `status` — sem mudanças no hook/RPC.

### 3. Sem alterações em

- `useRecepcaoData.ts`, `DashboardLayout.tsx`, `Prospeccao.tsx`, RPC `buscar_contatos_por_sufixo_telefone`, fluxo de check-in pós-seleção.

## Observações

- A edição é local ao picker; o contato selecionado é repassado com o nome já atualizado para o fluxo de check-in normal.
- Mantém compliance: o usuário já tem permissão de recepção/atendimento sobre `contatos` da própria empresa (RLS existente cobre o `update`).
