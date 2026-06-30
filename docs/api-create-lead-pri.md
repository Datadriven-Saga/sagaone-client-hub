# API `create-lead-pri`

Endpoint dedicado para criação de leads pela **Pri IA** (conversas WhatsApp ou cadastros vindos do Mobi). O lead nasce já vinculado a um evento da Pri no SagaOne e atribuído à própria Pri IA.

## Endpoint

`POST https://<projeto>.functions.supabase.co/create-lead-pri`

Headers:

- `Authorization: Bearer <SAGA_ONE_ADMIN_TOKEN>`
- `Content-Type: application/json`

## Body

```json
{
  "nome": "Fulano de Tal",
  "telefone": "62999998888",
  "prospeccao_id": "uuid-do-evento-no-sagaone",
  "origem": "mobi",                       // ou "whatsapp_pri"
  "id_evento_pri": "evt_123",             // opcional — rastreio reverso
  "observacoes": "texto livre"            // opcional
}
```

- `prospeccao_id` é o UUID do evento no SagaOne (tabela `prospeccoes`). Todo evento da Pri nasce a partir do SagaOne, então a Pri sempre tem esse ID.
- `origem` aceita apenas dois valores:
  - `mobi` — cadastro veio das redes sociais via Mobi.
  - `whatsapp_pri` — conversa direta da Pri no WhatsApp.
- `id_evento_pri` é guardado em `contatos.observacoes` como `pri_evento_id:<valor>` para rastreio.

## Respostas

### 201 — lead criado
```json
{
  "success": true,
  "duplicado": false,
  "vinculo_criado": true,
  "lead_id": 12345,
  "contato_id": "uuid",
  "status": "Atribuído",
  "responsavel_email": "pri.ia@sagadatadriven.com.br",
  "origem_pri": "whatsapp_pri",
  "origem_pri_existente": null,
  "prospeccao_id": "uuid",
  "empresa_id": "uuid",
  "evento": "Nome do evento"
}
```

### 200 — lead já existia (deduplicação)
Mesmo formato, com `duplicado: true`. O vínculo `contato ↔ evento` em `eventos_prospeccao` é garantido (criado se faltava). O campo `origem_pri_existente` é preenchido quando o contato já tinha uma origem Pri diferente da informada — a origem original é preservada.

### 400 / 401 / 404
Validações de payload, token e existência do evento.

## Regras de negócio

1. **Opt-in implícito**: se a Pri está criando o lead, o cliente já interagiu com ela (campanha ou mensagem direta). Por isso o endpoint **não consulta** `global_opt_outs` nem aplica `quarentena`. Auditoria fica em `logs_prospeccoes`.
2. **Atribuição automática**: contato novo (ou em status `Novo` sem responsável) é movido para `Atribuído` com `responsavel_email = pri.ia@sagadatadriven.com.br`. Status já avançado nunca é regredido.
3. **Deduplicação**: usa `bulk_upsert_contatos` (RPC oficial). Mesma regra de planilha/pool — chave `(empresa_id, telefone_normalizado)`. O vínculo em `eventos_prospeccao` é `IF NOT EXISTS`.
4. **Telefone**: normalizado pela mesma regra do sistema — remove DDI 55 e 9º dígito de celular.
5. **`origem_pri` (novo campo)**: persistido em `contatos.origem_pri`. Coluna separada de `contatos.origem` (que é usada pelo CRM com outro vocabulário). Quando renomearmos no CRM, é só mapear depois.
6. **Sem `trigger-webhook`**: o evento é WhatsApp IA da Pri e **não cai no sync do Mobi/Kanban**. O endpoint é silencioso para integrações externas — só registra auditoria interna.

## Comparação com endpoints irmãos

| Aspecto                  | `create-lead`          | `create-lead-ligacao`    | `create-lead-pri`             |
|--------------------------|------------------------|--------------------------|-------------------------------|
| Canal                    | WPP genérico (form)    | Ligação (Voz)            | Pri IA (WhatsApp / Mobi)      |
| Identifica evento por    | `event_id` n8n         | `id_evento` numérico Pri | `prospeccao_id` (UUID Saga)   |
| Duplicidade              | 409 Conflict           | 200 com dados existentes | 200 com dados existentes      |
| Opt-out / quarentena     | Aplica                 | N/A                      | **Pula** (opt-in implícito)   |
| Status inicial           | `Novo`                 | `Novo`                   | `Atribuído` (responsável Pri) |
| Dispara `trigger-webhook`| Sim                    | Sim                      | **Não** (não vai p/ Mobi)     |

## cURL

```bash
curl -X POST \
  -H "Authorization: Bearer $SAGA_ONE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste Pri",
    "telefone": "62999998888",
    "prospeccao_id": "b5522986-46cf-4d3d-8e20-56820fb6c27e",
    "origem": "whatsapp_pri",
    "id_evento_pri": "evt_abc123"
  }' \
  https://karcxgnfiymlrkbzhewo.functions.supabase.co/create-lead-pri
```

## Notas operacionais

- Tabela alterada: `contatos` ganhou coluna `origem_pri text NULL` + índice parcial `(empresa_id, origem_pri)`.
- Mapeamento futuro de vocabulário: `origem_pri` (Pri) → `origem` (CRM). Manter retrocompatibilidade ao renomear.
- Edge function está em `verify_jwt = false`; autenticação é exclusivamente via `SAGA_ONE_ADMIN_TOKEN`.