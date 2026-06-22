
## Resposta direta

**Não dá para afirmar quem desvinculou** porque a tabela `logs_prospeccoes` está vazia, não há trigger de auditoria em `public.prospeccoes`, e os logs da edge function não estão mais retidos. Mas restringindo às coisas que tecnicamente conseguem zerar `template_prospeccao_id`, o universo é pequeno (confirmei lendo todo o código):

```text
1) src/components/CriarProspeccaoModal.tsx  (UI de edição)
   - Linha 1411: seta o valor escolhido no select (não-nulo em IA Whatsapp).
   - Linha 1465: zera apenas se trocar tipoEvento para algo != IA Whatsapp.
   - Validação obrigatória no front impede salvar IA Whatsapp sem template.

2) src/pages/prospeccao/EventoBase.tsx → handleReplaceTemplate
   - Só seta valor não-nulo.

3) supabase/functions/template-paused-webhook/index.ts (linha 354)
   - UPDATE prospeccoes SET <campo>=NULL, disparos_pausados=true
     WHERE <campo> = template.id (e canal ILIKE '%whatsapp%').
   - É o ÚNICO caminho do código que zera o campo via NULL.

NÃO existe nenhuma função SQL/trigger no banco que toque em template_prospeccao_id
(varredura em pg_proc.prosrc e pg_trigger confirmou).
```

E o estado do template é compatível:
- `feirao_copa_hyundai` (id `533ed363…`, `id_meta=1329425459327034`) está `APPROVED` e `ativo=true`.
- Não há `template_pausado_log` para essa empresa nem esse `id_meta`.
- A prospeccao tem `template_agendado_id` preenchido → por isso o auto-release zerou `disparos_pausados` e a UI de "template pausado" nunca apareceu.

### Hipóteses, em ordem de probabilidade

```text
A) template-paused-webhook em VERSÃO ANTERIOR (sem o lock atômico do STEP 1
   atual) rodou para o id_meta=1329425459327034, zerou os 5 TEMPLATE_FIELDS
   da prospeccao e a Meta depois re-aprovou o template (voltou para APPROVED).
   Como a versão antiga não inseria template_pausado_log na entrada, não há
   rastro. É a hipótese mais provável porque é o ÚNICO caminho do código
   atual que zera o campo.

B) Lambda externa / n8n com SERVICE_ROLE_KEY fazendo UPDATE direto via
   PostgREST sem passar pelo SagaOne. Tecnicamente possível, sem rastro.

C) Comando SQL ad-hoc (migration/Supabase Studio) executado por humano.
   Sem auditoria, indetectável.
```

Sem auditoria persistente, ficamos em hipótese forte, não em conclusão. Por isso o plano inclui ligar a auditoria **antes** de qualquer outra mudança — para o próximo caso ser determinístico.

---

## Plano

### 1. Auditoria forense em `public.prospeccoes` (causa raiz da "não temos logs")
Migration com trigger `AFTER INSERT OR UPDATE OR DELETE` em `prospeccoes` gravando em `logs_prospeccoes`:

- Só grava quando algum campo sensível mudar:
  ```text
  template_prospeccao_id, template_agendado_id, template_nao_agendado_id,
  template_agendado_48h_id, template_agendado_24h_id,
  disparos_pausados, ativo, event_id_pri, canal,
  data_inicio, data_fim, evento_confirmacao, snapshot_realizado
  ```
- `acao`:
  - `'desassociacao_template'` se algum `template_*_id` virou NULL.
  - `'edicao_evento'` caso contrário.
- `dados_anteriores` / `dados_novos`: jsonb só com os campos alterados.
- `usuario_id` / `usuario_email` / `usuario_nome`:
  - via `auth.uid()` + `profiles` quando vier de sessão de usuário.
  - quando vier de service_role, gravar no `detalhes`:
    ```text
    {
      "source": "service_role",
      "application_name": current_setting('application_name', true),
      "client_ip": coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
      "user_agent": current_setting('request.headers', true)::json->>'user-agent',
      "function_caller": current_setting('request.headers', true)::json->>'x-supabase-edge-function'
    }
    ```
- Trigger é `SECURITY DEFINER` para sempre conseguir inserir.
- Adicionar `GRANT INSERT ON public.logs_prospeccoes TO authenticated, service_role` se faltar.
- Backfill explícito: marcar este caso (`prospeccao_id=0dc6e182…`, `template_prospeccao_id virou NULL em data desconhecida`) com uma linha de auditoria histórica `acao='desassociacao_template_historico'`, `detalhes={"origem":"investigacao_manual_2026-06-22"}`.

### 2. Endurecer template-paused-webhook (evitar repetição da hipótese A)
- Garantir que o **STEP 1 (lock) já existe no código atual** (confirmado). Adicionar **log persistente** numa nova tabela `template_pausado_audit` (não só `template_pausado_log`) que registra **TODA invocação** do webhook, com:
  - `id_meta` recebido, timestamp, request_id, IP, payload bruto.
  - status final.
  - Mesmo se nenhum template for encontrado.
- Assim, mesmo se a Lambda chamar com `id_meta` inexistente, fica o rastro.

### 3. UI: tratar "template ausente" mesmo com `disparos_pausados=false`
Em `EventoBase.tsx`:
- Para canal WhatsApp IA, se `template_prospeccao_id` for NULL, considerar **estado "template ausente"** (independente do flag).
- Banner amarelo no topo: "Este evento está sem template de prospecção." + reaproveitar o `<Select>` de `availableTemplates` (linhas 492–520) e o `handleReplaceTemplate` (linhas 522–565).
- Ajustar `handleReplaceTemplate` para preencher **especificamente** `template_prospeccao_id` quando o motivo for "ausente em WhatsApp IA" (hoje pega `nullFields[0]`, que pode ser outro campo).
- Pré-checagem em `handleDispararIndividual` (linhas 1840–1923): replicar o bloqueio amigável que `handleRedispararContato` já faz (linhas 1962–1972).

### 4. Endurecer auto-release
`EventoBase.tsx:470` — trocar a regra de `hasValidTemplate`:
- Hoje: `template_prospeccao_id || template_agendado_id || template_nao_agendado_id`.
- Novo, para WhatsApp IA: **exigir `template_prospeccao_id` não-nulo** para liberar `disparos_pausados`. Sem isso o evento permanece pausado e o seletor de substituição aparece.

### 5. Toast amigável para erros do dispatch
- Novo helper `src/lib/dispatchErrors.ts` com `mapDispatchError(error)` → `{ title, description }`.
- Mapear substrings conhecidas do `dispatch-leads-webhook`:
  - "template de prospecção" → `Template ausente` / `Edite o evento e selecione um template de prospecção do WhatsApp antes de disparar.`
  - "event_id_pri" → `Identificador do evento ausente` / `O evento não foi sincronizado com a PRI. Reabra e salve o evento para gerar o identificador.`
  - "agente" → `Agente não configurado` / `Vincule um agente de WhatsApp ativo a esta empresa.`
- Aplicar em `EventoBase.tsx` (1916–1922 e 2008–2012) e `useContatoData.ts:2058`.

## Fora de escopo
- Reescrita do `CriarProspeccaoModal`.
- Backfill automático do `template_prospeccao_id` desse evento (o usuário deve escolher via UI nova).
- Alterar `template-paused-webhook` STEP 2–6 (já validado em prod).

## Aceite
- Banco: ao alterar `template_prospeccao_id` de qualquer evento (via UI ou edge), nasce linha em `logs_prospeccoes` com `dados_anteriores`/`dados_novos` e identificação (usuário ou service_role + função chamadora).
- UI: ao abrir o evento HYUNDAI CBA / event_id_pri=1082, aparece banner amarelo com Select; salvar grava `template_prospeccao_id` corretamente.
- Disparar individual sem template mostra `Template ausente` (não a string crua).
- Auto-release não libera mais eventos WhatsApp IA com `template_prospeccao_id` NULL.
- Próxima invocação de `template-paused-webhook` (inclusive com `id_meta` inválido) deixa rastro em `template_pausado_audit`.
