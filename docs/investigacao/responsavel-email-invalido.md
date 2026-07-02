# Investigação — `contatos.responsavel_email` inválido

Documento de acompanhamento para os padrões de valores inválidos em `contatos.responsavel_email` que ficaram fora do Passo A (correção de UUIDs). Objetivo: entender **quando aconteceu**, se **ainda está acontecendo** e **por qual caller**, para depois decidir entre validação server-side por Edge Function (B) ou trigger global de normalização (C).

Data do levantamento: 2026-07-02.

---

## Fase B aplicada em 2026-07-02

Correções já em produção após o Passo A:

1. **`bulk_upsert_contatos`** — validação de `responsavel_email` no ramo INSERT: se o valor não corresponder a um usuário da empresa (via `profiles` + `auth.users`, aceitando email, UUID de profile ou celular), o lead entra sem responsável (NULL, status `Novo`) e contabiliza em `responsavel_skipped` + aviso em `warning_details` (`type: 'responsavel_not_found'`). Se corresponder, grava sempre o **email canônico** (evita variações de case, UUIDs e celulares na coluna).
2. **`sync-contatos-ligacao`** — guard: ao criar novos contatos a partir do webhook externo, `responsavel_email` é sempre gravado como `NULL`. Quando o webhook envia algo, é logado com `console.warn` para auditoria futura.
3. Nada mudou em quarentena, opt-out, deduplicação, `eventos_prospeccao` ou no ramo UPDATE do bulk. Contadores `responsavel_applied` / `responsavel_skipped` continuam expostos no modal de importação (`UploadPlanilha.tsx`).

O que fica para uma eventual Fase C:

- Validação equivalente em `create-lead`, `create-lead-pri`, `create-lead-ligacao`, `create-base-ligacao`.
- Trigger global `BEFORE INSERT/UPDATE OF responsavel_email ON contatos` como rede de segurança.
- Backfill de zeragem dos ~1.522 valores inválidos remanescentes (números, typos, nomes soltos).

---

## Fase D — Barreira no banco (2026-07-02, tarde)

Depois do backfill (0 leads inválidos restantes) e da rejeição estrita na importação de planilha, o último passo é impedir que **qualquer** caminho futuro (edge function nova, script manual, integração) volte a poluir a coluna. Não dá para usar FK porque `responsavel_email` é texto livre e `auth.users` é schema reservado; então usamos uma trigger `SECURITY DEFINER`.

### O que foi criado

1. **`public.contatos_responsavel_rejeicoes`** — tabela de auditoria. Cada tentativa de gravar um `responsavel_email` que não existe em `auth.users` gera uma linha com: email tentado, operação (INSERT/UPDATE), modo (strict/tolerant), `current_user` do banco, `application_name`, resumo do lead (telefone, empresa, nome) e trecho do `current_query()`. Leitura restrita a Admin/TI/Master via RLS; `service_role` tem acesso total.
2. **`public.validate_contato_responsavel_email()`** — função da trigger. Se `responsavel_email` é NULL ou string vazia, deixa passar. Se em UPDATE não mudou, deixa passar. Caso contrário, procura o email (case-insensitive) em `auth.users`.
   - Se existir: normaliza para lowercase/trim e grava.
   - Se não existir: registra em `contatos_responsavel_rejeicoes` e decide pelo modo.
3. **`trg_validate_contato_responsavel`** — `BEFORE INSERT OR UPDATE OF responsavel_email ON public.contatos`.

### Dois modos

O modo é lido do GUC de sessão `app.responsavel_strict`:

| Valor da sessão | Comportamento quando email é inválido |
|---|---|
| não setado (padrão) / `off` / `tolerant` | zera para `NULL` (lead vai para distribuição), loga a tentativa e segue |
| `on` / `strict` | levanta `RAISE EXCEPTION` (SQLSTATE `23514`), aborta a linha e loga a tentativa |

Para ativar o modo estrito numa transação específica:

```sql
SET LOCAL app.responsavel_strict = 'on';
```

O default é **tolerante** de propósito, para não quebrar produção. A importação de planilha continua rejeitando em nível de RPC (`bulk_upsert_contatos` com `p_strict_responsavel = true`) antes mesmo de chegar na trigger, então a UX de erro amigável já mostrada em `UploadPlanilha.tsx` continua igual.

### Rollout

- **Etapa 1 (agora)**: modo tolerante global. A trigger só normaliza e loga. Monitorar `contatos_responsavel_rejeicoes` das últimas 24–72h para descobrir se alguma integração viva ainda alimenta lixo.
- **Etapa 2**: quando os logs zerarem, virar o default para strict (basta mudar o fallback dentro da função de `'tolerant'` para `'strict'`). Fluxos legítimos que queiram cair para NULL passam a chamar `SET LOCAL app.responsavel_strict = 'off'`.
- **Etapa 3 (opcional)**: expor um painel em `/administracao` com as rejeições recentes agrupadas por `origem_app_name` para diagnóstico rápido.

### Como consultar as rejeições

```sql
SELECT
  date_trunc('hour', created_at) AS hora,
  origem_app_name,
  modo,
  count(*) AS tentativas,
  count(DISTINCT responsavel_email_tentado) AS emails_distintos
FROM public.contatos_responsavel_rejeicoes
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, tentativas DESC;
```

Detalhe por email tentado:

```sql
SELECT responsavel_email_tentado, operacao, modo,
       payload_resumo->>'empresa_id' AS empresa_id,
       payload_resumo->>'telefone'  AS telefone,
       stack_context, created_at
FROM public.contatos_responsavel_rejeicoes
ORDER BY created_at DESC
LIMIT 100;
```

### Tradeoffs assumidos

- Custo por INSERT: 1 lookup indexado em `auth.users(email)` por linha nova. Marginal mesmo em `bulk_upsert_contatos`.
- A trigger **não valida** se o usuário está ativo (`profiles.is_active`). Se isso virar problema, é uma segunda iteração — hoje o objetivo é apenas "existe no sistema".
- `DISABLE TRIGGER` continua sendo possível via SQL direto no dashboard. Aceitável: é um caminho consciente de administrador.

---

## 1. Panorama por categoria

| Categoria | Contatos | Emails únicos | Empresas afetadas | Última criação | Ainda ativo? |
|---|---:|---:|---:|---|---|
| `uuid` (Passo A) | 178 | 15 | 6 | 2026-06-30 | Corrigido no Passo A |
| `apenas_numero` | 920 | ~180 | 4 (JEEP T9, CITROEN UDI, RAM BR, SN GO T7) | 2026-06-12 | Provavelmente parado |
| `typo_dominio` | 236 | 2 | 2 (TOYOTA ANA, TOYOTA ASA NORTE) | 2026-06-26 | **Sim** |
| `sem_arroba` | 215 | ~90 | 3 (TOYOTA GYN, BURITI, SN GO T7) | 2026-06-01 | Provavelmente parado |
| `com_espaco` | 60 | 1 | 1 | 2026-07-01 | **Sim** |
| `email_sem_user` | 91 | 2 | Múltiplas | 2026-07-01 | **Sim** |

Total fora do Passo A: ~1.522 contatos.

### Timeline mensal (contagem por mês de criação)

```text
Mês        uuid   apenas_numero   typo_dominio   sem_arroba   com_espaco   email_sem_user
2026-03      6            593              0            0             0                 0
2026-04     47            169              0           12             0                 3
2026-05     61              6             99          161             0                17
2026-06     64            152            137           42            52                58
2026-07      0              0              0            0             8                13
```

Interpretação: `apenas_numero` teve um pico em março e outro em junho; `typo_dominio` cresceu em maio-junho; `com_espaco` e `email_sem_user` são os que mais claramente **continuam entrando em julho**.

---

## 2. Hipóteses e ações de investigação por categoria

### 2.1 `apenas_numero` (920 contatos)

- **Exemplos de valores**: `1858746`, `19044776`, `12653156`, `19407617`, `1567780`, `18774695`, `1930997`, `304762`, `8817` — IDs de 6-8 dígitos, formato compatível com PK de vendedor no MySaga.
- **Distribuição por origem**: WhatsApp 330, Outros ~590.
- **Empresas afetadas**: JEEP T9, CITROEN UDI, RAM BR, SN GO T7 (empresa `538acbf9-83d9-4be9-a664-0b79fff79141`) — concentração fortíssima aqui.

#### Fatos confirmados (levantamento 2026-07-02)

- **Não está mais entrando** desde `2026-06-12`. Última criação: `2026-06-12 20:09:30`.
- **Não é fluxo contínuo, e sim bursts** — cada aparição concentra dezenas/centenas de linhas no **mesmo segundo**:

  ```text
  2026-06-12 20:09:30   empresa 538acbf9   152 leads   7 responsáveis distintos
  2026-04-28 11:59:11   empresa d6c6d45b    91 leads   7 responsáveis distintos
  2026-04-15 12:25:xx   empresa 538acbf9   ~50 leads em 6 sub-bursts
  2026-04-11 14:54:xx   empresa 538acbf9    ~8 leads
  2026-03-11..13        empresa 538acbf9   593 leads
  ```

- Responsáveis se repetem entre bursts: os mesmos ~7 IDs numéricos → provavelmente **7 vendedores reais** cujo ID SAGA/MySaga foi mapeado para a coluna errada.

#### Hipótese principal

Import ad-hoc em bulk (planilha ou chamada direta a Edge Function) da empresa `538acbf9` onde a coluna `responsavel_email` da fonte foi mapeada para o **ID numérico do vendedor no MySaga** em vez do email. A empresa `d6c6d45b` teve um episódio isolado em abr/26 seguindo o mesmo padrão.

#### Descartado

- **`sync-contatos-ligacao`** — sem logs recentes no período dos bursts (a Edge Function praticamente não é usada). E de qualquer forma agora tem guard (Fase B).
- **`dispatch-leads-webhook`** — nunca escreve em `responsavel_email`.

#### Próxima investigação (fase C, não agora)

1. Cruzar os timestamps dos bursts com `import_logs` da mesma empresa (janela ±5min):
   ```sql
   SELECT id, arquivo, uploader_id, total_rows, created_at
   FROM import_logs
   WHERE empresa_id = '538acbf9-83d9-4be9-a664-0b79fff79141'
     AND created_at BETWEEN '2026-06-12 20:05:00' AND '2026-06-12 20:15:00';
   ```
   Repetir para `2026-04-28 11:55-12:05`, `2026-04-15 12:20-12:30`, `2026-03-11..13`.
2. Se nada em `import_logs`: procurar chamadas históricas a `create-lead-ligacao`, `create-base-ligacao`, `create-lead-pri` nesses períodos (Postgres logs e Edge Function logs).
3. Bater os 7 IDs (`18774695`, `19407617`, `12653156`, `1567780`, `1858746`, `1930997`, `304762`) com API do MySaga para confirmar que são vendedores reais e reatribuir os leads ao email correto.
4. Se veio de planilha: nenhuma ação de código adicional — a Fase B já sanitiza novas importações. Alertar o operador.
5. Se veio de Edge Function customizada: adicionar guard equivalente ao aplicado em `sync-contatos-ligacao`.

#### Monitor rápido para confirmar que parou

```sql
SELECT count(*), max(created_at)
FROM contatos
WHERE responsavel_email ~ '^[0-9]+$'
  AND created_at > now() - interval '30 days';
```

### 2.2 `typo_dominio` (236 contatos, 2 emails)

- **Emails**: `diassis.junqueira@gurposaga.com.br` (TOYOTA ANA), `marciel.reis@gruposaga.com.brs` (TOYOTA ASA NORTE).
- **Origem**: 100% `Outros` → planilha.
- **Ainda ativo?** Sim, última criação 26/jun/26.
- **Ações**:
  1. `import_logs` das empresas, janela mai-jul/26, para identificar arquivo e operador.
  2. Alertar operador.
  3. Validar domínio contra `auth.users` no `bulk_upsert_contatos`.

### 2.3 `sem_arroba` (215 contatos)

- **Exemplos**: `leticia maria vieira`, `não`, `bruno gomes`, `sem email`.
- **Padrão**: coluna de nome caindo na coluna de email.
- **Origem**: `Outros`.
- **Ainda ativo?** Última criação 01/jun/26. Provavelmente parou.
- **Ações**: cruzar com `import_logs`; rejeitar valores sem `@` no `bulk_upsert_contatos`.

### 2.4 `com_espaco` (60 contatos)

- **Email**: `valdiria.dsantos@gruposaga.com.br dos santos`.
- **Padrão**: email colado com nome (merge de células, trim ausente).
- **Ainda ativo?** Sim, última criação 01/jul/26.
- **Ações**: trim + validação de espaço no `bulk_upsert_contatos`.

### 2.5 `email_sem_user` (91 contatos)

- **Emails**:
  - `lucas.ssantana@gruposaga.com.br` (61) — domínio válido, sem usuário. Verificar se é ex-funcionário desativado.
  - `moroni-teste.9da56e22@one.sagadatadriven.com.br` (30) — conta de teste possivelmente descartada.
- **Ainda ativo?** Sim, última criação 01/jul/26.
- **Ações**: consultar `auth.audit_log_entries` para saber se `lucas.ssantana` foi deletado e quando; reatribuir os 61 leads; validação server-side pode consultar `auth.users`.

---

## 3. Callers suspeitos que gravam `responsavel_email`

| Caller | Path | Grava? | Valida? | Status |
|---|---|---|---|---|
| `sync-contatos-ligacao` | `supabase/functions/sync-contatos-ligacao/index.ts:243` | Sim (INSERT novo contato) | Não | **Suspeito principal para `apenas_numero`** |
| `create-lead` (Edge pública) | `supabase/functions/create-lead/index.ts:261` | Sim | Não | Suspeito |
| `create-lead-pri` | `supabase/functions/create-lead-pri/index.ts` | Delega para `bulk_upsert_contatos` | Não | Suspeito |
| `process-import` → `bulk_upsert_contatos` | `supabase/functions/process-import/index.ts:743` | Sim | Não | **Suspeito principal para categorias de planilha** |
| `Prospeccao.tsx:2047` (planilha frontend) | frontend | Sim | Não | Mesma classe do process-import |
| `NovoLeadModal.tsx:398` | frontend | Sim (`user.email`) | Fixo | Seguro |
| `useContatoData.ts::atribuirResponsavel` | frontend | Sim | **Agora sim (Passo A)** | Corrigido |
| `dispatch-leads-webhook` | Edge | **Não escreve** | — | Descartado |

---

## 4. `sync-contatos-ligacao` — o que faz

Edge Function que reconcilia contatos de um evento entre a base local e o **webhook externo da PRI Voz** (`automatemaiawh.sagadatadriven.com.br/webhook/verifica-contatos`).

Fluxo:
1. Recebe `telefone_pri`, `id_evento`, `empresa_id`, `prospeccao_id` no body.
2. GET no webhook externo com header `saga_one_supabase`.
3. Recebe lista canônica de contatos do evento na visão da PRI Voz.
4. Compara com `eventos_prospeccao` local:
   - Contato no webhook e não local → cria/reaproveita em `contatos` e cria vínculo em `eventos_prospeccao`. Marca `data_disparo_ia` se a PRI já ligou/enviou WhatsApp.
   - Contato local e não no webhook → deleta o vínculo (mantém contato).
5. Persiste snapshot em `prospect_pri_voz`.

**Uso atual**: sem logs recentes na Edge Function. Praticamente não há tráfego (IA de ligação pouco usada).

**Onde entrava em `responsavel_email`**: no ramo "criar novo contato" (linha 243), copiava `webhookContato.responsavel_email` direto sem validar. **Fase B aplicou guard**: agora grava sempre `NULL` e loga com `console.warn` quando o webhook envia algo.

---

## 5. `dispatch-leads-webhook` pode preencher `responsavel_email`?

**Não.** `rg "responsavel" supabase/functions/dispatch-leads-webhook/index.ts` retorna zero. Essa Edge Function envia payload para a Lambda de disparo WhatsApp e apenas **lê** `responsavel_email`. Nunca escreve. Descartado.

---

## 6. Próximas decisões (fase B/C)

- **(B) Validação server-side por Edge Function** (`bulk_upsert_contatos`, `sync-contatos-ligacao`, `create-lead`, `create-lead-pri`): cirúrgico, contadores por função, mais superfícies para manter.
- **(C) Trigger global `BEFORE INSERT/UPDATE OF responsavel_email ON contatos`** que grava `NULL` + loga em `contatos_responsavel_email_rejeitados`: cobre 100% dos callers, mais opaco.
- **Recomendado**: (C) como rede de segurança + (B) só no `bulk_upsert_contatos` para expor no modal de importação.

---

## 7. Backfill pendente

Após decidir a fase B/C:

```sql
UPDATE contatos
SET responsavel_email = NULL
WHERE responsavel_email IS NOT NULL
  AND responsavel_email NOT IN (SELECT lower(email) FROM auth.users WHERE email IS NOT NULL);
```

Executar apenas com aprovação explícita.
