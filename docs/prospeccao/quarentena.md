# Quarentena

**Área:** Prospecção
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Mecanismo de **compliance** que bloqueia temporariamente o envio de mensagens para um telefone. Bloqueio é sempre **por (telefone_normalizado, marca, canal)** — nunca global. Para bloqueio global ver [opt-out global](../administracao/quarentena-manual.md) *(pendente)* e `global_opt_outs`.

## Fluxo funcional (para usuário)

**Como um telefone entra em quarentena:**
- Cliente responde `PARE` / `STOP` a uma mensagem.
- Meta reporta falha permanente para aquele número.
- Operador adiciona manualmente via `/administracao/quarentena` com prazo.
- Bounce/erro específico da Lambda de disparo.

**O que acontece com o lead:**
- Não é disparado enquanto o bloqueio estiver ativo (data_expira > now).
- Continua no Kanban — apenas o **envio automático** é filtrado.
- Ao expirar (`expira_em` passa), o lead volta a receber normalmente.

**Whitelist / exclusão:** operador com permissão pode liberar manualmente (`quarentena_exclusoes`) — soft-delete, mantém histórico.

## Detalhes técnicos

- **Tabelas:** `contato_quarentena`, `quarentena_exclusoes`, `quarentena_logs`, `quarentena_config`.
- **Função canônica:** `upsert_quarentena(...)` — **única** forma correta de inserir/atualizar. **Não** fazer `ON CONFLICT` direto: o índice único é **parcial** (`WHERE marca IS NOT NULL`), então `ON CONFLICT` manual quebra silenciosamente.
- **Índice:** `contato_quarentena_telefone_marca_canal_unique` (partial, `WHERE marca IS NOT NULL`).
- **Filtragem na origem:** `bulk_upsert_contatos`, `dispatch-leads-webhook` e `process-campaign-job` consultam a tabela antes de enviar.
- **Performance:** ver memory `perf-expira-em-and-prefix-search` — índices otimizados para `expira_em > now()` e busca por prefixo de telefone.
- **Variantes de match:** ver memory `phone-match-variants` — normalização de 9º dígito e DDI 55 aplicada no lookup.
- **Visibilidade por marca:** memory `visibility-by-brand` — se o operador não tem acesso à marca, não vê o registro (RLS).

## Regras de negócio

- Bloqueio **por marca** afeta todas as empresas dessa marca (rede).
- Bloqueio **sem marca** (raro / legado) é considerado bloqueio para *todas* as marcas — usado só em opt-out geral.
- Empresa com `bypass_compliance = true` ignora quarentena, opt-out global e opt-out externo (restrito a `EMPRESA ADMIN`).
- **Sempre** logar entrada/saída em `quarentena_logs` — inclusive exclusões manuais.

## Erros comuns

| Sintoma | Causa | Ação |
|---------|-------|------|
| Telefone entra em duplicado | `ON CONFLICT` manual sem passar por `upsert_quarentena` | Refatorar para RPC oficial. |
| Lead recebe mensagem apesar do bloqueio | Bloqueio sem `marca`, ou empresa em `bypass_compliance` | Auditar `contato_quarentena` do telefone; conferir flag da empresa. |
| Import "some" com telefones | `bulk_upsert_contatos` filtrou por quarentena | Comportamento esperado — contador `bloqueados_quarentena` no toast. |

## Relacionado

- [`bulk_upsert_contatos`](../entra-dados/bulk-upsert-contatos.md) *(pendente)*
- [Importação do Pool](../entra-dados/importacao-pool.md)
- [Dispatch WhatsApp](./dispatch-whatsapp.md)
- [Bypass Compliance](../arquitetura/permissoes-e-rbac.md) *(pendente)*