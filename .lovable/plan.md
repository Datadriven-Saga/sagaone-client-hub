## Objetivo

Quando um template é sincronizado (ex.: id_meta `1350467496960761` / id_pri `1675` na Paty Hyundai GO empresa Admin), o preview do WhatsApp deve montar 100% (header de mídia, body, footer e botões) a partir dos dados retornados pela API de sync.

## Contrato esperado da API de sync (padrão Meta)

A API deve devolver, além do `id_meta`/`id_pri`, o array `components` no shape Meta. Exemplo mínimo:

```json
{
  "id_meta": "1350467496960761",
  "id_pri": "1675",
  "name": "nome_template",
  "language": "pt_BR",
  "category": "MARKETING",
  "status": "APPROVED",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": {
        "header_handle": [
          "https://karcxgnfiymlrkbzhewo.supabase.co/storage/v1/object/public/whatsapp-templates/templates-api/6230302248/1780942410984-bniu1ngt.jpg"
        ]
      }
    },
    { "type": "BODY", "text": "Olá {{1}}, ..." },
    { "type": "FOOTER", "text": "Saga" },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Sim" },
        { "type": "URL", "text": "Saber mais", "url": "https://..." }
      ]
    }
  ]
}
```

Regras:
- `HEADER` pode ser `IMAGE`, `VIDEO` ou `TEXT`. Para mídia, a URL pública do bucket `whatsapp-templates` em `header_handle[0]` é suficiente (bucket é público, confirmado).
- `BODY.text` é obrigatório — vira `conteudo`. Pode conter `{{N}}`.
- `FOOTER.text` é opcional.
- `BUTTONS.buttons[]` aceita `QUICK_REPLY`, `URL`, `PHONE_NUMBER`. Cada um precisa de `text` (e `url`/`phone_number` quando aplicável).

## Mudanças no SagaOne

### 1) `src/pages/pos-vendas/TemplatesPaty.tsx` (fluxo de sync)
- Ao receber a resposta da API externa, passar `components` por `transformMetaToPriComponents` (já existe em `src/lib/metaTemplateSync.ts`).
- Persistir em `whatsapp_templates`:
  - `formato` ← retorno (`texto`/`botao`/`imagem`/`video`)
  - `conteudo` ← `body` text
  - `card_data` ← `{ imagemUrl, videoUrl, textoCabecalho, rodape, botoes }`
  - `id_meta`, `id_pri`, `categoria` (via `mapMetaCategory`), `status`
  - `components_pri` ← `priComponents` (para disparo posterior)
- Pular `downloadMediaAsBase64`: como a URL já é do nosso bucket público, não precisa rebaixar/re-upar.

### 2) `src/lib/metaTemplateSync.ts`
- Já cobre o caso. Confirmar que `cardData.botoes` mantém `{ nome, buttonId }` (compatível com `TemplatePreview`).
- Nenhuma alteração estrutural — só validar com um template real.

### 3) `TemplatePreview.tsx`
- Sem mudanças. Já lida com `imagemUrl`, `videoUrl`, `rodape`, `botoes`, `textoCabecalho`.

## Validação

Testar com o template já sincronizado (id_pri `1675`):
1. Reexecutar sync → verificar `whatsapp_templates` populado com `card_data` correto.
2. Abrir preview em `/pos-vendas/templates` → conferir mídia, body, footer e botões.
3. Repetir com template `formato: video` e `formato: texto` puro.

## Fora de escopo

- Disparo do template (já usa `components_pri`).
- Mudanças no bucket / RLS (já público).
- API externa em si — só estamos definindo o contrato que ela deve cumprir.
