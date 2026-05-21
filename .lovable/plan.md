# Plano de correção

## Diagnóstico fechado

Há dois problemas diferentes acontecendo no mesmo fluxo:

1. **401 persistente no `create-lead`**
   - O frontend hoje chama `supabase.functions.invoke('create-lead')`.
   - A função `create-lead` está com `verify_jwt = false` e faz validação manual.
   - Dentro dela, a autenticação está sendo feita com `supabaseClient.auth.getUser()` sem passar o token explicitamente.
   - Pelos sintomas, screenshots e padrão documentado do Supabase, esse é o ponto mais provável do 401 intermitente: a função recebe o header, mas a validação do usuário no runtime da Edge não está suficientemente robusta para esse caso.
   - Os logs recentes da função mostram apenas `Autenticação via JWT`, sem avançar para logs de sucesso do fluxo, o que reforça que a falha ocorre bem cedo na autenticação.

2. **Tela branca**
   - O erro do screenshot é `NotFoundError: Failed to execute 'removeChild' on 'Node'`.
   - Isso é um padrão conhecido em React quando o DOM foi modificado por tradutor/extensão do navegador (o screenshot mostra inclusive tentativa de carregar CSS do Google Translate bloqueada por CSP).
   - Ou seja: a tela branca **não parece ser causada diretamente pelo banco ou pela Edge function**. É um crash de renderização do React depois de mutação externa no DOM.

## O que vou implementar

### 1) Fortalecer a autenticação do `create-lead`
- Ajustar `supabase/functions/create-lead/index.ts` para validar o JWT de forma explícita e estável.
- Trocar a identificação atual por um fluxo compatível com a recomendação do Supabase para Edge Functions:
  - ler `Authorization: Bearer ...`
  - extrair o token explicitamente
  - validar o token explicitamente (`getClaims(token)` ou `getUser(token)`, conforme o padrão suportado no projeto)
  - só depois seguir com as consultas RLS
- Adicionar logs objetivos na função para distinguir claramente:
  - sem header
  - token inválido/expirado
  - usuário sem acesso à empresa
  - usuário fora da equipe do evento
  - erro na RPC `bulk_upsert_contatos`

**Verificação:** a função precisa deixar de retornar 401 para usuário válido e, se houver falha, o log deve mostrar o motivo exato.

### 2) Parar de depender exclusivamente de `functions.invoke` nesse ponto crítico
- Ajustar `src/components/NovoLeadModal.tsx` para chamar a Edge com `fetch` explícito e enviar:
  - `Authorization: Bearer <access_token>`
  - `apikey`
  - `Content-Type: application/json`
- Continuar com o `ensureSession()`, mas usar o token retornado da sessão atual/refresh imediatamente na chamada.
- Manter a mesma UX atual de erro, mas separar melhor:
  - 401 real de autenticação
  - 403 de regra de acesso
  - 409 de duplicado/quarentena/opt-out

**Verificação:** a request do navegador precisa mostrar o header Authorization enviado explicitamente e o retorno correto da função.

### 3) Blindar a UI contra a tela branca causada por mutação externa no DOM
- Adicionar uma proteção mínima e localizada no bootstrap do app para o erro conhecido de `removeChild`/`insertBefore` causado por Google Translate/extensões.
- A proteção será conservadora: apenas impedir que a operação exploda quando o nó já não pertencer mais ao mesmo pai.
- Não vou mexer no fluxo funcional do modal nem no Kanban além disso.

**Verificação:** o erro `NotFoundError: Failed to execute 'removeChild' on 'Node'` deve parar de derrubar a tela inteira.

### 4) Validar ponta a ponta
- Testar o fluxo de criação do lead no modal.
- Confirmar:
  - sem logout
  - sem redirecionamento indevido
  - sem tela branca
  - lead criado no mesmo padrão do importador
- Se ainda houver falha, os novos logs vão apontar exatamente em qual etapa ela acontece.

## Arquivos a alterar
- `supabase/functions/create-lead/index.ts`
- `src/components/NovoLeadModal.tsx`
- `src/main.tsx` ou um pequeno util importado no bootstrap para a proteção de DOM

## Fora de escopo
- Não vou alterar o fluxo de importação.
- Não vou mexer em permissões de vendedor, porque o problema atual não aponta para falta de permissão de negócio.
- Não vou refatorar o AuthContext inteiro, apenas o necessário para estabilizar este fluxo.

## Resultado esperado
- Usuário válido deixa de receber 401 intermitente ao criar lead.
- O modal deixa de depender de propagação implícita de sessão.
- A tela branca causada por mutação externa do DOM deixa de derrubar o app.