## Objetivo

Permitir editar, na tela **Administração → Webhooks**, tanto o **nome do header de autenticação** (`credencial_header`, ex.: `x-api-key`, `saga_one_supabase`, `authorization`) quanto o **nome do secret** que fornece o valor (`credencial_secret_name`, ex.: `SAGA_ONE`) — sem tocar em edge functions.

## Por que é simples

O helper `buildAuthHeaders` em `supabase/functions/_shared/webhook-registry.ts` já monta o header dinamicamente a partir do registry:

- Se `credencial_header = 'authorization'` → envia `Authorization: Bearer <secret>` (mantém compat).
- Qualquer outro nome (`x-api-key`, `saga_one_supabase`, `x-custom-token`, etc.) → envia `<credencial_header>: <secret>` **verbatim**, sem prefixo.

Ou seja, o backend já suporta qualquer header custom. Falta apenas expor edição na UI e persistir no update.

## Mudanças (arquivo único: `src/pages/admin/Webhooks.tsx`)

1. **Sheet de edição (~linhas 714-734)** — substituir o bloco readonly "Credencial exigida" por dois `Input` editáveis:
   - `Nome do secret` (ex.: `SAGA_ONE`) → `editing.credencial_secret_name`
   - `Nome do header` (ex.: `x-api-key`) → `editing.credencial_header`
   - Manter o link "Gerenciar secret" e o hint "use `authorization` para receber prefixo `Bearer` automático; qualquer outro nome é enviado como está".
   - Ambos aceitam vazio → grava `null` (webhook público sem auth).

2. **`handleSave` (linhas 187-195)** — incluir os dois campos no `.update({...})` e no `.select(...)`:
   ```
   credencial_secret_name: editing.credencial_secret_name?.trim() || null,
   credencial_header: editing.credencial_header?.trim() || null,
   ```

3. **Recarregar credenciais** após save (`load()` já refaz o fetch e o `check-webhook-credential` recalcula os badges verde/vermelho).

## O que NÃO muda

- `supabase/functions/_shared/webhook-registry.ts` — já genérico.
- `external-webhook-proxy`, `maia-webhook-proxy`, `dispatch-leads-webhook`, demais edges — todas leem via `resolveWebhookBySlug` + `buildAuthHeaders`. Nenhum redeploy necessário.
- Schema do banco — colunas `credencial_header` e `credencial_secret_name` já existem em `webhook_registry`.
- Secrets — `SAGA_ONE` continua sendo o mesmo secret; só muda o nome do header em que ele viaja.

## Fluxo pós-mudança para o caso `pri_wpp.disparo`

1. Abrir Administração → Webhooks → editar `pri_wpp.disparo`.
2. Trocar campo "Nome do header" de `saga_one_supabase` para `x-api-key`. Manter "Nome do secret" = `SAGA_ONE`.
3. Salvar. A partir da próxima chamada, `dispatch-leads-webhook` passa a enviar `x-api-key: <valor de SAGA_ONE>` para a Lambda AWS — sem deploy.

## Riscos

- Baixíssimos. Se o usuário deixar o header em branco por engano, o webhook passa a chamar sem auth (mesmo comportamento de webhooks sem credencial hoje). Mitigação: badge vermelho já aparece quando `credencial_secret_name` está definido mas o secret não existe; podemos adicionar aviso simétrico se `credencial_secret_name` estiver preenchido e `credencial_header` vazio (validação leve no save).

## Teste de aceite

- Editar um webhook, trocar header de `saga_one_supabase` → `x-api-key`, salvar, reabrir: valor persistiu.
- Chamar o webhook via botão de teste (ou logs do `dispatch-leads-webhook`) e confirmar no destino que chegou `x-api-key`.
- Voltar para `authorization` e confirmar que volta a enviar `Bearer <secret>`.
