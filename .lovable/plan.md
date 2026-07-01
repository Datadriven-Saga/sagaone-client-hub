# Plano — Reorganização e expansão da documentação técnica

## Objetivo
Consolidar toda documentação do sistema em `/docs`, organizada por área/módulo, servindo como base tanto para referência técnica quanto, futuramente, para um manual do usuário.

## Situação atual
`/docs` tem 15 arquivos soltos, misturando fluxos (check-in, disparo WPP, template pausado), análises (login terceiros, dispatcher), APIs (create-lead-pri) e planos (RBAC breaking changes, inventariado). Não há índice, taxonomia, nem cobertura de: Prospecção (Kanban, atribuição SDR, quarentena), Performance (Kanban server-side, RPCs), Pós-Vendas (Peças, Entregas, Cadência, Agendamentos), Entra Dados (upload planilha, pool, ingest-base-clientes), Recepção QR, Administração (feature flags, MFA, controle acessos, quarentena, logs disparos), Resultados/Relatórios, Agentes IA e Cadeiras. Muito conhecimento vive apenas em `.lovable/memory/**`.

## Nova estrutura de `/docs`

```text
docs/
  README.md                          # índice mestre + convenções + como navegar
  glossario.md                       # termos: evento, prospecção, cadeira, gatilho, etc.
  arquitetura/
    visao-geral.md                   # stack, multi-tenant, auth, edge functions, RLS
    multi-tenant.md                  # empresa ativa, user_empresas, RLS pattern
    autenticacao-e-sessao.md         # Azure SSO, terceiros, 8h/1h idle, deep-link
    permissoes-e-rbac.md             # inventariado + registry + previsão BC (merge)
    webhooks-e-integracoes.md        # trigger-webhook, external-proxy, tokens
    performance.md                   # kanban server-side, RPCs, timeouts 57014
  prospeccao/
    visao-geral.md                   # eventos, cadeiras, kanban, SDR, cadeias
    kanban-e-status.md               # status global (débito), multi-select, filtros
    atribuicao-sdr.md                # lock 30 leads, equipes, visibility rules
    quarentena.md                    # canal/marca, opt-out global/externo
    dispatch-whatsapp.md             # (move fluxo-disparo-whatsapp.md aqui)
    template-pausado.md              # (move fluxo-template-pausado.md aqui)
    recuperacao-jobs-orfaos.md       # (move)
    correcao-dispatcher.md           # (move correcao-dispatcher-disparos-programados)
    ia-ligacao.md                    # dashboard, cost, sync Vapi/Twilio
    logs-disparos.md                 # origem edge_function vs frontend, USD/BRL
    auditoria.md                     # logs_prospeccoes, trigger de auditoria
  pos-vendas/
    visao-geral.md                   # Peças / Entregas / Agendamentos / Paty
    pecas.md                         # gatilhos, lojas, templates externos n8n
    entregas.md                      # 7 slugs, multi-template, sequência
    paty-templates.md                # (merge paty-templates-variaveis.md)
    cadencia.md                      # cadence config e intervalos
    agendamentos.md
  entra-dados/
    visao-geral.md                   # planilha vs pool vs API
    importacao-planilha.md           # UploadPlanilha → process-import → bulk_upsert
    importacao-pool.md               # (move fluxo-importacao-pool.md)
    ingest-base-clientes.md          # status report atual (merge dos v1/v2)
    bulk-upsert-contatos.md          # regras críticas (project-knowledge)
  recepcao/
    visao-geral.md                   # FAB / QR / Kanban
    fluxo-checkin.md                 # (move fluxo-checkin-recepcao.md)
    busca-sufixo-telefone.md         # RPC 4 dígitos
    vendedor-atendimento.md          # novo campo enviado ao Mobi
  administracao/
    visao-geral.md
    controle-acessos.md              # (merge controle-acessos + auxiliar-detalhado + inventariado)
    feature-flags.md                 # system_feature_flags + per_empresa
    mfa-vault.md                     # Master vs Geral, password vault AES-256
    quarentena-manual.md
    logs-disparos.md                 # tela admin
    monitor-disparos-nacional.md
    empresas-e-cadeiras.md           # (merge cadeiras-terceiros-sync)
  resultados-e-relatorios/
    visao-geral.md
    relatorio-convidados.md
    dashboards.md                    # WPP dashboard source, admin aggregated
  apis/
    create-lead-pri.md               # (move)
    create-lead.md
    create-lead-ligacao.md
    search-lead.md
    webhooks-recebidos.md            # template-paused, atendimento-status, ia-ligacao
  operacoes/
    login-terceiros.md               # (move login-terceiros-analise.md)
    manual-do-usuario/               # placeholder — será construído por cima
      README.md                      # esqueleto por persona (SDR, Recep, Gestor, Admin)
  historico/
    plano-rbac-fine-grained.md       # (renomeia previsao-breaking-changes + inventariado)
    breaking-changes.md
```

Cada arquivo segue o template:

```markdown
# {Título}
**Área:** ... **Público-alvo:** dev | usuário | ambos
**Última revisão:** YYYY-MM-DD

## O que é
## Fluxo funcional (para usuário)
## Detalhes técnicos
  - Tabelas / RPCs / Edge Functions envolvidas
  - Arquivos de código (`src/...`)
## Regras de negócio
## Erros comuns e troubleshooting
## Relacionado
```

Essa dualidade (Fluxo funcional + Detalhes técnicos) é o que permite depois destilar o **Manual do Usuário** só copiando as seções "Fluxo funcional" de cada doc.

## Fases de execução

**Fase 1 — Estrutura + índice + migração (sem perda)**
1. Criar `docs/README.md` (índice mestre), `docs/glossario.md`.
2. Criar diretórios da árvore acima.
3. **Mover** (sem reescrever ainda) os 15 arquivos existentes para os novos locais. Atualizar links internos.
4. Consolidar `controle-acessos.md` + `controle-acessos-auxiliar-detalhado.md` + `inventariado.md` + `previsao-breaking-changes.md` num único fluxo (`administracao/controle-acessos.md` para o produto atual; `historico/plano-rbac-fine-grained.md` para o roadmap).

**Fase 2 — Preencher lacunas críticas** (áreas sem docs hoje)
Ordem sugerida, alta prioridade primeiro:
1. `prospeccao/visao-geral.md`, `kanban-e-status.md`, `atribuicao-sdr.md`, `quarentena.md`, `auditoria.md`.
2. `pos-vendas/visao-geral.md`, `pecas.md`, `entregas.md`, `cadencia.md`.
3. `entra-dados/visao-geral.md`, `importacao-planilha.md`, `ingest-base-clientes.md`, `bulk-upsert-contatos.md`.
4. `arquitetura/visao-geral.md`, `multi-tenant.md`, `permissoes-e-rbac.md`, `performance.md`, `webhooks-e-integracoes.md`.
5. `recepcao/visao-geral.md`, `administracao/*`, `resultados-e-relatorios/*`, `apis/*`.

Fonte primária para preenchimento: código (`src/pages/**`, `src/hooks/**`, `supabase/functions/**`), memórias em `.lovable/memory/**`, docs existentes. Nenhuma informação inventada — quando houver dúvida técnica, marcar `> TODO: confirmar com time` e listar no final da entrega.

**Fase 3 — Esqueleto do Manual do Usuário**
Criar `docs/operacoes/manual-do-usuario/README.md` com sumário por persona (Recepcionista, SDR, Vendedor, Gestor, Admin/TI) referenciando as seções "Fluxo funcional" dos docs técnicos. Não escrever o manual completo agora — apenas o esqueleto navegável.

## Entrega por PR
- **PR 1 (Fase 1):** só move/renomeia + índice + glossário + merge dos 4 docs de RBAC. Zero conteúdo novo.
- **PR 2 (Fase 2a):** Prospecção completa.
- **PR 3 (Fase 2b):** Pós-Vendas.
- **PR 4 (Fase 2c):** Entra Dados + Performance.
- **PR 5 (Fase 2d):** Restante (Recepção, Admin, Resultados, APIs).
- **PR 6 (Fase 3):** Esqueleto do manual do usuário.

## Perguntas antes de iniciar
1. Manter os arquivos atuais no lugar (com stubs redirecionando) ou mover de fato? Recomendo mover — repositório mais limpo.
2. Confirmar as 5 personas do manual: **Recepcionista, SDR, Vendedor, Gestor, Admin/TI** — falta alguma (ex.: Master, Terceiro/DP)?
3. Ok fazer em 6 PRs incrementais nessa ordem, ou preferem tudo num único PR grande?
