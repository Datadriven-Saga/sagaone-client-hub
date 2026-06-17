## Diagnóstico

No preview do Lovable, a sessão do Supabase é restaurada com timing ligeiramente diferente. Os logs mostram que o `AuthProvider` re-monta com `user=null` e depois passa a `user=<id>`. Esse "flip" expõe um bug em `src/hooks/useUserAccessType.ts`:

1. Primeira execução do `useEffect` com `user=null` → entra no branch `if (!user)` e faz `setLoading(false)` com `permissions={}`.
2. Em seguida `user` vira truthy → `useEffect` reexecuta, mas **não há `setLoading(true)` no início do `fetchData`**. Loading permanece `false` enquanto o fetch acontece.
3. Durante esse gap, `PermissionProtectedRoute` vê `loading=false`, `user` presente, mas `permissions={}` → `hasPermission=false` → `<Navigate to="/" replace />`.

Resultado: ao clicar em qualquer rota protegida por permissão (Atendimento, Administração, etc.), a UI carrega ~1s e volta para "/". Em produção o timing favorece a primeira execução já com `user` setado, então não dispara.

Sintomas confirmados nos logs anexados:
- `CompanyContext` renderiza 2x com `activeCompany: undefined` antes de carregar — mesmo padrão de re-mount.
- Session replay mostra `PermissionProtectedRoute` exibindo "Carregando..." e depois remoção/troca de rota.

## Correção

### `src/hooks/useUserAccessType.ts`
- No início do `useEffect`, chamar `setLoading(true)` **antes** de qualquer ramificação (inclusive antes do `if (!user)`).
- Manter o resto do fluxo igual; apenas garantir que a transição `user=null → user=<id>` força loading=true durante o refetch, evitando o falso "permissões vazias com loading=false".

### `src/components/PermissionProtectedRoute.tsx` (defesa adicional)
- Tratar como loading quando `user` existe mas `permissions` ainda é objeto vazio (`Object.keys(permissions).length === 0`) e `tipoAcesso` é null. Evita regressão se outro hook esquecer o `setLoading(true)`.

Para isso, expor `tipoAcesso` já é feito; o componente passa a importar `tipoAcesso` junto com `permissions` e considerar `loading || (user && !tipoAcesso)` como estado de carregamento.

### Não tocar
- `AuthContext`, `CompanyContext`, lógica de cron/dispatch — fora do escopo do bug.
- Rotas que usam `AdminProtectedRoute`/`ProtectedRoute` puro não sofrem do mesmo problema (não dependem de `permissions`).

## Validação

1. Abrir preview, fazer login, clicar em `/prospeccao/atendimento`, `/administracao`, `/resultados` — devem renderizar sem voltar para "/".
2. Console: `CompanyContext` ainda re-monta (comportamento do iframe Lovable), mas a navegação interna passa a sobreviver ao gap de auth.
3. Produção: comportamento inalterado (já funcionava por timing favorável).
