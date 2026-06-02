# Plano — `bulk_upsert_contatos` v2 (validação por equipe + rejeição de linha)

Escopo congelado conforme decisão de produto (§1 da mensagem). Este plano detalha o **bloco SQL** com os nomes reais de coluna já validados no schema, e a sequência banco → edge → frontend.

## Schema confirmado (pré-checks)

- `prospeccao_equipe_membros(id, equipe_id, user_id, created_at)` — **sem** `prospeccao_id`. Vínculo ao evento via `prospeccao_equipes.prospeccao_id`.
- `prospeccao_equipes(id, prospeccao_id, empresa_id, nome, cor, ativo, …)` — filtrar `ativo = true`.
- `bulk_upsert_contatos`: 1 assinatura `(jsonb, uuid, uuid, text, boolean)` — sem overload.
- `profiles`: `id`, `empresa_id`, `celular`, `nome_completo`.

## 1. Banco — nova versão da RPC (mesma assinatura)

### 1.1 Lookup de identidade (substitui o filtro por `profiles.empresa_id`)

```sql
-- Resolve identidade do responsável: lower(email) -> { user_id, nome_completo }
-- Sem filtro por empresa; elegibilidade vem da equipe do evento.
WITH lookup AS (
  SELECT lower(au.email) AS key, p.id AS user_id, p.nome_completo
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE au.email IS NOT NULL AND au.email <> ''
)
SELECT jsonb_object_agg(key, jsonb_build_object('user_id', user_id, 'nome', nome_completo))
INTO _bulk_profiles_lookup
FROM lookup;
```

Lookup por `id::text` e por `celular` continuam para retrocompat, mas **não decidem atribuição**.

### 1.2 Set de membros da equipe (uma vez, antes do loop)

```sql
SELECT COALESCE(array_agg(pem.user_id), ARRAY[]::uuid[])
INTO _equipe_user_ids
FROM public.prospeccao_equipe_membros pem
JOIN public.prospeccao_equipes pe ON pe.id = pem.equipe_id
WHERE pe.prospeccao_id = p_prospeccao_id
  AND pe.ativo = true;
```

Se `p_prospeccao_id IS NULL`, pular esta carga e tratar como "sem validação de equipe" (degrada para comportamento atual — apenas exige profile existente).

### 1.3 Lógica por contato — **antes** do INSERT

```text
v_resp := lower(BTRIM(c->>'responsavel_email'))

SE v_resp vazio:
    fluxo normal (INSERT contato, vínculo evento, sem atribuição)
    CONTINUE

v_match := _bulk_profiles_lookup -> v_resp

SE v_match IS NULL:
    rejected_responsavel++
    push warning_details { telefone, nome, reason: 'profile_inexistente' }
    CONTINUE   -- NÃO insere, NÃO vincula, NÃO chama upsert_quarentena

v_user_id := (v_match->>'user_id')::uuid

SE p_prospeccao_id IS NOT NULL E NOT (v_user_id = ANY(_equipe_user_ids)):
    rejected_responsavel++
    push warning_details { telefone, nome, reason: 'fora_da_equipe' }
    CONTINUE   -- mesmo: nada é escrito

SENÃO:
    INSERT/UPDATE contatos (vendedor_nome = v_match->>'nome',
                            status = 'Atribuído' se p_force_status_novo)
    vínculo em eventos_prospeccao
    responsavel_applied++
```

**Ordem das operações**: a checagem precisa ocorrer antes do `INSERT INTO contatos`, do vínculo em `eventos_prospeccao` e da chamada a `upsert_quarentena`. Revisar o corpo atual da função e mover o bloco de decisão de responsável para o topo do loop.

### 1.4 Retorno da RPC

Adicionar ao JSON de retorno:

```json
{
  "rejected_responsavel": <int>,
  "rejected_reasons": { "profile_inexistente": <int>, "fora_da_equipe": <int> },
  ...
}
```

Manter `responsavel_skipped` no payload (zerado) por compatibilidade até confirmar que nenhum consumidor depende dele.

## 2. Edge Function `process-import`

- Somar `rejected_responsavel` (e os `reason`) entre batches/self-chains.
- `warning_details` permanece capado em 200 entradas por batch; contadores totais não são capados.
- Mensagem final consolidada: `"N linha(s) não importada(s) por responsável inválido — M por usuário fora da equipe, K por e-mail inexistente. Adicione o responsável à equipe do evento ou remova a coluna responsável e reimporte."`
- Logs estruturados sem PII (sem e-mail/telefone/nome). PII só em `warning_details`/`error_details` operacionais.

## 3. Frontend `UploadPlanilha`

- Exibir o novo contador `rejected_responsavel` no resumo final, separado de `errors`.
- Mensagem orientativa idêntica à da edge function.
- Sem mudança em fluxos sem responsável.

## 4. O que NÃO alterar

`upsert_quarentena`, índice parcial em `contato_quarentena`, `ON CONFLICT` de `contatos`/`contato_quarentena`, escrita em `prospeccao_equipe_membros`, opt-out externo, batch size adaptativo, self-chain, statement_timeout, roles, schema, e o comportamento de linhas sem responsável.

## 5. Sequência de entrega

1. Migration: nova versão da `bulk_upsert_contatos` (assinatura preservada) + retorno com `rejected_responsavel`.
2. Edge `process-import`: agregação dos novos contadores + mensagem.
3. Frontend `UploadPlanilha`: exibição do contador e orientação.

## 6. Bateria de testes (gate)

Os 14 cenários da §8 da mensagem do usuário, com destaque:

- TOYOTA GYN reproduzido: SDR com `profiles.empresa_id = NULL` **na equipe** → importa e atribui.
- Mesmo SDR **fora da equipe** → linha rejeitada (`fora_da_equipe`), zero contatos novos, zero vínculos, zero quarentena.
- E-mail inexistente → `profile_inexistente`.
- E-mail em CAPS / com espaços → casa após `lower()` + `BTRIM`.
- Reimport após adicionar à equipe pela UI → linhas antes rejeitadas agora atribuem.
- Self-chain: contadores `rejected_responsavel`/`responsavel_applied` somam corretamente.
- Sem PII nos logs estruturados da edge.
