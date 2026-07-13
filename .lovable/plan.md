
# Central de Webhooks (Administração → Webhooks)

Objetivo: eliminar URLs hard-coded. Toda edge function passa a ler a URL de uma tabela `webhook_registry`, e a nova tela Master permite editar, filtrar por categoria/agente e ver se a credencial exigida existe em Secrets.

## 1. Modelagem no banco

Migração cria:

- `webhook_registry`
  - `slug` (unique) — identificador estável usado no código, ex.: `paty.pos_vendas.busca_config`
  - `nome`, `descricao` (o que faz / pra que serve, mostrado na tela)
  - `categoria` — enum textual: `pos_vendas`, `whatsapp`, `ligacao`, `importacao`, `lead_movimentacao`, `optout`, `outros`
  - `agente` — nullable: `paty`, `pri_voz`, `pri_wpp`, `sistema`
  - `url` (nullable até ser configurada)
  - `metodo` (default POST), `ativo` (bool)
  - `credencial_secret_name` — nome do secret exigido (ex.: `SAGA_ONE`); nullable se não precisa
  - `credencial_header` — nome do header em que o proxy injeta (ex.: `saga_one_supabase`)
  - `owner_edge_function` — nome da edge function principal que consome (documental)
  - `last_used_at`, timestamps
- `webhook_registry_audit` — histórico de alterações (quem, quando, valor antigo/novo)
- Trigger `updated_at`
- RLS: SELECT/UPDATE apenas Master (`has_role(auth.uid(),'master')`); service_role total. Sem grant para anon.
- RPC `get_webhook_url(_slug text)` `SECURITY DEFINER` — edge functions chamam para resolver URL + validar ativo.
- Seed inicial com todos os slugs hoje hard-coded (varredura em `supabase/functions/**` + `ALLOWED_ENDPOINTS` do `external-webhook-proxy`).

## 2. Refactor das edge functions

Padrão único:

```ts
const { url, credencial_secret_name, credencial_header } =
  await resolveWebhook(supabase, "paty.pos_vendas.busca_config");
```

- Novo helper compartilhado `supabase/functions/_shared/webhook-registry.ts` com cache in-memory (60s) por invocação para não bater no banco a cada request.
- `external-webhook-proxy` deixa de ter `ALLOWED_ENDPOINTS` hard-coded: valida contra `webhook_registry.slug` + `ativo=true`.
- Cada edge function que hoje faz `fetch("https://automatemaia...")` passa a chamar `resolveWebhook(slug)`. Sem fallback hard-coded — se a URL não estiver cadastrada e ativa, retorna 424 com mensagem clara ("webhook <slug> não configurado em Administração → Webhooks").
- Credenciais continuam em Supabase Secrets. A edge lê `Deno.env.get(credencial_secret_name)` e injeta em `credencial_header`.

## 3. Registro automático de novos webhooks

- Convenção: qualquer nova edge function que precise chamar um webhook externo declara em um arquivo `supabase/functions/<name>/webhooks.json` com `[{ slug, categoria, agente, descricao, credencial_secret_name, credencial_header }]`.
- Edge function `sync-webhook-registry` (agendada + botão "Sincronizar" na tela) faz upsert por `slug` a partir desses manifests. `url` só é preenchida se ainda estiver null — nunca sobrescreve o que o Master configurou.
- Resultado: novo webhook adicionado ao código aparece automaticamente na tela após deploy + sync, exatamente como pedido.

## 4. Tela `/administracao/webhooks`

- Rota protegida por `PermissionProtectedRoute` com check `isMaster`.
- Layout:
  - Header com botão "Sincronizar do código" e busca.
  - Filtros: Categoria, Agente, Status (ativo/inativo), Credencial (ok/faltando).
  - Tabela: Nome · Slug · Categoria · Agente · URL (truncada) · Credencial (badge verde/vermelho lendo endpoint que consulta secrets) · Ativo · Ações.
  - Drawer de edição: nome, descrição, URL, método, ativo, categoria, agente. Slug e credential_secret_name são read-only (vêm do manifest).
  - Card explicativo do webhook (descrição) e "Última utilização".
- Verificação de credencial: edge function `check-webhook-credential` recebe `secret_name`, retorna `{ configured: boolean }` sem revelar valor. Frontend consulta em lote ao carregar.
- Botão "Configurar credencial" chama `secrets--update_secret` fluxo (link para Project Settings → Secrets) já que o valor não trafega pela UI.
- Toda alteração grava em `webhook_registry_audit`.

## 5. Migração de dados existentes

- Seed manual na primeira migração com todos os slugs conhecidos hoje:
  - Paty pós-vendas: `busca_config_pos`, `config_gerais`, `upsert_ranges`, `altera_status_pos_vendas`
  - Paty peças, entregas, cadência (endpoints já mapeados no `external-webhook-proxy`)
  - WhatsApp: envio, templates, pausa, status Meta
  - Ligação/PRI Voz: criar evento, cadência voz, sync custos
  - Movimentação lead Kanban, opt-out externo, process-import callbacks
- Cada seed já com `url`, `credencial_secret_name`, `credencial_header` atuais para não quebrar produção no momento do deploy.

## 6. Ordem de deploy (evitar quebra em prod)

```text
1. Migração: cria tabela + RLS + RPC + seed com URLs atuais
2. Deploy helper resolveWebhook + refactor edge functions (leem do banco, mas URL já está seedada)
3. Deploy tela /administracao/webhooks
4. Deploy sync-webhook-registry + manifests
```

Entre passo 1 e 2 nada muda em runtime — as URLs no banco são idênticas às que estavam hard-coded.

## 7. Fora de escopo

- Não edita valores de secrets pela tela (decisão do usuário: apenas badge de presença).
- Não faz override por empresa nesta primeira versão (decisão: globais).
- Não expõe a tela para Admin/TI (decisão: só Master).

## Detalhes técnicos

- `webhook_registry.slug` segue o padrão `<agente>.<categoria>.<acao>` para facilitar busca.
- Cache do helper: `Map<slug, {value, expiresAt}>` de 60s por instância de edge function (invalidação natural pelo cold start; aceitável para mudança de URL).
- RPC `get_webhook_url` retorna erro específico se `ativo=false` para que o front consiga distinguir "desabilitado" de "não cadastrado".
- Audit trail usa trigger `AFTER UPDATE` comparando `OLD`/`NEW`.
- Tela usa React Query com invalidação após save; sem realtime nesta versão.
