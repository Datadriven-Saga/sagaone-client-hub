## Problema confirmado

Os dois leads (03F5F6E8 - Haroldo, 0D2DF088 - Wenderson) pertencem ao mesmo vendedor **Lorena Bernardo de Camargos**, mas estão armazenados com `responsavel_email` em casing diferente:

- `Lorena.bcamargos@gruposaga.com.br` (com L maiúsculo) → ícone mostra o e-mail cru
- `lorena.bcamargos@gruposaga.com.br` (minúsculo) → ícone mostra o nome corretamente

Causa raiz: as comparações de e-mail (frontend + RPCs `get_kanban_columns` / `get_contatos_paginated` / filtro de responsável) são **case-sensitive**. Quando o casing diverge do que está em `profiles.email`, o lookup falha:
1. O nome do vendedor não é resolvido → exibe o e-mail bruto.
2. O filtro "Responsável: Lorena…" não bate → o card some da visão filtrada (é exatamente o que o usuário vê no print: só 3 cards aparecem, faltando o Haroldo).

## Plano de correção

### 1. Normalização no banco (fonte da verdade)
Migração para padronizar e prevenir recorrência:

- **Backfill**: `UPDATE contatos SET responsavel_email = lower(responsavel_email) WHERE responsavel_email <> lower(responsavel_email);`
- Mesmo backfill em `eventos_prospeccao.responsavel_email` (se a coluna existir lá), `logs_movimentacao_contatos` e qualquer coluna correlata identificada na auditoria.
- **Trigger BEFORE INSERT/UPDATE** em `contatos` (e tabelas afins) que força `responsavel_email = lower(responsavel_email)`.
- **Índice funcional** `lower(responsavel_email)` se ainda não existir, para garantir performance das comparações.

### 2. RPCs
Auditar e ajustar para comparar sempre em lowercase:
- `get_kanban_columns`
- `get_contatos_paginated`
- `get_vendedores_atendimento`
- Qualquer RPC de filtro por responsável

Padrão: `WHERE lower(c.responsavel_email) = lower($param)` e join com `profiles` por `lower(email)`.

### 3. Frontend
- Lookup de nome do vendedor (`src/pages/Prospeccao.tsx` + hooks de Kanban/atendimento): normalizar ambos os lados (`.toLowerCase()`) antes da comparação no `Map`/lookup de `profiles`.
- Filtro "Responsável": enviar valor em lowercase para o RPC.
- Mesma normalização no `CheckinConfirmModal` ao gravar `vendedor_atendimento_email`.

### 4. Pontos de escrita
Garantir lowercase também em:
- `bulk_upsert_contatos` / fluxo de importação (planilha e pool).
- `create-lead-pri`.
- Qualquer atualização manual de responsável no front (atribuição de SDR/vendedor).

### 5. Validação
- Confirmar que após backfill os dois leads aparecem com o nome "Lorena Bernardo de Camargos" e ambos passam a aparecer no filtro por responsável.
- Conferir que o filtro do print passa a mostrar 4 cards (incluindo Haroldo) na Toyota Goianésia.

## Áreas críticas — NÃO alterar sem validação adicional
- `bulk_upsert_contatos`: só adicionar `lower()` no campo `responsavel_email` da entrada, mantendo o restante intacto. Testar planilha + pool + quarentena antes de liberar.

## Fora de escopo
- Não alterar lógica de visibilidade SDR/vendedor.
- Não tocar em status, RLS ou auditoria.
