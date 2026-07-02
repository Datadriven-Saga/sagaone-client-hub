# Correção `responsavel_email` inválido

## Passo 1 — Diagnóstico (backfill review)

Rodar SELECT (via `supabase--read_query`) listando todos os `contatos.responsavel_email` que **não** batem com nenhum `profiles.email` (case-insensitive):

```sql
SELECT
  c.empresa_id,
  e.nome AS empresa,
  c.responsavel_email,
  COUNT(*) AS qtd_contatos,
  MIN(c.created_at) AS primeiro,
  MAX(c.updated_at) AS ultimo
FROM contatos c
LEFT JOIN empresas e ON e.id = c.empresa_id
WHERE c.responsavel_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE lower(p.email) = lower(c.responsavel_email)
  )
GROUP BY 1,2,3
ORDER BY qtd_contatos DESC;
```

Entregar a lista ao usuário. Ele decide, por linha:
- **Corrigir** para o email certo (se for typo óbvio como `…brs` → `…br`);
- **Zerar** (`NULL`) — o lead volta para "Novo" e entra na auto-atribuição.

A ação de correção/zeragem é feita depois via `supabase--insert` (UPDATE), **caso a caso**, com aprovação. Nada é alterado sem confirmação.

## Passo 2 — Alteração cirúrgica em `bulk_upsert_contatos`

Escopo mínimo: **só** validar `responsavel_email` vindo da planilha/pool. Nenhuma mudança na lógica de upsert de contato, quarentena, dedup ou logs.

### Mudança

Na migração `20260611141714…` (função atual), no ponto onde hoje faz:

```sql
v_responsavel := NULLIF(BTRIM(v_contato.value->>'responsavel_email'), '');
```

Adicionar validação server-side logo abaixo:

```sql
IF v_responsavel IS NOT NULL THEN
  SELECT lower(p.email) INTO v_responsavel_valid
  FROM public.profiles p
  WHERE lower(p.email) = lower(v_responsavel)
  LIMIT 1;

  IF v_responsavel_valid IS NULL THEN
    v_skipped_responsavel_invalido := v_skipped_responsavel_invalido + 1;
    v_responsavel := NULL;  -- entra como "Novo", auto-atribuição pega depois
  ELSE
    v_responsavel := v_responsavel_valid;  -- normalizado
  END IF;
END IF;
```

Preservar: comportamento de INSERT/UPDATE, `p_force_status_novo`, todo o restante da função.

### Contador exposto

- Adicionar coluna `skipped_responsavel_invalido INT DEFAULT 0` em `import_logs`.
- `process-import` acumula o retorno da RPC no `import_logs.update()` (mesmo padrão dos outros `skipped_*` já implementados).
- `UploadPlanilha.tsx` exibe linha "Responsável não encontrado — atribuído como Novo" no modal de resultado.

### Testes obrigatórios (regra do projeto para `bulk_upsert_contatos`)

Antes de aprovar:
- importação por planilha (com email válido, inválido e vazio);
- importação via pool;
- contatos novos e existentes;
- telefones duplicados na planilha;
- telefone inválido;
- quarentena ativa;
- whitelist;
- logs de quarentena;
- `import_logs` (contadores preservados);
- deduplicação;
- rollback (feature flag `bulk_upsert_validate_responsavel` per_empresa — default OFF; ligar em uma empresa piloto primeiro).

## Fora de escopo

- Trigger `BEFORE INSERT/UPDATE` de defesa em `contatos` (fica para depois se os outros entry points aparecerem no diagnóstico).
- Validação em `sync-contatos-ligacao`, `create-lead-pri`, `create-lead`, `search-lead` — o diagnóstico do Passo 1 vai mostrar se algum caso não veio de planilha. Se aparecer, tratamos em plano separado.
- Refactor para `responsavel_id uuid`.

## Ordem de execução

1. Rodar o SELECT diagnóstico e apresentar resultado.
2. Aguardar decisão de correção linha a linha.
3. Só então implementar migração + alteração em `process-import` + UI.
