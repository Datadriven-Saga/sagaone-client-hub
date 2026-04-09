

## Plan: Fix Performance Module (Resumo, Ranking, Desempenho)

### Problem Summary

1. **400 Bad Request**: ResumoTab fetches all `contato_id` from `eventos_prospeccao` (419k+ rows), then passes them to `.in('id', contatoIds)` — exceeding PostgREST URL limits
2. **Client-side counting**: Status counts are computed in JS instead of SQL
3. **Weak matching**: `responsavel_email` contains real emails (e.g. `ana.ksoares@gruposaga.com.br`) but code matches against `profile.id` and `celular`, never against the actual email (which lives in `auth.users`)
4. **Multi-select inconsistency**: Resumo accepts multiple events; Ranking/Desempenho accept only one
5. **Dead tabs**: Produtos and Premiações are placeholders to remove

### Solution

#### 1. Database: Create 3 RPC functions (one migration)

**`get_resumo_stats(p_prospeccao_ids uuid[], p_empresa_id uuid)`**
- Single SQL query: JOIN `eventos_prospeccao` + `contatos`, GROUP BY `status`, return counts + metas aggregated from `prospeccoes`
- No client-side counting, no giant `.in()` arrays

**`get_ranking_vendedores(p_prospeccao_ids uuid[], p_empresa_id uuid)`**
- JOIN `prospeccao_equipes` → `prospeccao_equipe_membros` → `profiles`
- JOIN `auth.users` to get email for matching against `contatos.responsavel_email`
- COUNT status per vendedor using CASE WHEN, GROUP BY
- Returns: `user_id, nome_completo, convidados, checkins, vendas`
- Accepts multiple event IDs

**`get_desempenho_vendedores(p_prospeccao_ids uuid[], p_empresa_id uuid, p_date_start timestamptz DEFAULT NULL, p_date_end timestamptz DEFAULT NULL)`**
- Same JOIN structure as ranking but adds: atribuidos, agendados, confirmados, descartes
- Date filter on `contatos.created_at`
- Accepts multiple event IDs
- Returns raw counts; pontuacao calculated client-side (simple math, no data issue)

All three functions use `SECURITY DEFINER` with `search_path = public` to access `auth.users.email` for proper matching.

#### 2. Frontend: Rewrite ResumoTab, RankingTab, DesempenhoTab

Each tab calls its respective RPC via `supabase.rpc()` — no more raw table queries.

**ResumoTab**: Call `get_resumo_stats`, render funnel + meta cards from returned data.

**RankingTab**: 
- Change prop from `prospeccaoId: string | null` to `prospeccaoIds: string[]`
- Call `get_ranking_vendedores`

**DesempenhoTab**: 
- Change prop from `prospeccaoId: string | null` to `prospeccaoIds: string[]`
- Call `get_desempenho_vendedores`

#### 3. Frontend: Remove Produtos and Premiações

- Remove entries from `routeToTab`, `routeToTitle` in `Resultados.tsx`
- Remove from `AppSidebar.tsx` sidebar items
- Remove switch cases in `renderContent()`

#### 4. Frontend: Pass `selectedProspeccoes` array to Ranking/Desempenho

In `Resultados.tsx`, change:
```
// Before
<RankingTab prospeccaoId={selectedProspeccoes[0]} ... />
// After  
<RankingTab prospeccaoIds={selectedProspeccoes} ... />
```

Same for DesempenhoTab.

### Files Changed

| File | Action |
|------|--------|
| Migration SQL | Create 3 RPCs |
| `src/components/resultados/ResumoTab.tsx` | Rewrite to use RPC |
| `src/components/resultados/RankingTab.tsx` | Rewrite to use RPC + multi-select |
| `src/components/resultados/DesempenhoTab.tsx` | Rewrite to use RPC + multi-select |
| `src/pages/Resultados.tsx` | Remove produtos/premiações, pass arrays |
| `src/components/AppSidebar.tsx` | Remove produtos/premiações menu items |

