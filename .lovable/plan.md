
## Plano: Captura e Propagação do `codigo_proposta` via Webhook de Movimentação

### Objetivo
1. **Capturar** o `codigo_proposta` retornado pelo webhook externo na primeira movimentação (tipicamente "Em Espera") e persistir em `contatos.codigo_proposta`.
2. **Propagar** o `codigo_proposta` em todas as chamadas subsequentes do webhook `movimentacao_lead_kanban`, junto aos dados do lead.

### Análise Atual
- A Edge Function `trigger-webhook` hoje envia o payload no padrão "fire-and-forget" (não lê resposta para persistir).
- O campo `contatos.codigo_proposta` já existe e é usado em disparos WhatsApp/IA Voz, mas só é populado via importação de base.
- Webhooks externos podem retornar JSON com chaves variadas (`proposalId`, `codigo_proposta`, `proposal_id`).

### Mudanças Técnicas

**1. `supabase/functions/trigger-webhook/index.ts`**
- No bloco que processa o gatilho `movimentacao_lead_kanban`:
  - Antes do `fetch`, buscar `codigo_proposta` atual do contato e **incluir no payload enviado** (campo `codigo_proposta` ou `proposalId`).
  - Após o `fetch`, ler `response.json()` (com try/catch).
  - Se resposta contém `codigo_proposta` / `proposalId` / `proposal_id` **e** o contato ainda não tem valor salvo (ou veio diferente), executar `UPDATE contatos SET codigo_proposta = {valor} WHERE id = {contato_id}`.
  - Logar a captura para auditoria.

**2. Payload enviado (estrutura)**
```json
{
  "gatilho": "movimentacao_lead_kanban",
  "dados": {
    "contato_id": "...",
    "lead_id": 123,
    "codigo_proposta": "ABC123",  // ← NOVO: enviado em toda movimentação
    "status_anterior": "...",
    "status_novo": "...",
    "empresa_id": "...",
    "prospeccao_id": "..."
  }
}
```

**3. Resposta esperada do webhook externo (contrato)**
```json
{
  "codigo_proposta": "ABC123"  // aceitar também: proposalId, proposal_id
}
```

### Fluxo Resultante
```text
1ª movimentação (Em Espera):
  ├─ Envia payload SEM codigo_proposta (ainda null)
  ├─ Webhook externo responde { codigo_proposta: "X" }
  └─ Salva em contatos.codigo_proposta

2ª+ movimentações:
  ├─ Busca contatos.codigo_proposta = "X"
  ├─ Envia payload COM codigo_proposta = "X"
  └─ Resposta ignorada (ou re-confirma se vier diferente)
```

### Arquivos Afetados
- `supabase/functions/trigger-webhook/index.ts` (única alteração)

### Memória a Atualizar
- `mem://features/prospeccao/webhook-movimentacao-lead-kanban`: documentar captura/propagação do `codigo_proposta`.

### Validação Pós-Implementação
- Mover lead para "Em Espera" → conferir log da edge function mostrando captura.
- Verificar `SELECT codigo_proposta FROM contatos WHERE id = ...` retorna o valor.
- Mover o mesmo lead para o próximo status → conferir payload de saída inclui `codigo_proposta`.
