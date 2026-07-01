# API `create-lead`

**Área:** APIs
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## O que é

Endpoint genérico para criar/atualizar um lead vinculado a uma prospecção. Diferente de `create-lead-pri` (específico da PRI) e `create-lead-ligacao` (canal voz).

## Endpoint

```
POST https://<project>.supabase.co/functions/v1/create-lead
```

## Autenticação

Header:
```
saga_one_supabase: <SAGA_ONE_ADMIN_TOKEN>
```

## Payload

```json
{
  "empresa_id": "uuid",
  "prospeccao_id": "uuid",
  "nome": "string",
  "telefone": "string (com ou sem DDI)",
  "email": "string?",
  "origem": "string?"
}
```

## Resposta

```json
{ "success": true, "contato_id": "uuid", "duplicado": false }
```

## Regras

- Chama `bulk_upsert_contatos` com lote de 1.
- `duplicado=true` quando o contato já existia (dedup por telefone).
- Vínculo em `eventos_prospeccao` é idempotente.

## Erros

| HTTP | Causa |
|---|---|
| 401 | Token ausente/inválido |
| 400 | Payload sem `empresa_id`/`telefone`/`nome` |
| 500 | Falha da RPC (ver logs) |

## Relacionado

- [`create-lead-pri`](./create-lead-pri.md)
- [`bulk_upsert_contatos`](../importacao/bulk-upsert-contatos.md)