## Objetivo

Centralizar configuração de limite de cadeiras em `/administracao/logs-cadeiras` e garantir que a aba "Histórico" funcione.

## Diagnóstico

**1. Duplicação de configuração de limite**
- `/cadeiras` (`src/pages/Cadeiras.tsx`, linhas 616–635) tem o card "Configurar cadeiras por loja (admin)" que faz upsert direto em `external_seat_limits` — bypassa a RPC `set_seat_limit` e não gera log.
- `/administracao/logs-cadeiras` (`src/pages/admin/LogsCadeiras.tsx`) já tem a aba "Limites por loja" que usa `set_seat_limit` (registra `limit_change` em `logs_cadeiras`). Esta é a fonte oficial.

**2. Erro do log — Confirmado**
- Console: `Could not find a relationship between 'logs_cadeiras' and 'empresa_id' in the schema cache` (400).
- Causa: `logs_cadeiras` não tem nenhuma FK (`pg_constraint` só tem PK e o CHECK de `acao`). O `select` da página usa embeds (`empresas:empresa_id(...)`, `prospeccoes:prospeccao_id(...)`, `executor:executado_por(...)`, `alvo:profile_id(...)`) que dependem de FKs declaradas.

**3. CHECK constraint desatualizado — Confirmado**
- `logs_cadeiras_acao_check` permite apenas `create|renew|activate|deactivate`. A RPC `set_seat_limit` insere `'limit_change'` → qualquer alteração de limite hoje falha silenciosamente com erro de check.

## Mudanças

### Frontend
- `src/pages/Cadeiras.tsx`: remover o bloco "Configurar cadeiras por loja (admin)" (linhas ~616–635), o estado `limitInput`/`savingLimit`, a função `handleSaveLimit` e quaisquer imports/labels só usados por ele. A aba de admin para limites passa a viver só em `/administracao/logs-cadeiras`.
- Não alterar: leitura/visualização do limite atual no header ("Cadeiras ativas: X/Y"), criação/renovação/reativação de terceiros, gerenciamento de domínios.

### Banco (migration)
- Adicionar FKs em `logs_cadeiras` (todas `ON DELETE SET NULL`) para que os embeds do PostgREST funcionem:
  - `empresa_id` → `public.empresas(id)`
  - `prospeccao_id` → `public.prospeccoes(id)`
  - `profile_id` → `public.profiles(id)`
  - `executado_por` → `public.profiles(id)` (nomeada explicitamente para diferenciar do alvo)
- Atualizar `logs_cadeiras_acao_check` para incluir `'limit_change'`.
- Criar índices em `empresa_id`, `created_at desc`, `acao` para suportar filtro/ordenação da página.

### Não alterar
- RPCs `set_seat_limit` e `list_seat_usage` (já corretas).
- RLS de `logs_cadeiras`.
- Tabela `external_seat_limits`.
- Lógica de `can_user_login` / cadeiras ativas.

## Testes obrigatórios após implementar
1. `/cadeiras` carrega sem o card de limite; criação, renovação, reativação e contador "X/Y" funcionam.
2. `/administracao/logs-cadeiras` aba "Limites por loja": editar e salvar limite — toast de sucesso, valor persiste.
3. Após salvar, aba "Histórico" mostra entrada `Limite alterado` com `old → new`, loja e executor preenchidos (sem mais 400 no console).
4. Logs antigos (`create`, `deactivate` etc.) continuam aparecendo com nome do terceiro, loja, evento, executor.
5. Filtro por ação e busca por email/loja/evento/terceiro funcionam.