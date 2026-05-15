# Ciclo de Vida de Eventos — Snapshot no Encerramento + Reimportação com Preview

Plano fiel à instrução. Implementação em duas fases independentes e testáveis. Nenhum call site existente da `bulk_upsert_contatos` precisa mudar (novo parâmetro tem `DEFAULT false`).

## Definição operacional de "evento ativo"
Em todo lugar (cron, RPC de preview, bloqueio de importação, frontend):
```
snapshot_realizado = false
AND (data_fim IS NULL OR data_fim >= now())
```
Se `data_fim` já passou mas o cron ainda não rodou, o evento já é tratado como encerrado.

---

## FASE 1 — Snapshot + Descarte Automático no Encerramento

### 1.1 Migration — schema
Migration única com:
- Tabela `evento_snapshot_leads` (status como `TEXT`, sem FKs para `prospeccoes`/`contatos`, RLS por empresa via `user_empresas`).
- Índices em `evento_id` e `contato_id`.
- `ALTER TABLE prospeccoes ADD COLUMN snapshot_realizado boolean DEFAULT false`, `encerrado_at timestamptz`.

### 1.2 Função `encerrar_eventos_finalizados()`
`SECURITY DEFINER`, `search_path = public`. Loop sobre eventos com `data_fim < now() AND snapshot_realizado = false AND is_teste = false`, com `FOR UPDATE SKIP LOCKED`. Para cada evento:
1. `DELETE FROM evento_snapshot_leads WHERE evento_id = …` (idempotência).
2. `INSERT … SELECT DISTINCT ON (c.id) …` de `eventos_prospeccao JOIN contatos`.
3. `UPDATE contatos SET status = 'Descartado'` para leads do evento que **não** estão em status protegido (`Convidado, Confirmado, Check-in, Agendado, Venda, Ganho`) **e** não estão vinculados a outro evento ativo (`NOT EXISTS` com mesma definição de "ativo").
4. `UPDATE prospeccoes SET snapshot_realizado=true, encerrado_at=now()`.

### 1.3 Cron
`pg_cron` diário às `0 6 * * *` UTC (03:00 BRT): `SELECT encerrar_eventos_finalizados()`.

### 1.4 Bloqueio de importação em evento encerrado (defesa em profundidade)
- **Frontend** (`UploadPlanilha` / fluxo de import do evento): consulta `snapshot_realizado` + `data_fim`, mostra `toast.error` e aborta.
- **Edge Function `process-import`**: mesma checagem no início, grava erro em `import_logs` e encerra.

### 1.5 QA Fase 1
Criar evento com `data_fim` no passado, executar a função manualmente, validar:
- snapshot gerado, descartes corretos, status protegidos preservados,
- leads vinculados a outro evento ativo não descartados,
- segunda execução é no-op (idempotente),
- importação bloqueada nos dois pontos.

---

## FASE 2 — Reimportação com Preview de Conflitos

### 2.1 Nova RPC `preview_importacao_conflitos(p_empresa_id, p_prospeccao_id, p_telefones)`
Read-only, `SECURITY DEFINER`. Retorna apenas leads que existem em **outros** eventos ativos. Inclui `eventos_ativos JSONB` agregando `id/nome/data_inicio/data_fim`. Chamada em batches de 1000 telefones pelo frontend.

### 2.2 Alteração da `bulk_upsert_contatos` (4 params atuais)
**`CREATE OR REPLACE` na assinatura existente** — sem novo overload. Adicionar:
```
p_force_status_novo BOOLEAN DEFAULT false
```
Única mudança no corpo: o `CASE` do `status` no `ON CONFLICT … DO UPDATE` ganha 2 ramos no topo:
- `force_status_novo AND responsavel_email preenchido` → `Atribuído`
- `force_status_novo` (sem responsável) → `Novo`
- (demais ramos atuais inalterados)

Quando `p_force_status_novo = false` (todos os call sites atuais), os dois novos `WHEN` são falsos e o comportamento é bit-a-bit idêntico ao atual. Validar com uma importação normal logo após o deploy.

### 2.3 Frontend — componente `ImportPreviewConflitos`
Inserir uma etapa entre o parse do CSV e a chamada de `process-import`:

```
Upload → Parse → preview_importacao_conflitos → (se vazio) segue direto
                                              → (se conflitos) tela de preview
```

Tela de preview:
- Tabela: Telefone | Nome | Status atual | Eventos ativos | Ação (Reimportar/Pular).
- Defaults: status `Convidado/Confirmado/Check-in/Agendado` → **Pular**; demais → **Reimportar**.
- Ações em massa: "Reimportar Todos" / "Pular Todos".
- Contador "X de Y já existem em outros eventos ativos. Z reimportar, W pular".
- Leads sem conflito não aparecem.
- Botão Continuar envia `telefones_skip` + `force_status_novo = true` para `process-import`.

Quando a RPC retorna vazio, **nada muda** na UX e `force_status_novo` não é enviado — cobre tanto "tudo novo" quanto "já existe só no mesmo evento ou em eventos encerrados".

### 2.4 Alteração na Edge Function `process-import`
Aceitar payload opcional adicional:
- `telefones_skip?: string[]`
- `force_status_novo?: boolean`

Comportamento:
- `const skipSet = new Set(telefones_skip ?? [])` e filtrar cada batch antes de enviar à RPC.
- Passar `p_force_status_novo` (default `false`) na chamada `rpc('bulk_upsert_contatos', …)`.
- Repassar ambos os campos no payload de **self-chaining** para sobreviver entre invocações.

Sem mudança nos call sites atuais → defaults preservam o comportamento.

### 2.5 Contadores
RPC inalterada. Frontend acrescenta `skipped_by_user = telefones_skip.length` ao resultado exibido.

### 2.6 QA Fase 2
- Importação sem conflitos: UX idêntica, sem tela extra, sem `force_status_novo`.
- Importação normal: status preservado exatamente como hoje.
- Conflitos em eventos ativos: tela aparece, defaults corretos, pulados não chegam à RPC.
- Reimportados: sem responsável → `Novo`; com responsável → `Atribuído`.
- Lead só em evento encerrado (snapshot feito **ou** `data_fim` passado sem cron) → entra direto.
- Reimport no mesmo evento → `already_linked`, status preservado.
- `telefones_skip` sobrevive ao self-chain.
- Pool DataLake continua igual (não envia `force_status_novo`).
- Auditoria: número de overloads de `bulk_upsert_contatos` **não aumentou**.

---

## Arquivos previstos

**Migrations (3 arquivos, na ordem):**
1. `…_evento_snapshot_leads_e_colunas_prospeccoes.sql` — tabela, índices, RLS, `ALTER prospeccoes`.
2. `…_encerrar_eventos_finalizados.sql` — função + `cron.schedule`.
3. `…_bulk_upsert_force_status_novo.sql` — `CREATE OR REPLACE FUNCTION bulk_upsert_contatos(...)` 4 params + novo `p_force_status_novo`; e `CREATE OR REPLACE FUNCTION preview_importacao_conflitos(...)`.

**Edge Function:**
- `supabase/functions/process-import/index.ts` — checagem de evento encerrado, suporte a `telefones_skip` e `force_status_novo`, propagação no self-chaining.

**Frontend:**
- Novo componente `src/components/import/ImportPreviewConflitos.tsx`.
- Hook/integração no fluxo de upload existente (`UploadPlanilha` ou equivalente do evento) para: bloquear se encerrado, chamar a RPC de preview em batches, exibir o componente quando houver conflitos, e repassar `telefones_skip` + `force_status_novo` ao invocar `process-import`.
- `useBulkImport`: aceitar e propagar os dois novos campos opcionais (sem alterar assinatura pública dos call sites atuais).

## Detalhes técnicos relevantes

- `evento_snapshot_leads.status` é `TEXT` de propósito — imune a futuras mudanças no enum `status_lead`.
- `DISTINCT ON (c.id)` no snapshot evita duplicatas vindas de múltiplas linhas em `eventos_prospeccao`.
- `FOR UPDATE SKIP LOCKED` torna o cron seguro contra execuções concorrentes.
- O `NOT EXISTS` no descarte usa a definição canônica de "evento ativo", garantindo que leads vivos em outros eventos não sejam descartados.
- Single overload de `bulk_upsert_contatos` mantido (memória do projeto: nada de overloads para evitar ambiguidade no PostgREST).
- RLS de `evento_snapshot_leads` segue o padrão `user_empresas` — leitura apenas; o cron roda como `SECURITY DEFINER` e não depende de RLS.
