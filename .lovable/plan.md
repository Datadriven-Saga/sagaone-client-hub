# Continuação da documentação técnica — plano revisado

Correção: **Entra Dados** ≠ importação. É o hub em `/entra-dados` + `/de-para` (mapeamentos armazenados no bucket S3 `dados-custom-entradados` via Edge Function `de-para-s3`). A parte de importação (planilha, pool, `bulk_upsert_contatos`, `ingest-base-clientes`) fica em uma nova seção **Importação de Bases** — separada por ser fluxo diferente.

## Reestrutura do índice

- Renomear seção `Entra Dados` → **Entra Dados (hub /entra-dados e /de-para)**.
- Criar nova seção **Importação de Bases** no `docs/README.md` reunindo importação/planilha/pool/ingest/bulk_upsert.
- Mover `docs/entra-dados/importacao-pool.md` → `docs/importacao/importacao-pool.md`.
- Mover `status-ingest-base-clientes*.md` (raiz do repo) → `docs/importacao/ingest-base-clientes.md` consolidando as duas versões.

## Fase 2c — Entra Dados (novo escopo, correto)

Criar em `docs/entra-dados/`:

- `visao-geral.md` — o que é o hub `/entra-dados`, tipos (Base, Tabela, De-Para), KPIs, estado atual (grid mockado + navegação para /de-para; "Nova base" ainda não implementado).
- `de-para.md` — como funciona `/de-para`:
  - Modelo `{ name, pairs: [{ origem, destino }] }` gravado em `de-para/<nome>.json` no bucket S3 `dados-custom-entradados`.
  - Ações da Edge Function `de-para-s3` (`list`, `get`, `save`) — payloads, autenticação, permissões.
  - Consumo: quem lê esses arquivos (n8n / pipelines externas — marcar TODO se não confirmado).
  - Regras de nomeação e limites.
  - Troubleshooting (erro ao listar/salvar, credenciais AWS).
- Atualizar `docs/README.md` desta seção.

## Fase 2c-bis — Importação de Bases (a parte "também importante")

Criar em `docs/importacao/`:

- `visao-geral.md` — pontos de entrada (Planilha, Pool/DataLake, `ingest-base-clientes`, `create-lead-pri`) e fluxo comum → `bulk_upsert_contatos` → `import_logs`/`bases_importadas`/quarentena.
- `importacao-planilha.md` — `UploadPlanilha`, bucket `import-files`, `process-import`, self-chaining, colunas aceitas.
- `importacao-pool.md` — mover do lugar atual.
- `ingest-base-clientes.md` — consolidar status v1+v2 (cobertura 1 ano, jobs, RPCs).
- `bulk-upsert-contatos.md` — regras críticas conforme project-knowledge: nunca alterar de primeira, testes obrigatórios, overload, `SECURITY DEFINER`, integração `upsert_quarentena`, índice parcial `contato_quarentena`.

## Fase 2d — Recepção, Administração e Resultados

Recepção:
- `recepcao/visao-geral.md`, `recepcao/busca-sufixo-telefone.md`, `recepcao/vendedor-atendimento.md`.

Administração:
- `administracao/visao-geral.md`, `feature-flags.md`, `mfa-vault.md`, `quarentena-manual.md`, `logs-disparos.md`, `monitor-disparos-nacional.md`.

Resultados:
- `resultados-e-relatorios/visao-geral.md`, `relatorio-convidados.md`, `dashboards.md`.

## Fase 2e — Arquitetura & APIs

Arquitetura:
- `visao-geral.md`, `multi-tenant.md`, `autenticacao-e-sessao.md`, `permissoes-e-rbac.md`, `webhooks-e-integracoes.md`, `performance.md`.

APIs públicas:
- `apis/create-lead.md`, `apis/create-lead-ligacao.md`, `apis/search-lead.md`, `apis/webhooks-recebidos.md` (`template-paused-webhook`, `ia-ligacao-webhook`, `atendimento-status-webhook`, `confirm-presence`).

## Fase 3 — Manual do Usuário

`docs/operacoes/manual-do-usuario/`:
- `README.md` + capítulos por perfil (Recepcionista, SDR, Vendedor, Gestor, Admin) consumindo a seção **Fluxo funcional** de cada doc técnico.

## Manutenção contínua

- Cada arquivo criado → remover `*(pendente)*` do `docs/README.md`.
- Remover `status-ingest-base-clientes*.md` da raiz após migrar.
- Consolidar `documents/notificacoes.md` duplicado.
- Sem alteração de código de aplicação nesta trilha; apenas docs + movimentação de arquivos existentes.

## Pergunta antes de executar

Executo **tudo em sequência** (2c + 2c-bis → 2d → 2e → 3) ou entrego **fase a fase** para você revisar entre elas?
