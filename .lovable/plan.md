# Fix: imagem some no preview após sincronizar template da Meta

## Causa raiz

O webhook `criar-template-pri-from-meta` devolve o `header_handle` da imagem como **string** simples:

```json
"example": { "header_handle": "https://.../1780952940983-boexqt65.jpg" }
```

Mas `transformMetaToPriComponents` em `src/lib/metaTemplateSync.ts` assume o shape oficial da Meta Graph API (`header_handle: string[]`) e faz:

```ts
const headerUrl = comp.example?.header_handle?.[0] || "";
```

Em string, `[0]` retorna `"h"` (primeiro caractere). O guard `isValidUrl` no `handleSincronizarTemplate` rejeita corretamente esse `"h"`, mas como o fallback (`fromMeta.imagemUrl`) também é `"h"`, o `card_data.imagemUrl` é salvo como `""` e o preview mostra placeholder.

Confirmado no banco para `template_id_pri=1686` / `entrega_agendada_test_v2`:
```
card_data.imagemUrl = ""   (formato=imagem)
```

## Mudança

### `src/lib/metaTemplateSync.ts`

Normalizar `header_handle` aceitando string OU array:

```ts
const rawHandle = comp.example?.header_handle;
const headerUrl = Array.isArray(rawHandle)
  ? (rawHandle[0] || "")
  : (typeof rawHandle === "string" ? rawHandle : "");
```

Ajustar também o tipo `MetaComponent.example.header_handle` para `string | string[]`.

Nenhuma outra parte do código precisa mudar — o `handleSincronizarTemplate` já tem o merge correto com `isValidUrl`, ele só estava recebendo `"h"` em ambos os lados.

## Correção do registro existente (1686)

Após o fix de código, posso atualizar o registro `550dfc92-feb1-4e84-9e51-96bd1be6864a` setando `card_data.imagemUrl` para a URL pública correta (`https://karcxgnfiymlrkbzhewo.supabase.co/storage/v1/object/public/whatsapp-templates/templates-api/6230302248/1780952940983-boexqt65.jpg`) via migration de UPDATE, sem precisar re-sincronizar. Confirmar com você antes de rodar.

## Validação

1. Re-sincronizar um template novo com header IMAGE → `card_data.imagemUrl` deve conter URL `https://...` completa.
2. Abrir preview → imagem aparece.
3. Conferir que templates sem header continuam funcionando (string vazia / undefined).
