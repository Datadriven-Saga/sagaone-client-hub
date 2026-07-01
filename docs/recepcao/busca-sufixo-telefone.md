# Busca por sufixo de telefone

**Área:** Recepção
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

A recepcionista raramente sabe o número completo — geralmente o cliente informa **os 4 últimos dígitos** do celular. A busca aceita esse formato e retorna candidatos de eventos ativos da loja.

## Fluxo funcional

1. Digitar ≥4 dígitos (últimos do telefone) ou nome.
2. Sistema retorna todos os contatos da **empresa** cujo telefone termina naquele sufixo **e** que estejam em pelo menos um evento **ativo**.
3. Picker mostra: nome, telefone completo, evento(s), responsável.
4. Recepcionista escolhe e prossegue com o check-in.

## Detalhes técnicos

- **RPC:** `buscar_contatos_por_sufixo_telefone(p_empresa_id uuid, p_sufixo text)`.
  - Restringe a eventos ativos (`data_fim >= current_date`).
  - Ordena por proximidade de match e recência do vínculo.
- **Índice funcional:** `idx_contatos_tel_last4 ON contatos ((right(telefone_normalizado, 4)))` — evita full scan.
- **UI:** `RecepcaoMultiContatoPicker.tsx` exibe telefone completo e edição inline de nome.

## Regras

- Se o sufixo for muito comum (>50 candidatos), o picker limita e sugere refinar por nome.
- Busca é **case-insensitive** para nome e ignora espaços/pontuação no telefone.

## Erros comuns

| Sintoma | Causa | Ação |
|---|---|---|
| "Nenhum contato encontrado" mesmo com telefone certo | Contato não está em evento ativo | Confirmar `data_fim` do evento; se necessário, criar novo lead |
| Busca lenta (>2 s) | Índice `idx_contatos_tel_last4` ausente | Recriar índice funcional |

## Relacionado

- [Visão geral Recepção](./visao-geral.md)