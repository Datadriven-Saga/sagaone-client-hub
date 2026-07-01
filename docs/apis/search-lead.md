# API `search-lead`

**Área:** APIs
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## O que é

Endpoint de busca de contatos por telefone/nome, usado por integrações externas que precisam checar se um lead já existe antes de criar.

## Endpoint

```
POST https://<project>.supabase.co/functions/v1/search-lead
```

## Autenticação

```
saga_one_supabase: <SAGA_ONE_ADMIN_TOKEN>
```

## Payload

```json
{
  "empresa_id": "uuid",
  "telefone": "string?",
  "nome": "string?"
}
```

Ao menos `telefone` **ou** `nome` deve ser informado.

## Resposta

```json
{
  "results": [
    {
      "contato_id": "uuid",
      "nome": "string",
      "telefone": "string",
      "status": "string",
      "eventos": [{ "prospeccao_id": "uuid", "nome": "string" }]
    }
  ]
}
```

## Regras

- Telefone é normalizado antes da busca.
- Restringe à `empresa_id` informada (não faz busca cross-empresa).
- Nome usa `ILIKE '%<nome>%'`.

## Relacionado

- [`create-lead`](./create-lead.md)
- [`create-lead-pri`](./create-lead-pri.md)
- [Busca por sufixo de telefone](../recepcao/busca-sufixo-telefone.md)