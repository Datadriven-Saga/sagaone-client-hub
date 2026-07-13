## 1. O que está acontecendo (evidência da JEEP T9)

Evento afetado: **Exclusive Day JEEP - Julho** (`e46684a4-b62e-4680-b740-f2a91be9e92b`, empresa JEEP T9). SDRs de acesso de terceiros ativas: Helen, Neusa, Eunice, Patricia.

Reconstruí a linha do tempo de vários leads (ex.: `0bdb7057-…`, `5c5f7e2d-…`, `35c20b5b-…`) a partir de `logs_movimentacao_contatos`. O padrão se repete em todos:

```text
14:06:53  bulk_upsert_contatos (import 1)  →  status volta para "Novo" e responsavel_email é limpo
14:07:10  Helen "recebe" o lead            →  status vira "Atribuído", responsavel = helen
14:10:53  Helen move para "Em Espera"      →  ok
14:28:57  bulk_upsert_contatos (import 2)  →  volta para "Novo" de novo, responsavel apagado
14:29:36  Helen recebe novamente           →  "Atribuído"
14:31:47  bulk_upsert_contatos (import 3)  →  volta para "Novo", responsavel apagado
14:33:44  Eunice recebe                    →  MESMO LEAD vai para OUTRA SDR
14:39:02  Eunice move para "Em Espera"
```

Os três `bulk_upsert_contatos` são reimportações reais do CSV `Exclusive_Day_JEEP_-_Julho_base_contatos_1_.csv` feitas pelo mesmo usuário às 14:27, 14:30 e 14:32 (registros em `import_logs`, todos com `already_linked=45`, `updated=45`, `errors=600` por timeout).

**Conclusão:** o bug é uma única causa raiz com dois sintomas.

## 2. Causa raiz

Na função `bulk_upsert_contatos`, o ramo de UPDATE (contato já existente) está **sobrescrevendo** `status` e `responsavel_email` com os valores da linha do CSV — que vêm vazios / com `status = 'Novo'` por padrão. Deveria preservar o estado atual quando o CSV não trouxer valor explícito.

Consequências em cadeia:

- Trigger defensivo `trg_log_contato_status` detecta a alteração e grava em `logs_movimentacao_contatos` com `observacoes='auto-trigger (fallback de migracao)'`.
- Com `status='Novo'` e `responsavel_email IS NULL`, o lead volta a ser elegível para atribuição, e a próxima SDR que abrir o app "pega" — daí o mesmo lead cair em Helen e depois em Eunice.
- Métricas do funil ficam infladas (mesmo lead atravessa Novo→Atribuído→Em Espera→Novo várias vezes).

O regressor **não** é a atribuição em si (auto_atribuir_leads_vendedor está correto: exige `status='Novo'` E `responsavel_email IS NULL` E membro de equipe). É o RESET indevido feito pelo import.

Observação: os SDRs externos aqui **não** passam por `auto_atribuir_leads_vendedor` (a função exige `prospeccao_equipe_membros`, e external seats não estão lá). Existe um caminho paralelo de "puxar lead" para external seats que também respeita `status='Novo'` + `responsavel_email IS NULL`. Portanto, corrigir o reset resolve os dois casos.

## 3. Plano de correção (em ordem, sem mexer em prod sem validar)

### Passo 1 — Diagnóstico definitivo em `bulk_upsert_contatos`

- Ler o corpo atual da função (`pg_get_functiondef`) e localizar exatamente:
  - o ramo de UPDATE (contato já existe);
  - se usa `COALESCE(NEW.status, existing.status)` ou está setando `status = COALESCE(payload.status, 'Novo')`;
  - o mesmo para `responsavel_email` e `vendedor_nome`.
- Confirmar que o CSV do usuário está subindo com essas colunas vazias.

### Passo 2 — Migration cirúrgica (nova versão da função, mesmo nome)

Mudar somente o bloco de UPDATE para preservar campos "de posse":

```sql
UPDATE contatos SET
  nome             = COALESCE(NULLIF(payload.nome,''), contatos.nome),
  telefone         = COALESCE(NULLIF(payload.telefone,''), contatos.telefone),
  email            = COALESCE(NULLIF(payload.email,''), contatos.email),
  -- NUNCA regredir:
  status           = CASE
                       WHEN contatos.status <> 'Novo'::status_lead THEN contatos.status
                       ELSE COALESCE(payload.status, contatos.status)
                     END,
  responsavel_email = COALESCE(NULLIF(payload.responsavel_email,''), contatos.responsavel_email),
  vendedor_nome     = COALESCE(NULLIF(payload.vendedor_nome,''), contatos.vendedor_nome),
  updated_at        = now()
WHERE ...;
```

Regra: reimport NUNCA reseta status nem tira responsável — só preenche o que estiver vazio. Novo responsável só entra se o CSV trouxer explicitamente e o campo atual estiver vazio (mantém a política já usada em `create-lead-pri`).

### Passo 3 — Guarda extra na atribuição (defense-in-depth)

Envolver o UPDATE de atribuição (tanto `auto_atribuir_leads_vendedor` quanto o caminho de external seat) em `SELECT … FOR UPDATE SKIP LOCKED` na CTE, para que, mesmo se um dia o status voltar a regredir, duas SDRs simultâneas não peguem o mesmo `contato_id`. Já usa `LIMIT` — só falta o lock.

### Passo 4 — Testes obrigatórios (project-knowledge)

Rodar em dev e comparar contra baseline atual:

- me reimport por planilha (base nova, base já vinculada, base parcialmente vinculada);
- import via pool;
- lead novo, lead existente com responsável, lead existente em Em Espera / Convidado / Check-in;
- telefone duplicado dentro do arquivo;
- quarentena ativa e whitelist;
- `import_logs` (contadores `updated`, `linked`, `already_linked`);
- `logs_movimentacao_contatos` — verificar que **não** aparece mais `auto-trigger (fallback de migracao)` com destino `Novo`;
- rollback simulado.

### Passo 5 — Reprocessar os leads afetados (data fix)

Após o deploy, rodar um script único que:

- Para cada `contato_id` da JEEP T9 cujo último status em `logs_movimentacao_contatos` antes de `2026-07-13 14:00` era diferente de `Novo`, restaurar `contatos.status` e `contatos.responsavel_email` para aquele valor.
- Fica documentado em `docs/prospeccao/` e é executado via `supabase--insert` com aprovação.

### Passo 6 — Alerta preventivo

Criar view/RPC simples `v_leads_status_regredido` que lista qualquer `contato_id` com transição `X → Novo` (X ≠ Novo) nas últimas 24h, e expor um contador na tela de Administração → Logs Disparos ou Monitor. Serve para detectar reincidência antes de virar reclamação.

## 4. Riscos

- **Alto:** `bulk_upsert_contatos` é core de importação — qualquer mexida precisa dos testes do Passo 4 antes de ir a prod.
- **Médio:** o data-fix do Passo 5 sobrescreve `contatos` em massa; precisa ser transacional e restrito por `empresa_id`.
- **Baixo:** adicionar `FOR UPDATE SKIP LOCKED` no auto-atribuir é isolado, mas exige revisar plano de execução para não regredir performance.

## 5. Não vou fazer agora (aguardando OK)

- Não vou aplicar migration em `bulk_upsert_contatos` sem sua aprovação explícita.
- Não vou rodar o data-fix retroativo até o Passo 2 estar em produção.

Se aprovar, começo pelo Passo 1 (leitura completa da função atual) e já trago a migration do Passo 2 pronta para revisão.