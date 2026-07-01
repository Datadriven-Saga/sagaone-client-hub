# Fase 2b — Documentação de Pós-Vendas

Criar 6 documentos em `docs/pos-vendas/` seguindo o template padrão (Fluxo funcional + Detalhes técnicos), destravando as entradas marcadas `*(pendente)*` no índice mestre.

## Documentos a criar

### 1. `visao-geral.md`
Panorama do módulo Pós-Vendas: 3 sub-áreas (Peças, Entregas, Agendamentos) + configuração transversal (Paty Templates, Cadência). Diagrama do fluxo Kanban → Pós-venda → gatilho externo (n8n via `external-webhook-proxy`). Papéis operacionais e permissões (`canAccessPosVendas*`).

### 2. `pecas.md`
- **Fluxo funcional:** gestor associa gatilhos (7 slugs fixos) a lojas, escolhe template Paty aprovado, ativa/desativa toggle.
- **Técnico:** `PecasTab.tsx`, `PecasLojasSection.tsx`, `PecasTemplatesSection.tsx`, hook `usePecasData`, `usePatyPecasTemplates`. Endpoints externos (3 URLs n8n) chamados via `external-webhook-proxy` + `upsert-paty-peca-template`. Mapeamento UUID→PRI, payload com campo `gatilho`.

### 3. `entregas.md`
- **Fluxo funcional:** mesmo padrão de Peças + **Multi-Template sequencial** (adicionar seguimentos por gatilho, remoção otimista).
- **Técnico:** `EntregasTab.tsx`, `EntregasGatilhos.tsx`, `EntregasLojas.tsx`, hook `useEntregasData` + `usePatyEntregasTemplates` (agrupamento por slug/sequência). Endpoints externos (3 URLs n8n). Toggle sempre chama `upsert-paty-entrega-template`. Optimistic UI, controle de estado do Select.

### 4. `cadencia.md`
- **Fluxo funcional:** cadência conversacional Paty — sequência de passos, gatilho de tempo, variáveis.
- **Técnico:** `PatyCadencia.tsx`, `CadenciaConversacionalTab.tsx`, `AgenteSelector.tsx`. Tabelas `paty_cadencias*`, integração com agentes IA.

### 5. `agendamentos.md`
- **Fluxo funcional:** visão de agendamentos gerados por Pós-Vendas, filtros por status/loja/período.
- **Técnico:** `Agendamentos.tsx`, `AgendamentosTab.tsx`. Origem de dados, sync com sistema externo.

### 6. `paty-templates.md` *(já existe — só revisar)*
Revisar `docs/pos-vendas/paty-templates.md` atual, ajustar links para o novo layout e cross-references com `pecas.md`/`entregas.md`. Reforçar: variáveis, categorias Meta, herança shared por `id_meta`.

## Padrões aplicados a todos

Cada doc terá:
- Cabeçalho (Área / Público / Última revisão).
- Seção **Fluxo funcional** em linguagem de negócio (base para manual do usuário).
- Seção **Detalhes técnicos** com arquivos (`src/...`), Edge Functions, tabelas e RPCs.
- **Regras de negócio** (ex.: nunca sobrescrever template ativo sem confirmar).
- **Erros comuns** (HTTP 500 do n8n, "template não vinculado", controlled/uncontrolled Select).
- **Relacionado**.

## Referências cruzadas obrigatórias

- Memory `architecture/external-api-proxy-and-csp-compliance` (por que tudo passa pelo proxy).
- Memory `features/whatsapp/paused-template-*` (impacto de template pausado em Pós-Vendas).
- `docs/arquitetura/notificacoes.md` para eventos disparados.

## Atualização do índice

Remover marca `*(pendente)*` de:
- `pos-vendas/visao-geral.md`
- `pos-vendas/pecas.md`
- `pos-vendas/entregas.md`
- `pos-vendas/cadencia.md`
- `pos-vendas/agendamentos.md`

## Fora do escopo (fica pra Fase 2c em diante)

- Documentação de Entra Dados (`bulk_upsert_contatos`, `ingest-base-clientes`, planilha).
- Documentação de Recepção detalhada (busca por sufixo, vendedor de atendimento).
- Manual do usuário consolidado.
