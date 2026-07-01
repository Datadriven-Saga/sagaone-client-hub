# Quarentena Manual

**Área:** Administração
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Tela `/administracao/quarentena` para **gerenciar bloqueios manualmente** — adicionar exclusões, liberar contatos antes do prazo e auditar histórico.

## Fluxo funcional

1. Admin abre a tela e vê a lista de contatos em quarentena (filtros por marca, canal, empresa).
2. Pode **liberar** um contato (soft-delete em `contato_quarentena`) — a UI marca `deleted_at`, mas o registro permanece para auditoria.
3. Pode **adicionar exclusão** (`quarentena_exclusoes`) para números que não devem entrar em quarentena.
4. Ver logs em `quarentena_logs`.

## Detalhes técnicos

- **Página:** `src/pages/admin/Quarentena.tsx`.
- **Tabelas:** `contato_quarentena`, `quarentena_exclusoes`, `quarentena_config`, `quarentena_logs`.
- **RPC canônica:** `upsert_quarentena` (usa o índice parcial `WHERE marca IS NOT NULL`).
- **Otimização:** ver memory `quarentena-server-side-optimization` — índices parciais + RPC de listagem paginada.

## Regras invariantes

- **Chave da quarentena:** `(telefone_normalizado, marca, canal)`. Bloqueio por marca afeta todas as empresas da marca.
- Soft-delete preserva histórico — nunca `DELETE FROM contato_quarentena` direto.
- Alterações são logadas em `quarentena_logs`.
- `bypass_compliance=true` na empresa ignora a quarentena (memory `bypass-empresa-colaboradores`).

## Relacionado

- [Quarentena (Prospecção)](../prospeccao/quarentena.md)
- [`bulk_upsert_contatos`](../importacao/bulk-upsert-contatos.md)