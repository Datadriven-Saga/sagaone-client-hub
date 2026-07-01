# API `create-lead-ligacao`

**Área:** APIs
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## O que é

Endpoint para inserir leads no canal **Ligação (voz IA)**. Vive em paralelo ao `create-lead` porque a base de voz tem tabelas próprias (`prospect_pri_voz`, `eventos_pri_voz`, `cadencia_pri_voz`) — mirror externo via webhook (memory `external-pri-backup-tables`).

## Endpoint

```
POST https://<project>.supabase.co/functions/v1/create-lead-ligacao
```

## Autenticação

```
saga_one_supabase: <SAGA_ONE_ADMIN_TOKEN>
```

## Payload

```json
{
  "empresa_id": "uuid",
  "evento_ligacao_id": "uuid | int",
  "nome": "string",
  "telefone": "string"
}
```

## Resposta

```json
{ "success": true, "prospect_id": "uuid", "duplicado": false }
```

## Regras

- Identificação do agente segue `agente_empresas` + telefone ≥10 dígitos (memory `agent-identification-rules`).
- Inserção em `prospect_pri_voz` — vínculo com `eventos_pri_voz` idempotente.
- Mirror externo via `sync-contatos-ligacao` (memory `external-pri-backup-tables`).

## Relacionado

- [IA de Ligação](../prospeccao/ia-ligacao.md)
- [`create-lead-pri`](./create-lead-pri.md)