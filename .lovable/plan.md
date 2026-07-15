## Execução do restante do plano de responsividade — por prioridade

Fonte: `docs/responsividade-diagnostico.md` (Fases 2–5 pendentes). Escopo estrito de UI/apresentação — **sem** tocar em RPC, RLS, Edge Functions, webhooks ou lógica de negócio.

### Ordem de prioridade (do que dói mais → cosmético)

**P0 — Fase 3 Onda A · Tabelas de Admin (maior overflow horizontal real)**
- `src/pages/admin/Webhooks.tsx`, `Empresas.tsx`, `Agentes.tsx`, `ControleAgentes.tsx`, `LogsCadeiras.tsx`, `LogsDisparos.tsx`, `Quarentena.tsx`, `OptOutGlobal.tsx`, `FeatureFlags.tsx`.
- Padrão: wrapper `overflow-x-auto` + `min-w-[...]` na tabela, `.scroll-fade-x` para indicar corte, colunas secundárias `hidden md:table-cell`, ações críticas sempre visíveis.
- Sem mudança de dados/consultas.

**P1 — Fase 3 Onda B · Tabelas operacionais**
- `QuarentenaLogs.tsx`, tabelas dentro de `pos-vendas/*`, `Relatorios.tsx`, `Resultados.tsx`, `Clientes.tsx`.
- Mesmo padrão da Onda A.

**P2 — Fase 2 restante · Modais grandes (mobile cropping)**
- Migrar para `ResponsiveDialogContent` (já existe) os modais: `CriarProspeccaoModal`, `SimulacaoPriWhatsAppModal`, `EditarContatoModal`, `ImportarPlanilhaModal`, `NovoEventoModal`, `TemplateModal` (lista final validada ao iniciar).
- Regra do usuário mantida em `CriarProspeccaoModal`: conteúdo continua encostando nas bordas (sem padding extra). Só troca o container (altura `dvh` + scroll interno + close 44px).
- Grids `grid-cols-2/3` dentro de modais viram `grid-cols-1 sm:grid-cols-2` apenas onde causam overflow < 640px.

**P3 — Fase 4 · Kanban e dashboards**
- `KanbanBoard` / `KanbanColumn`: colunas com `min-w-[280px]`, snap horizontal no mobile, header sticky.
- `DashboardWhatsAppTab` e grids de KPI: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` onde ainda estiver fixo.
- Zero mudança em cálculo/consulta de métricas.

**P4 — Fase 5 · Limpeza final**
- Trocar H1 hardcoded por `.h1` (tokens fluidos).
- Varredura dos ~212 `w-[Npx]` → `w-full max-w-[Npx]` (só onde causa overflow).
- Revisar regra global `.dark [style*="background: linear-gradient"]`.
- Rodar `bun run responsivo:audit` ao final e arquivar relatório em `docs/responsividade-diagnostico.md`.

### Método de execução

Para cada fase, na ordem acima:
1. Aplicar as mudanças em lote (parallel edits) — só CSS/JSX.
2. `tsgo` para garantir tipos.
3. Rodar `bun run responsivo:audit` ao final de cada fase e comparar com baseline (`/tmp/browser/responsivo/`).
4. Atualizar o checklist em `docs/responsividade-diagnostico.md` marcando o que foi concluído.
5. Reportar diff de métricas (overflows, hitboxes < 44px) antes de seguir para a próxima fase.

### Fora do escopo (não vou tocar)
- RPCs, políticas RLS, Edge Functions, webhooks, payloads.
- `CriarProspeccaoModal`: mantém `p-0` e conteúdo encostado nas bordas (sua regra anterior).
- Qualquer mudança visual em telas que você já ajustou manualmente sem que apareça overflow real na auditoria.

### Entrega
Ao final de cada fase, um resumo curto: arquivos alterados + delta de métricas da auditoria. Paro entre fases só se algo quebrar ou se a auditoria piorar; caso contrário sigo direto até a Fase 5.
