# Sistema de Notificações in-app

Notificações que aparecem no **sininho do header** (em todas as páginas dentro do
`DashboardLayout`) e na **aba `/notificacoes`**. Cada usuário só vê as suas — RLS garante isso.

## Schema (tabela `public.notificacoes`)

| coluna       | tipo         | descrição                                                                 |
|--------------|--------------|---------------------------------------------------------------------------|
| `id`         | uuid pk      | gerado automaticamente                                                    |
| `user_id`    | uuid         | dono da notificação (filtra por `auth.uid()`)                             |
| `empresa_id` | uuid?        | contexto (opcional)                                                       |
| `tipo`       | text         | categoria — registrar em `src/lib/notifications/registry.ts`              |
| `titulo`     | text         | título curto (linha principal)                                            |
| `mensagem`   | text?        | descrição (até ~240 chars recomendado)                                    |
| `link`       | text?        | rota interna (ex: `/prospeccao/xxx?job=yyy`); abre ao clicar              |
| `lida`       | boolean      | default `false`                                                           |
| `created_at` | timestamptz  | default `now()`                                                           |
| `updated_at` | timestamptz  | atualizado por trigger                                                    |

Colunas legadas (`destinatario_id`, `status`, `tipo_notificacao_id`, `contato_id`,
`cliente_id`, `data_envio`, `data_leitura`, `remetente_id`) seguem na tabela por
compatibilidade, mas não são usadas pelo sistema atual.

### RLS
- `SELECT` / `UPDATE`: apenas `auth.uid() = user_id`.
- `INSERT`: somente `service_role` (edge functions). Frontend insere via hook quando aplicável,
  mas isso só funciona se o `user_id` for o do próprio usuário autenticado (RLS bloqueia o resto).

### Realtime
Habilitado via `supabase_realtime` publication. O hook do frontend reflete `INSERT/UPDATE/DELETE`
filtrados por `user_id` sem refresh.

---

## Frontend

### Hook principal
`src/hooks/useNotificacoes.ts`

```ts
const {
  lista,                  // Notification[]
  naoLidas,               // number
  total,                  // number
  loading,                // boolean
  marcarComoLida,         // (id) => Promise<void>
  marcarTodasComoLidas,   // () => Promise<void>
  criar,                  // (input) => Promise<void>  -- raro no frontend
  refresh,                // () => Promise<void>
} = useNotificacoes();
```

### Componentes
- `NotificacoesBell` (em `DashboardLayout`) — sininho + popover com últimas 8.
- `pages/Notificacoes.tsx` — listagem completa com filtro por tipo e "marcar todas".

### Registry de tipos
`src/lib/notifications/registry.ts`

Adicionar um tipo novo:

```ts
export const NOTIFICATION_REGISTRY = {
  // ...
  import_concluido: {
    label: "Importação concluída",
    icon: CheckCircle2,
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    iconClass: "text-blue-600",
  },
};
```

Pronto. O sininho e a aba renderizam automaticamente. Tipos não registrados caem no `FALLBACK_META`
(ícone genérico de sino).

---

## Como criar uma notificação

### 1. De uma Edge Function (caso mais comum)

Use o helper compartilhado:

```ts
import { inserirNotificacao } from "../_shared/notificacoes.ts";

await inserirNotificacao(supabase, {
  user_id: job.user_id,
  empresa_id: job.empresa_id,
  tipo: "disparo_falhou",
  titulo: "Falha no disparo programado",
  mensagem: "Evento X: 47 falhas — 30 número inválido, 12 agente não encontrado.",
  link: `/prospeccao/${prospeccao_id}?job=${job_id}`,
  // idempotenteByLink: true (default) — não duplica mesma combinação user+tipo+link
});
```

Requisitos:
- O client deve ser criado com `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS).
- Sempre passe `user_id`. Sem ele o helper retorna `{ ok: false }`.

### 2. Direto via SQL (trigger ou script com service role)

```sql
INSERT INTO public.notificacoes (user_id, empresa_id, tipo, titulo, mensagem, link)
VALUES ('<uuid>', '<uuid>', 'import_concluido', 'Importação concluída', '...', '/importacoes/<id>');
```

### 3. Do frontend (raro)

```ts
const { criar } = useNotificacoes();
await criar({ user_id: user.id, tipo: "Sistema", titulo: "Bem-vindo!", mensagem: "..." });
```

Só funciona para o próprio usuário autenticado (RLS).

---

## Boas práticas

- **`titulo`** curto e direto (até ~50 chars).
- **`mensagem`** até ~240 chars; texto longo deve ir para a página apontada pelo `link`.
- **`link`** sempre que possível — leva o usuário direto ao contexto e marca como lida no clique.
- **Idempotência:** quando um job pode ser reprocessado, use um `link` único por evento
  (ex: `?job=<id>`). O helper já cuida do dedup; do frontend, faça `select ... eq link` antes.
- **Tipos novos:** sempre registrar em `registry.ts`. Sem isso aparece como "Notificação" genérica.
- **Não use** para conteúdo sensível — `user_id` é o único isolamento.

---

## Onde já está integrado

| Origem                                   | Tipo                | Quando                                       |
|------------------------------------------|---------------------|----------------------------------------------|
| `process-campaign-job` (final do job)    | `disparo_concluido` | Job termina (com ou sem falhas)              |
| `process-campaign-job` (final com falhas)| `disparo_falhou`    | Job termina com falhas (resumo por categoria)|
| `process-campaign-job` (catch global)    | `disparo_falhou`    | Erro crítico no processamento                |
| `scheduled-campaign-dispatcher`          | `disparo_falhou`    | Falha ao invocar `process-campaign-job`      |
| `ActiveCampaignJobIndicator` (frontend)  | `disparo_falhou`    | Job auto-resolvido por timeout (10 min)      |

Para acrescentar novos pontos, basta seguir os exemplos acima.