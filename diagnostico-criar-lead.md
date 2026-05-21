# Diagnóstico — logout ao criar lead

## Sintoma observado
Ao confirmar a criação de lead no Kanban de Atendimento, a tela travava e o usuário era removido do app, voltando para `/login`.

## Causa real identificada
O problema não era apenas a edge function `create-lead`. O próprio frontend em `src/components/NovoLeadModal.tsx` ainda continha dois pontos que forçavam logout localmente:

1. `ensureSession()` chamava `supabase.auth.signOut()` + `navigate('/login')` quando `refreshSession()` falhava.
2. `handleCreateLead()` fazia o mesmo ao receber `401` da edge `create-lead`, mesmo após tentativa de refresh/retry.

Isso fazia o usuário ser expulso do app por falhas transitórias de refresh/token, inclusive quando ainda existia sessão local utilizável por alguns segundos.

## Evidências verificadas
- A edge `create-lead` valida JWT em código e retorna `401` quando `auth.getUser()` falha.
- O modal tinha lógica explícita de `signOut()` e redirecionamento para `/login` no caminho crítico da criação.
- Não havia evidência de outro componente do Kanban disparando logout nesse fluxo específico.

## Correção aplicada
- Removido logout forçado de `ensureSession()`.
- Removido logout forçado do tratamento de `401` após `create-lead`.
- Quando o refresh falha mas a sessão ainda não expirou, o modal agora usa a sessão atual e segue.
- Quando a sessão realmente expirou, o modal apenas informa o usuário via toast, sem limpar a sessão local por conta própria.

## Impacto esperado
- O usuário não deve mais ser chutado para o login ao tentar criar lead por falha transitória de refresh.
- Em caso de expiração real, verá mensagem para reautenticar, mas sem reset agressivo da aplicação nesse fluxo.

## Próximo ponto para observar se reaparecer
Se voltar a ocorrer mesmo sem logout local, o próximo suspeito será uma transição global do `AuthContext` por evento `SIGNED_OUT` vindo do SDK/Supabase, e não mais o modal em si.
