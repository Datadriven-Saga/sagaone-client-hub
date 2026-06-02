# Plano — `bulk_upsert_contatos` v2 (revisão B1/B2)

Mantém todo o escopo aprovado anteriormente (validação por equipe + rejeição de linha + novos contadores). Esta revisão consolida os writes: `vendedor_nome` passa a ser gravado **dentro** do `INSERT/ON CONFLICT`, e `status` passa a olhar `v_vendedor_nome` em vez de `EXCLUDED.responsavel_email`.

## Mudanças em relação ao plano anterior

### B1 — `vendedor_nome` dentro do INSERT/ON CONFLICT

`v_vendedor_nome` é resolvido **antes** do INSERT (no bloco de decisão de responsável). Hoje a coluna ficava `NULL` na inserção e era corrigida por um `UPDATE` separado depois — 2 writes desnecessários e janela de inconsistência no UPDATE com ON CONFLICT.

Novo INSERT:

```sql
INSERT INTO public.contatos (
  nome, telefone, email, status, origem, empresa_id,
  observacoes, responsavel_email, base_id, codigo_proposta,
  vendedor_nome                       -- ← novo
) VALUES (
  COALESCE(v_contato.value->>'nome', ''),
  v_contato.value->>'telefone',
  NULLIF(v_contato.value->>'email', ''),
  CASE
    WHEN v_vendedor_nome IS NOT NULL THEN 'Atribuído'::status_lead
    ELSE 'Novo'::status_lead
  END,
  COALESCE((v_contato.value->>'origem')::origem_lead, 'Outros'::origem_lead),
  p_empresa_id,
  NULLIF(v_contato.value->>'observacoes', ''),
  v_responsavel,
  NULLIF(v_contato.value->>'base_id', '')::uuid,
  NULLIF(v_contato.value->>'codigo_proposta', ''),
  v_vendedor_nome                     -- ← novo
)
ON CONFLICT (telefone, empresa_id) WHERE telefone IS NOT NULL AND telefone != ''
DO UPDATE SET
  nome = CASE WHEN COALESCE(EXCLUDED.nome, '') != '' THEN EXCLUDED.nome ELSE contatos.nome END,
  email = COALESCE(EXCLUDED.email, contatos.email),
  codigo_proposta = COALESCE(EXCLUDED.codigo_proposta, contatos.codigo_proposta),
  responsavel_email = CASE
    WHEN p_force_status_novo AND EXCLUDED.responsavel_email IS NOT NULL AND EXCLUDED.responsavel_email <> '' THEN EXCLUDED.responsavel_email
    WHEN p_force_status_novo THEN NULL
    WHEN EXCLUDED.responsavel_email IS NOT NULL AND EXCLUDED.responsavel_email <> '' THEN EXCLUDED.responsavel_email
    ELSE contatos.responsavel_email
  END,
  vendedor_nome = CASE
    WHEN p_force_status_novo AND v_vendedor_nome IS NOT NULL THEN v_vendedor_nome
    WHEN p_force_status_novo THEN NULL
    WHEN v_vendedor_nome IS NOT NULL THEN v_vendedor_nome
    ELSE contatos.vendedor_nome
  END,
  status = CASE
    WHEN p_force_status_novo AND v_vendedor_nome IS NOT NULL THEN 'Atribuído'::status_lead
    WHEN p_force_status_novo THEN 'Novo'::status_lead
    WHEN v_vendedor_nome IS NOT NULL THEN 'Atribuído'::status_lead
    ELSE contatos.status
  END,
  updated_at = now()
RETURNING id, (xmax = 0) AS was_inserted
INTO v_contato_id, v_is_new;
```

Notas:
- `v_vendedor_nome` é variável plpgsql; PL/pgSQL faz a substituição no `ON CONFLICT` normalmente.
- `responsavel_email` continua usando `EXCLUDED.responsavel_email` (é o valor da planilha — semântica preservada).
- O segundo `UPDATE public.contatos SET vendedor_nome = ...` é **removido**. O contador `v_responsavel_applied` passa a ser incrementado logo após o INSERT, condicionado a `v_found_profile`.

### B2 — `status` decidido por `v_vendedor_nome`

Trocar todo `EXCLUDED.responsavel_email IS NOT NULL AND <> ''` que decide `status` por `v_vendedor_nome IS NOT NULL`. Esse é o sinal canônico de "responsável validado e atribuído" pós-v2. Mesma troca aplicada no ramo `vendedor_nome` do `DO UPDATE` (ver acima).

`responsavel_email` no `DO UPDATE` permanece olhando `EXCLUDED.responsavel_email` — isso espelha o que veio da planilha (campo informativo), não o resultado da validação.

### Status no INSERT puro

Antes, o INSERT puro sempre gravava `'Novo'` e o UPDATE posterior subia para `'Atribuído'`. Agora o `status` já entra correto no INSERT, usando o mesmo `CASE` (com `v_vendedor_nome`). Sem janela intermediária de status incorreto.

## Tudo o mais permanece igual ao plano anterior

- Lookup `lower(email) → {user_id, nome_completo}` sem filtro por `profiles.empresa_id`.
- Set `v_equipe_user_ids` carregado uma vez via `prospeccao_equipes.ativo = true`.
- Decisão de responsável **antes** do INSERT; rejeita a linha (sem contato, sem vínculo, sem quarentena) quando `profile_inexistente` ou `fora_da_equipe`.
- Novos contadores: `rejected_responsavel` + `rejected_reasons { profile_inexistente, fora_da_equipe }`.
- `responsavel_skipped` mantido no payload zerado por compat.
- `process-import` agrega os novos contadores; mensagem final orientativa.
- `UploadPlanilha` exibe o novo contador separado de `errors`.
- Nada alterado em `upsert_quarentena`, índice parcial de `contato_quarentena`, `ON CONFLICT` de `contatos`, escrita em equipes, opt-out, batch size, self-chain, schema.

## Bateria de testes — adições por B1/B2

Mantém os 14 cenários originais, com observações extras:

- **Contato novo + responsável válido**: status já entra `'Atribuído'` e `vendedor_nome` populado em **1 único write**; não há transição intermediária `'Novo' → 'Atribuído'`.
- **Contato existente + responsável válido (sem `p_force_status_novo`)**: `vendedor_nome` é atualizado para o novo nome resolvido; status vira `'Atribuído'`.
- **Contato existente + planilha sem responsável (sem `p_force_status_novo`)**: `vendedor_nome` e `status` preservados (não zera).
- **Contato existente + `p_force_status_novo=true` + planilha sem responsável**: `vendedor_nome` zerado e `status='Novo'` (comportamento legado preservado).
- **Race com `UPDATE` separado removido**: confirmar via leitura imediata pós-RPC que `vendedor_nome` e `status` estão consistentes sem segundo write.
