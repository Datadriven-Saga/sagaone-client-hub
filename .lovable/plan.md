## PR 0 — Fundação para migrar mutações de `contatos.status` à edge

Objetivo: deixar a edge `prospeccao-status`, o wrapper de front e o trigger defensivo prontos **antes** de tocar qualquer call site (PRs 1-4). Nada de comportamento muda nesta etapa — apenas habilitamos os trilhos.

---

### 0.1 Decisões incorporadas vs plano anterior

| Tópico | Mudança |
|---|---|
| Webhook | **Síncrono com timeout de 15 s** (não fire-and-forget). Status + log são sempre persistidos; `webhook_status` vai no response. |
| Dedup do trigger | Troca janela de 2 s por **flag de sessão** (`app.status_change_logged`) setada pela rota que loga explicitamente. |
| Backfill dos 28 k | **Descartado**. Trigger defensivo cuida do fluxo futuro. Query fica documentada aqui para uso oportunista. |
| `confirm-presence` | **Fora do escopo** (igual ao item E). Endpoint público, fluxo próprio, coberto pelo trigger. |
| 9.708 "Atribuído" sem log | Origem confirmada: RPC `auto_atribuir_leads_vendedor` (chamada em `useAutoAtribuirLeads.ts:109`) faz UPDATE em massa sem inserir log. Trigger defensivo passará a cobrir. **Não migrar a RPC nesta rodada.** |

---

### 0.2 Mudanças na edge `prospeccao-status`

#### Novo contrato (body, todos opcionais exceto `novo_status`)

```jsonc
{
  "novo_status": "convidado",          // já existente
  "prospeccao_id": "uuid|null",        // NOVO — front sempre envia; n8n pode omitir
  "observacoes": "string|null",        // NOVO — contexto humano para o log
  "skip_webhooks": false,              // NOVO — pula trigger-webhook + movimentacao_lead_kanban
  "webhook_kind": "criacao_lead" | "atualizacao_status" | null // NOVO — controla timeout/parse
}
```

`lead_id` continua na query string. Auth permanece igual (JWT do usuário ou admin token).

#### Novo response (sempre 200 se o `UPDATE` foi feito)

```jsonc
{
  "success": true,
  "lead_id": 123,
  "contato_id": "uuid",
  "prospeccao_id": "uuid|null",
  "status_anterior": "Atribuído",
  "status_novo": "Convidado",
  "status_recebido": "convidado",
  "updated_at": "2026-05-19T12:00:00Z", // NOVO — front reconcilia optimistic
  "agente_ia": ["pri"],                  // NOVO — quando admin token
  "webhook_status": "ok|skipped|failed|timeout|not_invoked", // NOVO
  "webhook_error": "string|null",        // NOVO — debug
  "codigo_proposta": "string|null"       // NOVO — extraído da resposta do webhook quando webhook_kind='criacao_lead'
}
```

Erros 4xx/5xx **só** quando o UPDATE não acontece (contato não existe, status inválido, RLS, exceção no INSERT do log). Falha de webhook **nunca** vira 5xx.

#### Ordem de execução na edge

1. Auth + resolve contato (igual hoje).
2. **`prospeccao_id` final:** se vier no body, usa; senão fallback `eventos_prospeccao ORDER BY created_at DESC LIMIT 1` (frágil, mas só atinge n8n legado).
3. `UPDATE contatos` (status, updated_at). Falhou → 500.
4. `add_agente_ia('pri')` se admin (igual hoje).
5. `INSERT logs_movimentacao_contatos` com `observacoes` recebida (fallback para texto antigo). Antes do INSERT executa `SELECT set_config('app.status_change_logged','true', true)` na mesma conexão para sinalizar o trigger (ver 0.4).
6. Se `skip_webhooks=true` → `webhook_status='skipped'`, retorna.
7. Senão chama `trigger-webhook` em **Promise.race com AbortController de 15 s**:
   - `webhook_kind='criacao_lead'`: aguarda payload, parseia `codigo_proposta`, faz `UPDATE contatos SET codigo_proposta` se vier preenchido, retorna `webhook_status='ok'` + `codigo_proposta`.
   - `webhook_kind='atualizacao_status'`: aguarda payload, retorna `ok`.
   - timeout → aborta, `webhook_status='timeout'`.
   - exceção → captura, `webhook_status='failed'`, `webhook_error=err.message`.
8. Disparo paralelo de `movimentacao_lead_kanban` (humanos) também dentro do try/catch — não bloqueia o `webhook_status` principal.
9. Retorna 200 sempre que chegou aqui.

#### Retry de webhook (desenho, sem implementar agora)

Opções avaliadas:

| Opção | Esforço | Confiabilidade | Observação |
|---|---|---|---|
| **A — Coluna `webhook_status` + `pg_cron` a cada 5 min** | médio | alta | Adicionar `contatos.webhook_status text` (`'pending'\|'ok'\|'failed'`) + `webhook_attempts int`. `pg_cron` chama edge `retry-webhooks` que processa lotes de 50, max 3 tentativas, depois marca `failed` e operador trata. Reaproveita infra existente (`pg_cron` já habilitado). |
| B — Fila dedicada (`pgmq` ou tabela `webhook_jobs`) | alto | alta | Mais limpo arquiteturalmente, mas exige nova tabela + worker. Overkill para o volume atual. |
| C — Sem retry, operador refaz manual | baixo | baixa | Aceitável só se taxa de falha <0,5 %. Não temos métrica para confirmar. |

**Recomendação:** começar com (C) no PR 0 (apenas registrar `webhook_status='failed'` no response, sem persistir), e medir taxa real durante 1 semana. Se >0,5 % falham, implementar (A) num PR posterior.

#### Outras tarefas na edge

- Sanity: garantir `Deno.env.get('SUPABASE_ANON_KEY')` continua presente (necessário para o caller JWT).
- Adicionar teste Deno cobrindo:
  - body com `prospeccao_id` explícito vs fallback;
  - `skip_webhooks=true` retornando `'skipped'`;
  - webhook que demora >15 s retornando `'timeout'` em <16 s;
  - status inválido → 400 sem tocar no banco.

---

### 0.3 Wrapper de front: `setContatoStatus`

Arquivo novo: `src/lib/contatoStatusApi.ts`.

```ts
export type SetContatoStatusInput = {
  contatoId: string;           // uuid
  novoStatus: ContatoStatus;   // enum tipado do supabase types
  prospeccaoId?: string;       // sempre passado quando conhecido
  observacoes?: string;
  skipWebhooks?: boolean;      // default false
  webhookKind?: 'criacao_lead' | 'atualizacao_status' | null;
};

export type SetContatoStatusResult = {
  ok: boolean;
  statusNovo: ContatoStatus;
  updatedAt: string;
  webhookStatus: 'ok' | 'skipped' | 'failed' | 'timeout' | 'not_invoked';
  codigoProposta?: string | null;
  error?: string;
};

export async function setContatoStatus(input: SetContatoStatusInput): Promise<SetContatoStatusResult>
```

Comportamento:
- Chama `supabase.functions.invoke('prospeccao-status', { body, method: 'PUT' })` passando `lead_id=<uuid>` na query (o invoke da SDK aceita `headers`/`body`; caso `invoke` não suporte query, usar `fetch` direto com a URL completa montada via `import.meta.env.VITE_SUPABASE_URL`).
- Sempre usa o JWT do usuário (anon key + token automático da SDK). **Nunca** passa admin token.
- `ok=false` apenas quando a edge retorna 4xx/5xx ou rede caiu (UPDATE não foi feito → safe para rollback).
- `webhookStatus='timeout'\|'failed'` ⇒ `ok=true`, front mostra toast informativo "Status atualizado. Integração externa pendente.".
- Não toca em `setContatos` local — quem chama decide (mantém otimismo dos callers atuais).

Documentar no JSDoc: "Único ponto autorizado de mutação de `contatos.status` no front. Direct `.update({status})` é proibido."

---

### 0.4 Trigger defensivo com flag de sessão

#### Viabilidade do `SET LOCAL` via PostgREST/supabase-js

- PostgREST não expõe `BEGIN/SET LOCAL/COMMIT` em chamadas REST. `supabase.from().update()` é uma transação implícita curta.
- `SET LOCAL` só funciona se o INSERT do log estiver na **mesma transação** do UPDATE — impossível para `.update()` puro do front.
- **Solução adotada:** a edge (que controla a conexão via `supabase-js` server-side) executa `set_config('app.status_change_logged','true', true)` **antes** do INSERT do log. O 3º argumento `true` torna o valor *local à transação*. Mas como cada chamada do client é uma transação separada, usamos uma RPC `log_status_change_atomic(p_contato, p_anterior, p_novo, ...)` que faz `SET LOCAL` + `INSERT` na mesma função, garantindo que o `UPDATE` (que vem depois, na próxima statement) seja visto pelo trigger SEM a flag (e dispare o fallback) — o que **inverte** a lógica.

#### Implementação correta (revisada)

Como UPDATE e INSERT do log estão em statements separados (não dá para unir sem reescrever a edge para uma única RPC), inverter:

1. Criar RPC `mutate_contato_status_atomic(p_contato uuid, p_novo text, p_anterior text, p_prospeccao uuid, p_usuario uuid, p_obs text)` em PL/pgSQL `SECURITY INVOKER` (respeita RLS):
   ```sql
   BEGIN
     PERFORM set_config('app.status_change_logged','true', true);
     UPDATE contatos SET status=p_novo::status_lead, updated_at=now() WHERE id=p_contato;
     INSERT INTO logs_movimentacao_contatos(...) VALUES (...);
   END
   ```
2. Edge passa a chamar `supabase.rpc('mutate_contato_status_atomic', ...)` em vez de `.update()` + `.insert()` separados. Tudo na mesma transação.
3. Trigger:
   ```sql
   CREATE OR REPLACE FUNCTION public.log_contato_status_change()
   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
   DECLARE v_prosp uuid;
   BEGIN
     IF NEW.status IS DISTINCT FROM OLD.status
        AND coalesce(current_setting('app.status_change_logged', true), 'false') <> 'true'
     THEN
       SELECT prospeccao_id INTO v_prosp FROM eventos_prospeccao
         WHERE contato_id=NEW.id ORDER BY created_at DESC LIMIT 1;
       INSERT INTO logs_movimentacao_contatos
         (contato_id, prospeccao_id, status_anterior, status_novo, usuario_id, observacoes)
       VALUES (NEW.id, v_prosp, OLD.status::text, NEW.status::text, auth.uid(),
               'auto-trigger (fallback de migração)');
     END IF;
     RETURN NEW;
   END $$;

   CREATE TRIGGER trg_log_contato_status
   AFTER UPDATE OF status ON contatos
   FOR EACH ROW EXECUTE FUNCTION log_contato_status_change();
   ```
4. Call sites **não migrados** (front fazendo `.update()` direto) continuam sem setar a flag → trigger loga ✓. Call sites migrados via edge passam pela RPC → trigger silencia ✓. Sem heurística temporal.
5. Admin token (service_role) também passa pela RPC → flag setada → trigger silencia. Log da edge cobre. ✓
6. RPC backend `auto_atribuir_leads_vendedor`: continua não setando a flag → trigger loga em massa por linha tocada. ⚠️ Acompanhar volume; se gerar muitos `auto-trigger` em uma única execução, considerar setar a flag dentro dessa RPC também e adicionar log explícito.

Trigger e RPC vão como **migration** no PR 0. Remoção é PR final do épico.

---

### 0.5 Exceções documentadas (fora do escopo desta rodada)

| Caller | Por que fica de fora | Cobertura | Plano futuro |
|---|---|---|---|
| **Import em massa de Check-in** (`useRecepcaoData` linha 786, loop) | N chamadas à edge = N cold-starts + N webhooks. Sem ganho proporcional ao risco. | Trigger defensivo loga cada UPDATE; webhook do operador fica sem disparo síncrono. | Avaliar endpoint batch `prospeccao-status-bulk` em ciclo futuro. |
| **`confirm-presence`** (edge pública sem JWT) | Fluxo público (link de confirmação), sem usuário autenticado. Já loga manualmente quando tem `prospeccao_id`. | Trigger defensivo cobre o UPDATE caso o INSERT manual falhe. | Manter como está; refatorar só se padrão de log mudar. |
| **`auto_atribuir_leads_vendedor`** (RPC SQL) | RPC server-side de massa; reescrever exige análise de performance. | Trigger defensivo logará cada linha. | Adicionar `set_config('app.status_change_logged','true', true)` + INSERT em batch dentro da própria RPC num PR dedicado. |

---

### 0.6 Backfill — **NÃO executar**

Decisão: 28 k registros sintéticos poluem dashboards mais do que informam. Query fica arquivada aqui para resgate oportunista:

```sql
-- NÃO EXECUTAR. Mantido apenas como referência.
INSERT INTO logs_movimentacao_contatos
  (contato_id, prospeccao_id, status_anterior, status_novo, usuario_id, observacoes, data_movimentacao)
SELECT c.id,
       (SELECT prospeccao_id FROM eventos_prospeccao ep
          WHERE ep.contato_id=c.id ORDER BY ep.created_at DESC LIMIT 1),
       NULL, c.status::text, NULL,
       'BACKFILL: estado reconstruído — histórico real indisponível',
       COALESCE(c.updated_at, c.created_at)
FROM contatos c
WHERE c.status <> 'Novo'
  AND NOT EXISTS (SELECT 1 FROM logs_movimentacao_contatos l WHERE l.contato_id=c.id);
```

---

### 0.7 Ordem de execução do PR 0

1. Migration: criar RPC `mutate_contato_status_atomic` + trigger `trg_log_contato_status` + função `log_contato_status_change`.
2. Atualizar edge `prospeccao-status` para usar a RPC + novos campos de body/response + timeout + parse de `codigo_proposta`. Adicionar testes Deno.
3. Criar `src/lib/contatoStatusApi.ts` (wrapper) — sem consumir em nenhum call site ainda.
4. Deploy edge + verificar logs.
5. Smoke test manual com o wrapper em um contato de teste em ambiente sandbox.

Nenhum call site existente é tocado neste PR.

---

### 0.8 Checklist de validação antes de liberar PRs 1-4

- [ ] Migration aplicada; trigger ativo em produção.
- [ ] `SELECT * FROM pg_trigger WHERE tgname='trg_log_contato_status'` retorna 1 linha enabled.
- [ ] Teste manual: `UPDATE contatos SET status='Em Espera' WHERE id=<test>` direto via SQL → 1 novo log com `observacoes='auto-trigger (fallback de migração)'` ✓.
- [ ] Teste manual: chamada à edge `PUT /prospeccao-status` (com JWT) → 1 log com observação customizada, **sem** linha auto-trigger.
- [ ] Teste manual: chamada à edge com webhook que demora 20 s → response em ~15 s com `webhook_status='timeout'`, status persistido.
- [ ] Teste manual: chamada à edge com `webhook_kind='criacao_lead'` → `codigo_proposta` preenchido em `contatos` e no response.
- [ ] Wrapper `setContatoStatus` exportado e tipado, mas zero imports no código de produção.
- [ ] Métricas: instrumentar logs da edge para registrar `webhook_status` (base para decidir retry no futuro).
- [ ] 48 h em produção sem aumento anômalo de `logs_movimentacao_contatos` (esperado: leve crescimento por causa do trigger pegando `auto_atribuir_leads_vendedor`; quantificar).
- [ ] Documentar no README do projeto/`mem://` que `.from('contatos').update({status})` é proibido a partir do PR 1.

Cumpridos todos os itens, libera-se a migração incremental B → D → C → A conforme plano anterior.