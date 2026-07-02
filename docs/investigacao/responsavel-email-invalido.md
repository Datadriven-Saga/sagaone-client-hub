# Investigação — `contatos.responsavel_email` inválido

Documento de acompanhamento para os padrões de valores inválidos em `contatos.responsavel_email` que ficaram fora do Passo A (correção de UUIDs). Objetivo: entender **quando aconteceu**, se **ainda está acontecendo** e **por qual caller**, para depois decidir entre validação server-side por Edge Function (B) ou trigger global de normalização (C).

Data do levantamento: 2026-07-02.

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

- **Exemplos**: `1858746`, `19044776`, `304762`, `8817`.
- **Padrão**: IDs de 6-8 dígitos. Concentrados em 4 marcas Stellantis + SN GO T7.
- **Distribuição por origem**: WhatsApp 330, Outros ~590.
- **Hipótese principal**: PK de vendedor no MySaga entrando pelo webhook `sync-contatos-ligacao` (WhatsApp) e via planilha (Outros).
- **Ainda ativo?** Última criação 12/jun/26. Provavelmente parou. Confirmar com:
  ```sql
  select count(*), max(created_at)
  from contatos
  where responsavel_email ~ '^[0-9]+$'
    and created_at > now() - interval '30 days';
  ```
- **Ações**:
  1. Amostrar 5 leads recentes por empresa e cruzar `created_at` com `import_logs` (±10min).
  2. Auditar `sync-contatos-ligacao` (linha 243) e `create-lead`.
  3. Se WhatsApp com número puro veio de webhook externo, propor whitelist em `sync-contatos-ligacao`.

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

**Onde entra em `responsavel_email`**: apenas no ramo "criar novo contato" (linha 243), copia `webhookContato.responsavel_email` direto sem validar. Segunda porta de entrada para valores inválidos vindos do webhook externo — **precisa de whitelist na fase B/C**, mas **não é a causa dos 178 UUIDs**.

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
