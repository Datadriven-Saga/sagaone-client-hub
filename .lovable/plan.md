# Passo B (cirúrgico) — Validar `responsavel_email` no `bulk_upsert_contatos` + guard no `sync-contatos-ligacao` + investigação `apenas_numero`

## Descobertas relevantes desta rodada

1. `bulk_upsert_contatos` **já tem** validação de responsável — mas só no ramo UPDATE. Já retorna `responsavel_applied`, `responsavel_skipped`, `rejected_responsavel`, `rejected_reasons.profile_inexistente` e `rejected_reasons.fora_da_equipe`. O `process-import` e o `UploadPlanilha.tsx` já expõem esses contadores. **Falta a validação no ramo INSERT** (novos contatos), que hoje grava `v_responsavel` cru na linha 125.
2. `sync-contatos-ligacao` **não tem logs recentes** (Edge Function logs zerados). Bate com o que você disse: quase não estão usando IA de ligação.
3. `apenas_numero` (920 leads) **não é fluxo contínuo**. É um punhado de bulks isolados, todos na mesma empresa `538acbf9` (exceto 91 leads em `d6c6d45b` em 28/abr):
   - 12/jun/26 20:09:30 → 152 leads no mesmo segundo, 7 responsáveis distintos.
   - 28/abr/26 11:59:11 → 91 leads no mesmo segundo, 7 responsáveis.
   - mar/26 → 593 leads, mesma empresa.
   - Último caso: 12/jun/26. **Parou há 20 dias.**

## Etapa 1 — Cirurgia no `bulk_upsert_contatos` (Passo B propriamente dito)

### Objetivo

Aplicar a validação de responsável **também no INSERT**, com a mesma semântica já existente no UPDATE. Nenhuma outra mudança na função.

### Mudanças exatas

Na função `public.bulk_upsert_contatos`:

- Antes do bloco `INSERT INTO public.contatos (...)` (linha ~114), inserir o mesmo lookup usado no UPDATE:
  ```text
  se v_responsavel não é null:
    se contém '@':
      lookup em auth.users por lower(email) = v_responsavel
    senão se é UUID:
      lookup em auth.users por id::text = v_responsavel; retorna email
    senão:
      resolve como profile_inexistente
    se profile encontrado:
      v_responsavel := email resolvido
      v_responsavel_applied += 1
    senão:
      v_responsavel := NULL
      v_responsavel_skipped += 1
      incrementar rejected_reasons.profile_inexistente
      adicionar a warning_details (limit 200): tipo='responsavel_profile_inexistente', value original, telefone, row
  ```
- O INSERT continua igual, mas agora `v_responsavel` já vem sanitizado.
- Preservar o comportamento atual do UPDATE (nada muda lá).
- Nenhuma mudança em quarentena, opt-out, `contato_quarentena`, `eventos_prospeccao`. **Área crítica: escopo estritamente cirúrgico.**

### Migration

Uma única migration `CREATE OR REPLACE FUNCTION public.bulk_upsert_contatos(...)` com o mesmo header/assinatura atual (`p_contatos jsonb, p_empresa_id uuid, p_prospeccao_id uuid DEFAULT NULL, p_canal text DEFAULT 'whatsapp', p_force_status_novo boolean DEFAULT false`). **Sem overload** — reemitindo a mesma assinatura.

### Testes obrigatórios (mesma checklist da KB para essa função)

1. Importação por planilha com responsável válido → grava email, `responsavel_applied += 1`.
2. Importação com responsável inexistente (typo `...brs`) → grava NULL, `responsavel_skipped += 1`, `rejected_reasons.profile_inexistente += 1`, aparece no warning_details.
3. Importação com número puro (ex: `18774695`) → grava NULL, mesma contagem.
4. Importação com UUID válido → resolve para email do profile.
5. Importação com responsável vazio/omitido → grava NULL, sem incrementar skipped.
6. Contato já existente (UPDATE path) → sem mudança de comportamento.
7. Pool import → mesma cobertura.
8. Contadores continuam batendo no `UploadPlanilha.tsx` (já lê `responsavel_applied`/`responsavel_skipped`).

### O que NÃO alterar

- Lógica de quarentena, `upsert_quarentena`, opt-out global, exclusões, deduplicação por telefone, `eventos_prospeccao`, `contato_quarentena`, retorno JSON (só adicionamos incrementos existentes).
- Assinatura da função (sem overload).
- `process-import` (já consome os counters).
- `UploadPlanilha.tsx` (já exibe os counters).

## Etapa 2 — Guard no `sync-contatos-ligacao`

### Contexto

Uso atual quase zero (sem logs recentes). Mas é o único caller externo capaz de gravar `responsavel_email` cru vindo de webhook n8n. Já que estamos passando, blindamos.

### Mudança

Em `supabase/functions/sync-contatos-ligacao/index.ts` linha 243, no INSERT de novos contatos vindo do webhook externo:

```text
- responsavel_email: webhookContato.responsavel_email || null
+ responsavel_email: null   // guard: nunca aceitar responsável vindo do webhook externo
```

E acima do INSERT, logar quando o webhook envia algo que estamos descartando:
```text
if (webhookContato.responsavel_email) {
  console.warn('[sync-contatos-ligacao] descartando responsavel_email do webhook:', {
    telefone_pri, id_evento, value: webhookContato.responsavel_email
  });
}
```

### Justificativa

- Fonte externa não tem como saber quem é o responsável real no Saga One.
- Se algum dia a PRI Voz for melhorada para atribuir, criamos um endpoint próprio com whitelist.
- Zero impacto operacional hoje (função sem tráfego).

## Etapa 3 — Investigação `apenas_numero` (documento)

Atualizar `docs/investigacao/responsavel-email-invalido.md` seção 2.1 com o que já sabemos:

### Fatos confirmados

- Categoria **não está mais entrando** desde 12/jun/26.
- Ocorreram em **bursts** (um único segundo, dezenas/centenas de linhas), não em fluxo gota-a-gota.
- Concentração fortíssima em **1 empresa** (`538acbf9-83d9-4be9-a664-0b79fff79141` — nome a confirmar via `SELECT id, nome, marca FROM empresas WHERE id=...`) + episódio isolado em `d6c6d45b`.
- Origem sempre `WhatsApp` para os bursts recentes, `Outros` no burst de março.
- Responsáveis são poucos e se repetem (7 IDs em cada bulk) → parecem ser **7 vendedores reais** cujo ID SAGA/MySaga vazou.

### Hipótese principal

Bulk import ad-hoc (planilha ou chamada direta ao `create-lead-ligacao` / `bulk_upsert_contatos`) em que a coluna `responsavel_email` foi mapeada para o **ID do vendedor no SAGA/MySaga** em vez do email.

### Próxima investigação (fase C, não agora)

1. Cruzar timestamps `2026-06-12 20:09:30`, `2026-04-28 11:59:11`, `2026-03-11..13` com:
   - `import_logs WHERE empresa_id='538acbf9...' AND created_at BETWEEN ±5min` → identifica o arquivo/uploader.
   - `bases_importadas` da mesma empresa/janela.
   - Se nada em `import_logs`: procurar chamadas diretas a Edge Functions (`create-lead-ligacao`, `create-lead-pri`, `create-base-ligacao`) nesse período.
2. Consultar Postgres logs dessas timestamps para achar o caller.
3. Bater os 7 IDs de responsável (`18774695`, `19407617`, `12653156`, `1567780`, `1858746`, `1930997`, `304762`) com API do MySaga para confirmar que são de vendedores reais.
4. Se confirmado que veio de planilha: nenhuma ação de código extra, a Etapa 1 já sanitiza. Alertar operador.
5. Se veio de Edge Function customizada: adicionar mesmo guard da Etapa 2.

### Status para o backfill

Após Etapa 1 estar em produção há alguns dias, rodar (com aprovação explícita):
```text
UPDATE contatos
SET responsavel_email = NULL
WHERE responsavel_email IS NOT NULL
  AND responsavel_email !~ '@'
  AND responsavel_email !~ '^[0-9a-f]{8}-[0-9a-f]{4}-...';  -- números puros e nomes soltos
-- OU: comparar contra auth.users e zerar tudo que não bate.
```
Fica registrado no doc, não é feito agora.

## Etapa 4 — Doc

Atualizar `docs/investigacao/responsavel-email-invalido.md`:
- Adicionar seção **"Fase B aplicada em 2026-07-02"** listando: cirurgia no `bulk_upsert_contatos`, guard no `sync-contatos-ligacao`, contadores expostos no modal.
- Reescrever seção 2.1 com os fatos acima (bursts, empresa única, parou em 12/jun).
- Marcar seção "sync-contatos-ligacao" com "sem tráfego observado + guard aplicado".

## Ordem de execução

1. Migration com `CREATE OR REPLACE FUNCTION public.bulk_upsert_contatos(...)` incorporando a validação no INSERT.
2. Edit em `supabase/functions/sync-contatos-ligacao/index.ts` linha 243 (guard + log).
3. Update em `docs/investigacao/responsavel-email-invalido.md`.
4. Sem backfill nesta rodada.
5. Sem alteração em `process-import`, `UploadPlanilha.tsx`, `create-lead`, `create-lead-ligacao`, `create-lead-pri`, `create-base-ligacao` — ficam para uma fase C se necessário.

## O que fica fora deste passo

- Trigger global em `contatos.responsavel_email` (opção C).
- Validação em `create-lead`, `create-lead-pri`, `create-lead-ligacao` (avaliar após investigação `apenas_numero`).
- Backfill de números puros / typos / nomes soltos.
- Reatribuição dos 61 leads do `lucas.ssantana@gruposaga.com.br` (checar antes se é ex-funcionário).
