
# Plano — eliminar "por Sistema" restante na timeline

## Diagnóstico confirmado

Lead do print (`0caf5e44…`, FABIO SOUZA FERNANDES):

```text
contato_timeline
  id           = d2bda900-…
  tipo         = status_change
  descricao    = "Status alterado de Atribuído para Novo"
  usuario_id   = NULL
  usuario_nome = "Sistema"
  metadata     = { observacoes: "Reset de herança — lead sem histórico neste evento", ... }
  created_at   = 2026-07-20 17:50:47Z
```

O filtro atual em `get_contato_timeline` casa em `descricao ILIKE '%Reset de herança%'` etc. — mas `contato_timeline.descricao` guarda só "Status alterado de X para Y". O texto "Reset de herança" vive em `metadata->>'observacoes'`. Por isso a linha escapa e aparece como "por Sistema".

Confirmado no banco:
- `contato_timeline`: 203.337 linhas com `tipo=status_change`, `usuario_id IS NULL`, `usuario_nome='Sistema'`.
- Só em 2026-07-20: **98.853** (é o dia dos resets/correções). Nos demais dias fica em ~50–100/dia (esses são triggers legítimos antigos e é seguro deixar visíveis).

Portanto: **não** podemos hidear tudo que é `usuario_nome='Sistema'` sem contexto — só o que é maintenance job de hoje.

## Correção — Front A (patch cirúrgico em `get_contato_timeline`)

Uma única migração alterando a RPC para checar `metadata->>'observacoes'` além da `descricao`:

```sql
CREATE OR REPLACE FUNCTION public.get_contato_timeline(
  p_contato_id uuid, p_limit int DEFAULT 20, p_offset int DEFAULT 0
) RETURNS TABLE (...)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, tipo, descricao, metadata, usuario_nome, created_at
  FROM public.contato_timeline
  WHERE contato_id = p_contato_id
    AND NOT (
      tipo = 'status_change'
      AND (usuario_id IS NULL OR usuario_nome ILIKE 'Sistema%')
      AND (
        descricao ILIKE '%Reset de herança%'
        OR descricao ILIKE '%Correção automática%'
        OR descricao ILIKE '%auto-trigger%'
        OR descricao ILIKE '%Alterado pelo sistema%'
        OR COALESCE(metadata->>'observacoes','') ILIKE '%Reset de herança%'
        OR COALESCE(metadata->>'observacoes','') ILIKE '%Correção automática%'
        OR COALESCE(metadata->>'observacoes','') ILIKE '%auto-trigger%'
        OR COALESCE(metadata->>'observacoes','') ILIKE '%fallback de migracao%'
      )
    )
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
```

Cobre os 5 padrões auditados no banco:

```text
Reset de herança — lead sem histórico neste evento         (75.174)
Correção automática — desfaz reset indevido …              (20.776)
Reset de herança T7 …                                       (1.436)
Correção automática — desfaz reset T7 indevido …            (1.381)
auto-trigger (fallback de migracao)                            (86)
```

## O que NÃO muda

- `logs_movimentacao_contatos` (preserva status por evento).
- `contato_timeline` (nenhum `DELETE`/`UPDATE` de linha).
- Status changes legítimos com `usuario_nome='Sistema'` de outros dias continuam visíveis (não casam nos predicados de observação).
- Kanban, webhooks, cadência, importador, `contatos.status`, responsáveis.

## Validação (rodo antes de responder ao usuário)

1. Contar quantas linhas ficariam ocultas no lead `0caf5e44…` (esperado: 1).
2. Amostrar 5 leads distintos que tinham "por Sistema — Reset de herança" e mostrar antes/depois.
3. Confirmar que um `status_change` legítimo de "Sistema" (dia 2026-07-13, evento de sync) continua aparecendo.

## Rollback

Recriar a versão anterior da função (mesma assinatura). <1 min.

## Ordem

```text
1. Migração única em get_contato_timeline
2. Validação com as 3 amostras acima
3. Report para o usuário confirmar sumiço na UI (F5 no lead do print)
```
