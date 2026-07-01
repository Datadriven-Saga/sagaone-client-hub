# Glossário

> Última revisão: 2026-07-01

Referência rápida dos termos usados no SagaOne. Sempre que um documento introduzir um termo próximo a um destes, linkar para cá.

## Domínio

- **Empresa** — Loja/concessionária. Unidade de tenant. Isolamento estrito por `empresa_id` em quase todas as tabelas.
- **Empresa ativa** — Empresa selecionada no `CompanyContext`. Todos os filtros de tela são relativos a ela.
- **Marca** — Bandeira/fabricante (Hyundai, Nissan, Toyota, GM, ...). Uma empresa tem uma marca; quarentena e opt-out podem ser por marca.
- **Cadeira** — Assento/licença vendida ao cliente. Terceiros logam consumindo cadeiras. Ver `docs/administracao/empresas-e-cadeiras.md`.
- **Terceiro / DP** — Usuário externo (parceiro, concessionária externa) autenticado via `LoginTerceiros`, sem SSO Azure.

## Prospecção

- **Prospecção** — Registro-mãe em `prospeccoes`: contém template WhatsApp, canal (Mensal / Grande Evento / Ligação), datas, cadência.
- **Evento** — Sinônimo funcional de "prospecção" na fala do usuário; no banco é a linha em `prospeccoes`.
- **Evento de Prospecção** — Linha em `eventos_prospeccao` — o **vínculo** entre um contato e uma prospecção (não confundir com a prospecção em si). Também armazena histórico/interações desse lead naquela prospecção.
- **Contato / Lead** — Pessoa em `contatos`. Um contato pode estar em várias prospecções (vínculos em `eventos_prospeccao`).
- **Kanban** — Tela `/prospeccao/atendimento`. Colunas são o `contatos.status` (global — débito arquitetural conhecido).
- **Status** — Novo → Atribuído → Contatado → Em Espera → Convidado → Check-in → Venda / Descartado.
- **Cadência** — Sequência automática de mensagens WhatsApp (`agente_cadencias`, `agente_cadencias_steps`).
- **Disparo** — Envio de mensagem em massa. Pode ser *imediato* (`campaign_batches.lot_index IS NULL`) ou *agendado* (com `lot_index`).
- **Job / Batch** — `campaign_jobs` é o disparo; `campaign_batches` são os lotes de contatos que compõem o job.
- **SDR** — Vendedor interno que trabalha leads antes de repassar. Tem lock de 30 leads em atendimento (ver `docs/prospeccao/atribuicao-sdr.md`).
- **Pri IA** — Usuário sistêmico (`PRI_IA_USER_ID`) que assina ações automáticas. Excluído de webhooks Mobi para não vazar automação.

## Compliance

- **Quarentena** — Bloqueio de telefone por marca/canal com prazo. Tabela `contato_quarentena`. Índice parcial exige `upsert_quarentena`.
- **Opt-out global** — `global_opt_outs`: telefone não recebe mais nada, em nenhuma empresa.
- **Opt-out externo** — `external_optout_entries` + `external_optout_snapshots` (snapshot diário para conferência histórica).
- **Compliance bypass** — Flag `empresas.bypass_compliance` (uso restrito a colaboradores internos) desliga todos os bloqueios.

## Pós-Vendas

- **Paty** — Assistente de pós-vendas. Templates ficam em `whatsapp_templates` com escopo pós-vendas.
- **Peças** — Módulo de gatilhos para venda de peças. `pos_vendas_gatilho_config`, `pos_vendas_lojas`.
- **Entregas** — Módulo de gatilhos para entrega de veículos. 7 slugs fixos, suporta múltiplos templates por gatilho (sequência).
- **Gatilho** — Regra que dispara mensagem a partir de um evento no Mobi (ex.: peça chegou, entrega agendada).
- **Slug** — Identificador estável do gatilho (usado nos webhooks n8n).

## Entra Dados

- **Planilha** — Importação manual XLSX/XLS/CSV via `UploadPlanilha` → `process-import` → `bulk_upsert_contatos`.
- **Pool / DataLake** — Base de clientes agregada nacional (`pool_clientes_externos`), populada por `ingest-base-clientes`. Segmentável.
- **Segmentação** — `pool_segmentacoes`: filtros salvos usados para importar do pool.
- **`bulk_upsert_contatos`** — RPC crítica. Dedup por `(empresa_id, telefone_normalizado)`. Ver regras em `docs/entra-dados/bulk-upsert-contatos.md`.

## Recepção

- **Check-in** — Registro de presença de um lead no evento. Trigger PG dispara webhook Mobi.
- **FAB** — Botão flutuante global de check-in no `DashboardLayout`.
- **QR** — Rota pública `/recepcao` para check-in por leitura de QR.
- **Sufixo** — Últimos 4 dígitos do telefone; busca via `buscar_contatos_por_sufixo_telefone`.

## Administração

- **Master** — Papel supremo (auditoria, MFA vault, cross-empresa). Configurado em `mfa_master_users`.
- **Admin / TI** — Departamentos com acesso administrativo. TI historicamente tem bypass para Agentes IA (ver RBAC).
- **Controle de Acessos** — `departamento_permissoes` (legado) + `PermissionRegistry` (front). Em migração para RBAC fine-grained.
- **Feature Flag** — `system_feature_flags` (global) + `feature_flag_empresas` (per-empresa).
- **Vault MFA** — Cofre AES-256 (`mfa_password_vault`) com acesso por `mfa_account_access`.

## Infra / plataforma

- **Edge Function** — Função Deno no Supabase (`supabase/functions/**`). Timeout ~25s.
- **RPC** — Função PL/pgSQL exposta via PostgREST. Muitas são `SECURITY DEFINER`.
- **RLS** — Row-Level Security. Padrão: filtrar por `user_can_access_empresa(empresa_id, auth.uid())`.
- **`pg_net`** — Extensão usada por triggers PG para invocar Edge Functions de forma assíncrona.
- **`SAGA_ONE_ADMIN_TOKEN`** — Token de entrada (webhooks/APIs públicas para o SagaOne).
- **`SAGA_ONE`** — Token de saída (chamadas do SagaOne para o Mobi/SagaOne externo).
- **`saga_one_supabase`** — Header custom usado pelo `trigger-webhook` para autenticar contra o Mobi.