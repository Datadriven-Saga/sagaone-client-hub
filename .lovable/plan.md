## Objetivo

Alterar o botão "Sincronizar" individual em `/pos-vendas/templates` para que ele apenas dispare o webhook `criar-template-pri-from-meta` com `pri_telefone` e `id_meta`. O webhook é quem recria a V2 e devolve os identificadores. O front só persiste o resultado em `whatsapp_templates` e atualiza a lista.

## Comportamento atual (a remover)

Hoje `handleSincronizarTemplate` faz no front:
1. `transformMetaToPriComponents` + download de mídia em base64
2. Chamada extra `upload-media-meta` para gerar `media_id`
3. Chamada `criar-template-pri-from-meta` com `components`, `conteudo`, `tem_vars`, `categoria`, `language`, `nome`
4. INSERT em `whatsapp_templates`

## Comportamento novo

`handleSincronizarTemplate(meta)` passa a ter um único caminho:

```text
Front
  └─ supabase.functions.invoke("external-webhook-proxy", {
       endpoint: "criar-template-pri-from-meta",
       pri_telefone: priTelefone,
       id_meta: meta.id
     })
  ── resposta no MESMO formato do retorno de criação de template:
       {
         template_id_pri,
         id_meta,        // novo id da V2
         status_meta,    // ex: PENDING/APPROVED
         category_meta,
         nome,           // nome v2 retornado pelo webhook
         conteudo,
         formato,        // texto/botao/imagem/video
         card_data,      // estrutura usada pelo TemplatePreview
         categoria       // marketing/utilidade/autenticacao
         // (campos opcionais: webhook_status, webhook_ok, raw_response, error_*)
       }
  └─ INSERT em whatsapp_templates com os campos retornados
  └─ refetchTemplates() + remover de metaOnlyTemplates
```

Erros HTTP (webhook_ok=false / webhook_status≠200) seguem a mesma convenção de `handleSave`: toast com `error_user_title`/`error_user_msg`/`raw_response`, sem inserir.

## Arquivos alterados

- `src/pages/pos-vendas/TemplatesPaty.tsx`
  - Reescrever `handleSincronizarTemplate` para o fluxo único acima.
  - Remover do arquivo o uso de `transformMetaToPriComponents`, `downloadMediaAsBase64`, `mapMetaCategory` e a chamada `upload-media-meta` **apenas dentro deste handler** (as funções permanecem no `metaTemplateSync.ts` caso sejam usadas em outro lugar — confirmar antes de remover imports).

## Campos do INSERT em `whatsapp_templates`

Preenchidos com a resposta do webhook (sem mais derivar do `meta.*`):

- `empresa_id` = `activeCompany.id`
- `agente_id` = `selectedAgenteId`
- `pri_telefone` = `priTelefone`
- `nome`, `categoria`, `category_meta`, `formato`, `conteudo`, `card_data`, `id_meta`, `template_id_pri`, `status_meta` ← resposta do webhook
- `status` = `"aprovado"` se `status_meta === "APPROVED"`, senão `"pendente"` (mesmo critério de `handleSave`)
- `ativo` = `true`
- `variable_mapping` = `{}`

## Pontos a confirmar com o usuário

1. O webhook realmente devolverá `nome`, `conteudo`, `formato`, `card_data`, `categoria` prontos? Se algum desses não vier, precisamos definir fallback (ex.: derivar `categoria` de `category_meta` via `mapMetaCategory`).
2. Como tratar quando `status_meta` voltar `PENDING` (não-aprovado ainda)? Manter `status='pendente'` e deixar o template aparecer na lista normalmente, igual hoje em `handleSave`?
3. Manter `metaOnlyTemplates`/botão "Sincronizar com Meta" intactos — só o handler individual muda. Confirma?
