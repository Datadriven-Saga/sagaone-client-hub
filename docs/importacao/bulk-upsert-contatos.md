# `bulk_upsert_contatos` — Regras Críticas

**Área:** Importação
**Público-alvo:** dev
**Última revisão:** 2026-07-01

> ⚠️ **Zona crítica.** Coração de toda ingestão de leads. Alterações mal calibradas quebram planilha, pool, ingest e APIs públicas ao mesmo tempo.

## O que é

RPC `SECURITY DEFINER` que insere/atualiza contatos em lote e vincula ao evento indicado, aplicando quarentena, opt-out e dedup canônico por telefone.

## Contrato

```
bulk_upsert_contatos(
  p_empresa_id uuid,
  p_prospeccao_id uuid | null,
  p_leads jsonb                 -- [{ nome, telefone, email?, ... }]
) RETURNS jsonb                 -- { total, vinculados, ja_vinculados, bloqueados_*, invalidos }
```

## Regras invariantes

1. **Chave de dedup:** `(empresa_id, telefone_normalizado)`. Nunca por nome/e-mail.
2. **Vínculo em evento:** `IF NOT EXISTS` — nunca duplica.
3. **Status nunca regride** no update.
4. **PRI IA como responsável** só em contatos novos, sem `responsavel_email`.
5. **Quarentena** consultada via `upsert_quarentena` / `contato_quarentena`, respeitando índice parcial `WHERE marca IS NOT NULL`.
6. **Opt-out global** e **externo** consultados antes do vínculo.
7. `empresas.bypass_compliance=true` desliga quarentena + opt-out (memory `bypass-empresa-colaboradores`).

## Nunca fazer sem testes

A KB registra bugs anteriores:

- **Overload de assinatura** → PostgREST devolve `PGRST203`. Não adicionar sobrecarga.
- **`ON CONFLICT` manual em `contato_quarentena`** → o índice é **parcial**. Trocar sem validar quebra o upsert. Usar sempre `upsert_quarentena`.
- **Trocar chave de dedup** para nome/e-mail → duplicatas em massa.
- **Remover PRI IA como default** → leads órfãos.

## Testes obrigatórios antes de qualquer mudança

| Caso | Origem | Esperado |
|---|---|---|
| Contato novo | planilha | criado + vinculado + PRI IA |
| Existente na empresa | planilha | reutiliza + novo vínculo |
| Já vinculado ao mesmo evento | planilha | conta em `ja_vinculados` |
| Telefone inválido | planilha | conta em `invalidos` |
| Duplicado na planilha | planilha | dedup antes do upsert |
| Marca em quarentena | pool | `bloqueados_quarentena` |
| Telefone em opt-out global | qualquer | `bloqueados_optout` |
| `bypass_compliance=true` | qualquer | quarentena/opt-out ignorados |
| Retroativo grande (10k+) | ingest | self-chaining conclui sem timeout |

## Checklist de diagnóstico

```
- overload atual (pg_proc / pg_get_functiondef)
- se ainda usa upsert_quarentena
- se o índice parcial de contato_quarentena mudou
- impacto em planilha, pool, ingest, create-lead*
- callers passando parâmetros posicionais
```

Se for uma mudança grande, criar `bulk_upsert_contatos_v2` atrás de feature flag em vez de reescrever a v1.

## Relacionado

- [Visão geral](./visao-geral.md)
- [Quarentena](../prospeccao/quarentena.md)
- [Importação por Planilha](./importacao-planilha.md)
- [Importação do Pool](./importacao-pool.md)