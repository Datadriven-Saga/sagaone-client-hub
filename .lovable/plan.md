## Diagnóstico corrigido

Você está certo: pelo print e pelos logs, **não é um refresh forçado do navegador** (`window.location.reload`) e também não parece ser o `VersionMonitor`.

O que está acontecendo é um **remount/refetch da tela ao voltar para a aba do navegador**:

```text
volta foco para a aba
  → Supabase/auth ou checagem de sessão reemite estado
  → contextos re-renderizam
  → rota protegida/página Prospeccao re-renderiza
  → useContatoData volta para loading
  → fetchProspeccoes roda de novo
  → efeito automático sincroniza eventos de Ligação via webhook
  → fetchProspeccoes roda de novo
```

Isso bate exatamente com seu log:

```text
Data from hooks ... prospeccoes: 0 loading: true
Fetching prospeccoes...
Fetching prospeccoes...
Prospeccoes fetched: 27
Sincronizando eventos de Ligação com webhook...
Sincronização concluída...
Fetching prospeccoes...
```

## Causas prováveis no código

1. **AuthContext atualiza `user/session` mesmo quando é a mesma sessão**
   - `AuthContext.tsx` trata eventos do Supabase e chama `setSession/setUser` sem comparar se o usuário/token realmente mudou.
   - Ao trocar de aba, o Supabase pode checar/restaurar/refreshar sessão, e isso re-renderiza tudo abaixo.

2. **useUserAccessType refaz permissões quando o objeto `user` muda de referência**
   - O hook depende de `[user]`, não de `[user?.id]`.
   - Se o Supabase entrega o mesmo usuário como novo objeto, ele busca profile/permissões de novo, e a rota protegida pode desmontar/remontar a tela.

3. **Prospeccao executa webhook externo automaticamente ao montar/carregar eventos**
   - Em `Prospeccao.tsx`, o efeito das linhas 782-788 chama `sincronizarEventosLigacao(false)` sempre que há empresa e prospecções.
   - Essa sincronização chama Edge Function externa e depois `fetchProspeccoes` de novo.
   - Isso é o principal causador da sensação de “a tela recarregou tudo” na aba Eventos.

4. **Logs em corpo de render poluem o console**
   - `Prospeccao component initiated`, `User from auth`, `Data from hooks` estão no render, então qualquer render parece um reload completo.
   - Não causa o bug, mas torna o diagnóstico confuso.

## Plano de correção

1. **Estabilizar o AuthContext**
   - Evitar `setUser/setSession` quando o `user.id` e `access_token` não mudaram.
   - Tratar eventos redundantes do Supabase como no-op.
   - Manter as regras atuais de sessão: 8h máximo e 1h inatividade.

2. **Estabilizar `useUserAccessType`**
   - Trocar dependência de `[user]` para `[user?.id]`.
   - Evitar refetch de permissões quando apenas a referência do objeto `user` mudou.

3. **Remover sincronização externa automática na abertura/retorno da aba Eventos**
   - Não chamar `sync-eventos-ligacao` automaticamente quando a tela monta ou refaz foco.
   - Manter sincronização apenas por ação explícita do usuário ou fluxo realmente necessário.
   - Se precisar manter uma reconciliação automática, aplicar trava por empresa com cooldown e nunca rodar ao simples `visibilitychange`.

4. **Evitar reset visual desnecessário de Eventos**
   - Ajustar `useContatoData` para não zerar `prospeccoes` para `[]` durante refetch quando a empresa não mudou.
   - Assim a lista atual permanece visível enquanto atualiza em background.

5. **Limpar logs de render em produção/preview**
   - Mover logs úteis para effects ou proteger com flag de debug.
   - Isso não muda regra de negócio, só reduz ruído e facilita detectar reload real.

## Validação esperada

Depois da correção, ao sair da aba do navegador e voltar:

```text
não deve aparecer prospeccoes: 0 loading: true
não deve chamar sync-eventos-ligacao automaticamente
não deve refazer permissões/profile sem troca real de usuário
lista de eventos deve continuar na tela sem “piscar”
VersionMonitor pode continuar checando versão normalmente
```

Arquivos envolvidos:

- `src/contexts/AuthContext.tsx`
- `src/hooks/useUserAccessType.ts`
- `src/hooks/useContatoData.ts`
- `src/pages/Prospeccao.tsx`