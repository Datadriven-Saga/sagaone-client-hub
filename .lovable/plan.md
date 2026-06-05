## Objetivo

Criar uma API pública para subir imagens de template no SagaOne usando o token da Pri. Você envia o telefone do agente + o arquivo binário (multipart) e recebe de volta a URL pública do bucket `whatsapp-templates`.

## Endpoint

`POST https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/upload-template-image`

### Headers
- `Authorization: Bearer <SAGA_ONE_ADMIN_TOKEN>` (obrigatório)
- `Content-Type: multipart/form-data` (automático)

### Body (multipart/form-data)
- `idpri` (string) — telefone do agente (com ou sem DDI/9, será normalizado)
- `file` (binário) — a imagem (JPG/PNG/WebP/GIF), máx. 5 MB

### Resposta 200
```json
{
  "url": "https://karcxgnfiymlrkbzhewo.supabase.co/storage/v1/object/public/whatsapp-templates/templates-api/<idpri>/<timestamp>-<rand>.jpg",
  "path": "templates-api/<idpri>/<timestamp>-<rand>.jpg",
  "size": 123456,
  "mime_type": "image/jpeg"
}
```

### Erros
- `401` token ausente/inválido
- `400` `idpri` ou `file` faltando, mime não permitido, arquivo > 5 MB
- `404` agente não encontrado
- `500` falha no upload

## Validações

1. **Auth**: bate `Authorization` com `SAGA_ONE_ADMIN_TOKEN`. Sem match → 401.
2. **Agente**: normaliza `idpri` (remove DDI 55 + 9º dígito quando aplicável) e procura em `agentes_ia.telefone` **ou** `controle_agentes.telefone`. Se não achar → 404.
3. **Arquivo**: aceita `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Limite 5 MB.

## Storage

- Bucket: `whatsapp-templates` (já existe, público).
- Path: `templates-api/<idpri_normalizado>/<timestamp>-<random>.<ext>`.
- Upload via `service_role` (sem `upsert`).
- Retorna `getPublicUrl()`.

## Detalhes técnicos

- Arquivo: `supabase/functions/upload-template-image/index.ts`.
- CORS liberado (mesmo padrão das outras edges públicas).
- `verify_jwt = false` (auth é feita manualmente pelo token admin).
- Usa `Deno.env.get('SAGA_ONE_ADMIN_TOKEN')` e `SUPABASE_SERVICE_ROLE_KEY` (já disponíveis).
- Reaproveita a regra de normalização de telefone já documentada (DDI 55 + 9º dígito).

## Exemplo cURL

```bash
curl -X POST https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/upload-template-image \
  -H "Authorization: Bearer $SAGA_ONE_ADMIN_TOKEN" \
  -F "idpri=11999998888" \
  -F "file=@/caminho/imagem.jpg"
```

## Fora do escopo

- Não cria template na PRI nem envia mídia para a Meta — só sobe a imagem e devolve a URL pública.
- Não mexe em UI nem no fluxo atual do `TemplatesPaty.tsx`.
