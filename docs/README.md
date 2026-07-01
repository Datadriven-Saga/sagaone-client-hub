# Documentação Técnica — SagaOne

> Última revisão: 2026-07-01

Este diretório é a fonte oficial de documentação técnica e funcional do sistema. A organização é por **área de produto**, e cada documento segue o template descrito em [Convenções](#convenções) — separando **fluxo funcional** (base do futuro manual do usuário) dos **detalhes técnicos**.

## Índice

### Arquitetura & fundamentos
- [Visão geral da plataforma](arquitetura/visao-geral.md) *(pendente)*
- [Multi-tenant e empresa ativa](arquitetura/multi-tenant.md) *(pendente)*
- [Autenticação, SSO e sessão](arquitetura/autenticacao-e-sessao.md) *(pendente)*
- [Permissões, RBAC e Controle de Acessos](arquitetura/permissoes-e-rbac.md) *(pendente — merge de RBAC)*
- [Webhooks e integrações externas](arquitetura/webhooks-e-integracoes.md) *(pendente)*
- [Performance e limites](arquitetura/performance.md) *(pendente)*
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
- [Visão geral](pos-vendas/visao-geral.md) *(pendente)*
- [Peças — gatilhos, lojas e templates](pos-vendas/pecas.md) *(pendente)*
- [Entregas — gatilhos, lojas, multi-template](pos-vendas/entregas.md) *(pendente)*
- [Paty Templates e variáveis](pos-vendas/paty-templates.md)
- [Cadência](pos-vendas/cadencia.md) *(pendente)*
- [Agendamentos](pos-vendas/agendamentos.md) *(pendente)*

### Entra Dados
- [Visão geral](entra-dados/visao-geral.md) *(pendente)*
- [Importação por planilha](entra-dados/importacao-planilha.md) *(pendente)*
- [Importação do Pool / DataLake](entra-dados/importacao-pool.md)
- [`ingest-base-clientes`](entra-dados/ingest-base-clientes.md) *(pendente)*
- [`bulk_upsert_contatos` — regras críticas](entra-dados/bulk-upsert-contatos.md) *(pendente)*

### Recepção
- [Visão geral](recepcao/visao-geral.md) *(pendente)*
- [Fluxo de check-in](recepcao/fluxo-checkin.md)
- [Busca por sufixo de telefone](recepcao/busca-sufixo-telefone.md) *(pendente)*
- [Vendedor de atendimento](recepcao/vendedor-atendimento.md) *(pendente)*

### Administração
- [Visão geral](administracao/visao-geral.md) *(pendente)*
- [Controle de Acessos](administracao/controle-acessos.md)
- [Controle de Acessos — auxiliar detalhado](administracao/controle-acessos-auxiliar-detalhado.md)
- [Feature Flags](administracao/feature-flags.md) *(pendente)*
- [MFA e Vault](administracao/mfa-vault.md) *(pendente)*
- [Quarentena manual](administracao/quarentena-manual.md) *(pendente)*
- [Logs de disparos (tela)](administracao/logs-disparos.md) *(pendente)*
- [Monitor nacional de disparos](administracao/monitor-disparos-nacional.md) *(pendente)*
- [Empresas e Cadeiras — sync terceiros](administracao/empresas-e-cadeiras.md)

### Resultados & Relatórios
- [Visão geral](resultados-e-relatorios/visao-geral.md) *(pendente)*
- [Relatório de Convidados](resultados-e-relatorios/relatorio-convidados.md) *(pendente)*
- [Dashboards](resultados-e-relatorios/dashboards.md) *(pendente)*

### APIs públicas
- [`create-lead-pri`](apis/create-lead-pri.md)
- [`create-lead`](apis/create-lead.md) *(pendente)*
- [`create-lead-ligacao`](apis/create-lead-ligacao.md) *(pendente)*
- [`search-lead`](apis/search-lead.md) *(pendente)*
- [Webhooks recebidos](apis/webhooks-recebidos.md) *(pendente)*

### Operações
- [Login de Terceiros](operacoes/login-terceiros.md)
- [Manual do Usuário (esqueleto)](operacoes/manual-do-usuario/README.md) *(pendente)*

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