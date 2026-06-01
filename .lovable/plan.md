
# Opt-Out Externo no `process-import` (fail-closed)

Objetivo: bloquear, antes de qualquer chamada a `bulk_upsert_contatos`, qualquer contato presente na lista externa de opt-out, consultando a API por marca/UF da empresa da importação. Nenhuma mudança em `bulk_upsert_contatos`, quarentena, schema ou triggers.

---

## 1. Pré-requisitos confirmados no codebase

- `process-import/index.ts` resolve `empresa_id` e `prospeccao_id` a partir do `import_logs` (linhas 287–453). É lá que entra a nova camada.
- Tabela `empresas` possui colunas `marca` e `uf` (confirmado via schema). `prospeccoes` não tem — então `marca` e `uf` virão da empresa da importação.
- `bulk_upsert_contatos` é chamada em 3 pontos do `process-import` (timeout-handling, loop principal e finalização) — todas precisam receber só `allowedRows`.
- `useBulkImport.ts` continua chamando `bulk_upsert_contatos` diretamente do frontend → será bloqueado (Opção B do briefing).
- Secret `OPT_OUT_X_API_KEY` já configurado (validar via fetch_secrets ao iniciar build).

---

## 2. Novo helper compartilhado

Criar `supabase/functions/_shared/external-optout.ts` com:

- Constantes: `API_BASE_URL`, `API_TIMEOUT_MS = 10000`, `MAX_RECORDS_GUARD = 10000`.
- `MARCA_API_MAP` com `PEUGEOT`, `CITROEN`, `CITROËN` → `FRANCE`; helper `mapMarcaForApi(marca)`.
- Normalizadores: `normalizePhone` (remove DDI 55 quando 12/13 dígitos, exige ≥10 dígitos, ignora `"None"`/`"null"`), `normalizeEmail` (lower+trim, exige `@`), `normalizeCpf` (11 dígitos exatos).
- `fetchExternalOptOutIndex({ marca, uf })`:
  - Valida secret `OPT_OUT_X_API_KEY` (Deno.env).
  - Monta `GET {API}?marca={mapMarcaForApi(marca)}&uf={UF}` com header `x-api-key`.
  - `AbortController` com timeout de 10s; mede `fetchDurationMs`.
  - Valida `response.ok`, JSON, e que `dados` é array; guarda `> 10000`.
  - Filtragem defensiva por marca/UF: trata `null`/vazio como `"TODAS"`; aceita `marca == apiMarca || marca == originalMarca || "TODAS"`; idem UF.
  - Retorna `{ phones: Set, emails: Set, cpfs: Set, totalRecords, fetchDurationMs }`.
- `isBlockedByExternalOptOut(contato, index, options?)`:
  - V1 ignora `options.channel`, bloqueia se telefone OU email OU cpf (testar `contato.cpf` e `contato.documento`) baterem no índice.

---

## 3. Integração no `process-import/index.ts`

### 3.1 Resolução de marca/UF (uma vez por invocação)

Depois de obter `log` do `import_logs`, buscar `empresas.marca` e `empresas.uf` por `log.empresa_id`. Se faltar marca ou UF → **fail-closed**: marcar `import_logs.status = 'error'` com mensagem `"Empresa sem marca/UF configurados — opt-out externo não pode ser validado"` e abortar antes de qualquer batch.

### 3.2 Buscar índice UMA VEZ por invocação

```text
optOutIndex = await fetchExternalOptOutIndex({ marca, uf });
```

- Logar (sem PII): `importId`, `empresaId`, `prospeccaoId`, `marca`, `apiMarca`, `uf`, `totalRecords`, tamanhos dos Sets, `fetchDurationMs`.
- Em qualquer erro do helper: setar `import_logs.status = 'error'`, `error_details = "Falha ao consultar opt-out externo. Importação bloqueada por segurança."`, e retornar 500 sem chamar `bulk_upsert_contatos`.
- Aceitar re-fetch em self-chain (decisão V1 do briefing).

### 3.3 Filtragem por batch (nos 3 pontos que chamam a RPC)

Antes de cada chamada a `bulk_upsert_contatos` (timeout branch, loop principal, e finalização), particionar `batch` em `allowedRows`/`blockedRows` com `isBlockedByExternalOptOut`. Logar contagens por batch sem PII. Só chamar a RPC se `allowedRows.length > 0`, passando `allowedRows` no lugar de `batch`. Contabilizar `blockedRows.length` no acumulador de "ignorados/erros" no formato já usado pelo `processBatch`/`import_logs.error_details` (adicionar entrada do tipo `"N contato(s) bloqueado(s) por opt-out externo"`).

### 3.4 Sem alteração de contrato

- `MAX_RETRIES`, `BATCH_SIZE` adaptativo, `self-chain`, RPC, `upsert_quarentena`, `eventos_prospeccao`: intocados.

---

## 4. Bloqueio do caminho direto `useBulkImport.ts`

Em `src/hooks/useBulkImport.ts`, no `sendBatch` (antes da chamada `supabase.rpc('bulk_upsert_contatos', …)`), lançar erro:

```text
"Importação direta desabilitada. Use o fluxo de upload de planilha para garantir validação de opt-out."
```

Resultado: o erro é contabilizado no `progress.errorDetails` existente e exibido na UI. Nenhuma chamada à RPC é feita pelo frontend. Sem expor `OPT_OUT_X_API_KEY` no browser.

(Observação: se durante a implementação algum fluxo legítimo do app quebrar por causa disso, paramos e reavaliamos a "alternativa menos drástica" do briefing — uma Edge Function wrapper. Não criamos essa wrapper agora.)

---

## 5. Logs e `import_logs`

- `console.log` com prefixo `[process-import][external-optout]` em três pontos: load do índice, falha de load, e por batch filtrado. Nenhum telefone/email/CPF/nome logado.
- `import_logs.error_details`: usar string genérica `"X contato(s) bloqueado(s) por opt-out externo"` agregada ao final, no mesmo padrão atual. Sem coluna nova. Sem PII.

---

## 6. Fora de escopo (não tocar)

`bulk_upsert_contatos`, `upsert_quarentena`, `contato_quarentena`, `eventos_prospeccao`, schema, triggers, `statement_timeout`, batch size adaptativo, webhooks/n8n, DataLake. Secret nunca vai para o frontend.

---

## 7. Validação após implementar

Em ordem, e sem PII nos logs:

1. Deploy do `process-import` e curl simulando `marca=VOLKSWAGEN, uf=GO` para confirmar índice carrega (`totalRecords`, `fetchDurationMs`).
2. Importação real pequena (planilha de teste) com pelo menos 1 telefone, 1 email e 1 CPF presentes na API → conferir nos logs que foram bloqueados antes da RPC e que `import_logs.error_details` registra.
3. Importação com `marca=PEUGEOT` → confirmar nos logs que `apiMarca=FRANCE`.
4. Simular `OPT_OUT_X_API_KEY` ausente (em ambiente de teste) → `import_logs.status='error'`, RPC não chamada.
5. Verificar no frontend que o caminho `useBulkImport` retorna o erro de bloqueio e que o app continua estável.

---

## 8. Detalhes técnicos para revisão

- A resolução de marca/UF é por `log.empresa_id` → `empresas.marca`, `empresas.uf` (única fonte disponível; `prospeccoes` não tem essas colunas).
- O índice é em memória por invocação (Sets de strings normalizadas), conforme briefing — sem cache persistente entre chains.
- Os 3 call-sites de `bulk_upsert_contatos` no `process-import` recebem o mesmo wrapper de particionamento; o `optOutIndex` é capturado no escopo da função principal e passado adiante.
- Critérios de aceite do briefing (seção 12) são todos cobertos por este plano.

