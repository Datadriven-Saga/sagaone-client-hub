## Diagnóstico

O fluxo de busca por **4 últimos dígitos** só está implementado no `DashboardLayout` (FAB global). A `RecepcaoModal` aberta dentro de **`/prospeccao/atendimento`** (em `src/pages/Prospeccao.tsx`, linha 3540) usa um `handleRecepcaoSearch` próprio que ignora o sufixo:

```ts
// src/pages/Prospeccao.tsx (atual)
const handleRecepcaoSearch = async (telefone: string) => {
  const result = await buscarContatoMultiAtivo(telefone); // chama direto com "5252"
  if (result) setPendingCheckin(result);
  return result;
};
```

Resultado: ao digitar `5252`/`1163`, o sistema chama `buscarContatoMultiAtivo("5252")`, nenhum contato bate na coluna `contatos.telefone` (que tem o número completo), e a UI cai no caminho "Visitante novo" com as 14 prospecções ativas — exatamente o que aparece nos prints, com o campo "Telefone" mostrando `5252`.

## Correção

1. **Alinhar `Prospeccao.tsx` com o `DashboardLayout`**:
   - Adicionar `buscarContatosPorSufixo` ao destructuring de `useRecepcaoData`.
   - Adicionar estado `sufixoPicker` e renderizar `<RecepcaoMultiContatoPicker>`.
   - Reescrever `handleRecepcaoSearch` com a mesma lógica de 3 ramos: `0` contatos → picker vazio; `1` → chama `buscarContatoMultiAtivo(contatos[0].telefone)`; `>1` → abre picker.
   - Implementar `handlePickContato` (igual ao do `DashboardLayout`).

2. **Refatoração leve (mesma PR, opcional mas recomendada)**: extrair o handler compartilhado para dentro de `useRecepcaoData` como `resolveRecepcaoSearch(input, { onPicker, onMulti })` para evitar nova divergência futura entre os dois pontos de entrada.

3. **Guard adicional em `buscarContatoMultiAtivo`** (defesa em profundidade): se `telefone.replace(/\D/g,'').length < 10`, retornar `null` com toast "Telefone inválido — use 10/11 dígitos ou os 4 últimos" para evitar que qualquer outro caller futuro caia no mesmo bug.

## Validação

- Abrir `/prospeccao/atendimento`, clicar no FAB Check-in, digitar `5252` → deve abrir o `RecepcaoMultiContatoPicker` com os contatos da loja terminados em 5252 (ou "Nenhum contato" se realmente não houver).
- Selecionar o contato → abrir `CheckinConfirmModal` com nome real e prospecções ativas marcando "já existe" naquelas em que o lead está vinculado.
- Repetir o mesmo teste pelo FAB global em outra rota (já funcionava) para garantir não-regressão.
- Conferir no console que `buscarContatoMultiAtivo` nunca é chamado com string de 4 dígitos.
