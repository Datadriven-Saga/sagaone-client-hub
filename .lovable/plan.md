## Sistema de Notificações in-app (modular)

### Diagnóstico
- Tabela `notificacoes` está vazia e modelada pra CRM antigo (sem `user_id`, `empresa_id`, `link`, `lida`; enum `tipo` restrito).
- Inserts de `disparo_concluido`/`disparo_falhou` (já no código) falham silenciosamente.
- `/notificacoes` é stub. Sem sininho global.

### O que vou entregar

**1. Migration na tabela `notificacoes` (segura — 0 linhas)**
- Adicionar: `user_id uuid not null`, `empresa_id uuid`, `link text`, `lida boolean default false`, `updated_at timestamptz default now()`.
- Trocar `tipo` de enum para `text` (categoria livre: `disparo_concluido`, `disparo_falhou`, `import_concluido`, etc).
- Tornar `mensagem` nullable só se necessário; manter `titulo` obrigatório.
- Índices: `(user_id, lida, created_at desc)` e `(user_id, created_at desc)`.
- RLS: `SELECT/UPDATE` onde `auth.uid() = user_id`; `INSERT` aberto a `service_role`. Grants pra `authenticated` e `service_role`.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes`.
- Trigger `update_updated_at`.

**2. Camada modular de notificações (frontend)**
- `src/lib/notifications/types.ts` — tipos `NotificationTipo`, `Notification`, `CreateNotificationInput`.
- `src/lib/notifications/registry.ts` — registry com label, ícone, cor e formatação por `tipo`. Adicionar um tipo novo = uma entrada aqui.
- `src/hooks/useNotificacoes.ts` (substitui `useNotificacoesData.ts`):
  - Lê por `user_id = auth.uid()`, ordenado desc.
  - Subscribe realtime (insert/update).
  - Expõe: `lista`, `naoLidas`, `total`, `loading`, `marcarComoLida(id)`, `marcarTodasComoLidas()`, `criar(input)` (helper opcional para frontend — usa service via insert direto pra própria conta).

**3. Sininho global no header**
- Componente novo `src/components/NotificacoesBell.tsx`:
  - Ícone `Bell` com badge de não-lidas (`9+` se >9).
  - Popover com últimas 8 notificações, "Marcar todas como lidas" e "Ver todas" → `/notificacoes`.
  - Clicar em item: marca como lida e navega pro `link` se houver.
- Inserido em `DashboardLayout.tsx` ao lado do `ActiveCampaignJobIndicator` e `UserMenu`.

**4. Página `/notificacoes` enxuta**
- Remover filtros antigos, KPIs CRM, botão "Nova Notificação", modal mockado.
- Nova UI: lista cronológica com `titulo`/`mensagem`/badge do tipo/data relativa, botão "Abrir" (navega no `link` + marca lida).
- Filtro: Todas / Não lidas / por tipo (alimentado pelo registry).
- KPIs: Não lidas, Total.
- Botão "Marcar todas como lidas".

**5. Edge functions (já editadas)**
- `process-campaign-job`, `scheduled-campaign-dispatcher` e `ActiveCampaignJobIndicator.autoResolveStuckJob` já inserem no novo formato. Vou revisar nomes de campo após a migration entrar.
- Adicionar helper opcional `supabase/functions/_shared/notificacoes.ts` (`inserirNotificacao(supabase, input)`) com idempotência por `link` — pra reuso em qualquer edge function futura.

**6. Documentação**
- `docs/notificacoes.md` (novo) explicando:
  - Schema da tabela e RLS.
  - Como o sininho/aba funcionam.
  - **Como disparar uma notificação de qualquer origem:**
    - Do frontend (rara): `useNotificacoes().criar({...})`.
    - De edge function: `inserirNotificacao(supabase, { user_id, empresa_id, tipo, titulo, mensagem, link })`.
    - Diretamente via SQL/trigger: `INSERT INTO public.notificacoes (...)` com `service_role`.
  - **Como adicionar um novo tipo:** uma entrada em `registry.ts` (label, ícone, cor, rota base opcional). Pronto — o sininho/página renderizam automaticamente.
  - Idempotência: usar `link` único quando quiser evitar duplicar (ex: `?job=<id>`).
  - Realtime: o hook já reflete inserts/updates sem refresh.

### Arquivos
- migration nova.
- `src/lib/notifications/{types.ts,registry.ts}` (novos).
- `src/hooks/useNotificacoes.ts` (novo, substitui `useNotificacoesData.ts`).
- `src/components/NotificacoesBell.tsx` (novo).
- `src/components/DashboardLayout.tsx` (incluir o sininho).
- `src/pages/Notificacoes.tsx` (reescrever).
- `supabase/functions/_shared/notificacoes.ts` (novo helper).
- `docs/notificacoes.md` (novo).

### Fora de escopo
- E-mail de notificação.
- Notificações de outros módulos (importação, etc.) — registry já fica pronto pra plugar quando quiser.
