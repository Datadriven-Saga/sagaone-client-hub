## Objetivo

Estender a edge function `upload-template-image` para aceitar **imagem e vídeo**, renomeando conceitualmente para upload de mídia de templates. Mantém auth via `SAGA_ONE_ADMIN_TOKEN` (header `x-admin-token` ou `Authorization`) e retorna URL pública + tamanho exato.

## Mudanças

### `supabase/functions/upload-template-image/index.ts`

1. **Ampliar allowlist de MIME**:
   - Imagem (mantém): `image/jpeg`, `image/png`, `image/webp`, `image/gif`
   - Vídeo (novo): `video/mp4`, `video/3gpp`
2. **Limites por tipo** (alinhado com Meta WhatsApp):
   - Imagem: 5 MB
   - Vídeo: 16 MB
3. **Extensões novas**: `video/mp4` → `mp4`, `video/3gpp` → `3gp`
4. **Path no bucket**: continua `templates-api/{idpri}/{timestamp}-{rand}.{ext}` — funciona para os dois tipos
5. **Validação de agente**: mantém lookup em `agentes_ia` + `controle_agentes` por telefone normalizado
6. **Resposta**: já retorna o necessário — manter
   ```json
   { "url": "<public_url>", "path": "...", "bucket": "whatsapp-templates", "size": <bytes>, "mime_type": "...", "idpri": "..." }
   ```

### `supabase/config.toml`

Adicionar entrada (atualmente não tem) para a função, com `verify_jwt = false` — auth é via admin token customizado:

```toml
[functions.upload-template-image]
verify_jwt = false
```

## Contrato da API

**Endpoint**: `POST https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/upload-template-image`

**Headers**:
- `x-admin-token: <SAGA_ONE_ADMIN_TOKEN>` (ou `Authorization: <token>`)

**Body** (`multipart/form-data`):
- `idpri` (ou `telefone`): telefone da PRI (com ou sem DDI/9º dígito — normalizado automaticamente para 10 dígitos)
- `file`: binário (imagem ou vídeo)

**Resposta 200**:
```json
{
  "url": "https://.../storage/v1/object/public/whatsapp-templates/templates-api/<idpri>/<ts>-<rand>.<ext>",
  "path": "templates-api/<idpri>/<ts>-<rand>.<ext>",
  "bucket": "whatsapp-templates",
  "size": 1234567,
  "mime_type": "video/mp4",
  "idpri": "<10 dígitos>"
}
```

**Erros**: 400 (MIME inválido / tamanho excedido / campos faltando), 401 (token), 404 (agente não encontrado), 500 (storage/config).

## Pontos a confirmar

1. O bucket `whatsapp-templates` precisa estar **público** (a função usa `getPublicUrl`). Vou assumir que já está — se não, preciso torná-lo público antes.
2. Manter o nome `upload-template-image` (já em uso) ou renomear para `upload-template-media`? Renomear quebra qualquer integração já apontando para a URL atual.
