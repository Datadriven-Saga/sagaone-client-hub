# Documentação Técnica — SagaOne

> Última revisão: 2026-07-01

Este diretório é a fonte oficial de documentação técnica e funcional do sistema. A organização é por **área de produto**, e cada documento segue o template descrito em [Convenções](#convenções) — separando **fluxo funcional** (base do futuro manual do usuário) dos **detalhes técnicos**.

## Índice

### Arquitetura & fundamentos
- [Visão geral da plataforma](arquitetura/visao-geral.md)
- [Multi-tenant e empresa ativa](arquitetura/multi-tenant.md)
- [Autenticação, SSO e sessão](arquitetura/autenticacao-e-sessao.md)
- [Permissões, RBAC e Controle de Acessos](arquitetura/permissoes-e-rbac.md)
- [Webhooks e integrações externas](arquitetura/webhooks-e-integracoes.md)
- [Performance e limites](arquitetura/performance.md)
- [Notificações](arquitetura/notificacoes.md)

### Prospecção
- [Visão geral](prospeccao/visao-geral.md)
- [Kanban e status](prospeccao/kanban-e-status.md)
- [Atribuição SDR / Vendedor](prospeccao/atribuicao-sdr.md)
- [Quarentena](prospeccao/quarentena.md)
- [Disparo WhatsApp](prospeccao/dispatch-whatsapp.md)
- [Template pausado](prospeccao/template-pausado.md)
- [Recuperação de jobs órfãos](prospeccao/recuperacao-jobs-orfaos.md)
- [Correção do dispatcher programado](prospeccao/correcao-dispatcher.md)
- [IA de Ligação](prospeccao/ia-ligacao.md)
- [Logs de disparos](prospeccao/logs-disparos.md)
- [Auditoria](prospeccao/auditoria.md)

### Pós-Vendas
- [Visão geral](pos-vendas/visao-geral.md)
- [Peças — gatilhos, lojas e templates](pos-vendas/pecas.md)
- [Entregas — gatilhos, lojas, multi-template](pos-vendas/entregas.md)
- [Paty Templates e variáveis](pos-vendas/paty-templates.md)
- [Cadência](pos-vendas/cadencia.md)
- [Agendamentos](pos-vendas/agendamentos.md)

### Entra Dados (hub /entra-dados e /de-para)
- [Visão geral](entra-dados/visao-geral.md)
- [De-Para (mapeamentos S3)](entra-dados/de-para.md)

### Importação de Bases
- [Visão geral](importacao/visao-geral.md)
- [Importação por planilha](importacao/importacao-planilha.md)
- [Importação do Pool / DataLake](importacao/importacao-pool.md)
- [`ingest-base-clientes`](importacao/ingest-base-clientes.md)
- [`bulk_upsert_contatos` — regras críticas](importacao/bulk-upsert-contatos.md)

### Recepção
- [Visão geral](recepcao/visao-geral.md)
- [Fluxo de check-in](recepcao/fluxo-checkin.md)
- [Busca por sufixo de telefone](recepcao/busca-sufixo-telefone.md)
- [Vendedor de atendimento](recepcao/vendedor-atendimento.md)

### Administração
- [Visão geral](administracao/visao-geral.md)
- [Controle de Acessos](administracao/controle-acessos.md)
- [Controle de Acessos — auxiliar detalhado](administracao/controle-acessos-auxiliar-detalhado.md)
- [Feature Flags](administracao/feature-flags.md)
- [MFA e Vault](administracao/mfa-vault.md)
- [Quarentena manual](administracao/quarentena-manual.md)
- [Logs de disparos (tela)](administracao/logs-disparos.md)
- [Monitor nacional de disparos](administracao/monitor-disparos-nacional.md)
- [Empresas e Cadeiras — sync terceiros](administracao/empresas-e-cadeiras.md)

### Resultados & Relatórios
- [Visão geral](resultados-e-relatorios/visao-geral.md)
- [Relatório de Convidados](resultados-e-relatorios/relatorio-convidados.md)
- [Dashboards](resultados-e-relatorios/dashboards.md)

### APIs públicas
- [`create-lead-pri`](apis/create-lead-pri.md)
- [`create-lead`](apis/create-lead.md)
- [`create-lead-ligacao`](apis/create-lead-ligacao.md)
- [`search-lead`](apis/search-lead.md)
- [Webhooks recebidos](apis/webhooks-recebidos.md)

### Operações
- [Login de Terceiros](operacoes/login-terceiros.md)
- [Manual do Usuário](operacoes/manual-do-usuario/README.md) — 9 capítulos por perfil + [checklist de vídeos](operacoes/manual-do-usuario/CHECKLIST-VIDEOS.md).

### Histórico / roadmap
- [Plano RBAC fine-grained — inventariado](historico/rbac-inventariado.md)
- [Previsão de breaking changes](historico/breaking-changes.md)

### Referência
- [Glossário](glossario.md)

---

## Convenções

Todo novo documento deve seguir este template:

```markdown
# {Título}

**Área:** Prospecção | Pós-Vendas | Entra Dados | Recepção | Administração | Arquitetura | APIs
**Público-alvo:** dev | usuário | ambos
**Última revisão:** YYYY-MM-DD

## O que é

## Fluxo funcional (para usuário)

## Detalhes técnicos
- Tabelas envolvidas:
- RPCs:
- Edge Functions:
- Arquivos de código:

## Regras de negócio

## Erros comuns e troubleshooting

## Relacionado
```

A seção **Fluxo funcional** é escrita em linguagem de negócio (sem jargão técnico) — ela é o material fonte para o **Manual do Usuário** que será construído em `operacoes/manual-do-usuario/`.

A seção **Detalhes técnicos** referencia código, tabelas do Supabase, RPCs e Edge Functions. Sempre linkar arquivos com caminho relativo ao repo (`src/...`, `supabase/functions/...`).

Quando houver dúvida sobre uma regra, marcar com:

```markdown
> **TODO:** confirmar com {time/pessoa} — {questão específica}
```

## Como contribuir

1. Documento novo → adicionar link neste índice e remover a marca `*(pendente)*`.
2. Documento movido → atualizar todos os links que apontam para o caminho antigo (`rg -n "docs/<nome-antigo>"`).
3. Ao alterar código descrito num documento, atualizar a seção **Detalhes técnicos** correspondente no mesmo PR.