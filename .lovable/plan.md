## Endpoint `create-lead-pri`

Nova Edge Function dedicada para criação de leads pela Pri IA, espelhando o padrão de `create-lead-ligacao` mas para o fluxo de prospecção WhatsApp.

### Contrato

`POST /functions/v1/create-lead-pri`

Headers:
- `Authorization: Bearer <SAGA_ONE_ADMIN_TOKEN>`
- `Content-Type: application/json`

Body:
```json
{
  "nome": "Fulano",
  "telefone": "62999999999",
  "prospeccao_id": "uuid-do-evento-sagaone",
  "origem": "mobi | whatsapp_pri",
  "id_evento_pri": "opcional - rastreio reverso",
  "observacoes": "opcional"
}
```

Respostas:
- `201` — lead criado e vinculado ao evento, status `Atribuído`, responsável = Pri IA.
- `200` — lead já existia; vinculado ao evento se faltava o vínculo. Retorna `lead_id`, `contato_id`, `duplicado: true`, `vinculo_criado: true|false`.
- `400/401/404` — validações.

### Campo `origem`

- No payload aceita `mobi` (cadastro em redes sociais via Mobi) ou `whatsapp_pri` (conversa direta com a Pri).
- Persistido em `contatos.origem_pri` (nova coluna TEXT nullable) para não colidir com `contatos.origem` já usado pelo CRM. Mapeamento para o nome final do CRM fica para depois.
- Valor é validado contra um enum estrito no código (rejeita qualquer outro valor).
- Migration mínima: `ALTER TABLE contatos ADD COLUMN origem_pri text NULL;` + índice opcional `(empresa_id, origem_pri)` para relatórios futuros.

### Lógica

1. Autentica via `SAGA_ONE_ADMIN_TOKEN`.
2. Valida `nome`, `telefone`, `prospeccao_id`, `origem`.
3. Resolve `prospeccoes` por UUID — extrai `empresa_id`. Bloqueia se evento estiver encerrado/inativo (retorna 400).
4. Normaliza telefone com a mesma função canônica usada em `create-lead` (remove DDI 55, 9º dígito).
5. **Sem opt-out global e sem quarentena** — a Pri só cria lead após opt-in (campanha ou mensagem recebida). Documentar essa premissa.
6. Chama `bulk_upsert_contatos` com 1 item para reaproveitar a deduplicação e o vínculo automático em `eventos_prospeccao` (regra do projeto: não alterar essa RPC). Os contadores `global_blocked`/`quarantined` retornados são ignorados aqui — se houver bloqueio, ainda assim seguimos com o vínculo, pois Pri tem opt-in (decisão de produto). Caso prefira respeitar opt-out global por segurança jurídica, retornar 409 — confirmar antes de implementar.
7. Recupera o contato resultante e seta `origem_pri` no `UPDATE` final.
8. **Atribuição "Pri IA"**: se o contato é novo OU está em `Novo`, atualiza `status = 'Atribuído'` e `responsavel_email` = e-mail do system user Pri IA (resolvido em runtime conforme `mem://identity/system-user-pri-ia`). Status já avançado é preservado.
9. **Sem `trigger-webhook`**. Como o evento é WhatsApp IA da Pri, não faz sentido reenviar para o sync de Mobi/movimentação Kanban. A criação fica silenciosa para integrações externas — apenas auditoria interna.
10. Loga em `logs_prospeccoes` com `origem='pri'` para auditoria (criação + vínculo).

### Tratamento de duplicidade

- Diferente de `create-lead` (que retorna 409), aqui reaproveita:
  - Se contato existe na empresa: usa o existente.
  - Verifica vínculo em `eventos_prospeccao` para `(contato_id, prospeccao_id)`. Se não existe, `bulk_upsert_contatos` já cria (regra `IF NOT EXISTS`).
  - Se a coluna `origem_pri` estiver vazia no contato existente, preenche; se já tem valor diferente, **mantém o original** e devolve no response um campo `origem_pri_existente` para a Pri saber.
  - Retorna `200` com flags `duplicado`, `vinculo_criado`, status atual e responsável atual.

### Documentação

Criar `docs/api-create-lead-pri.md` com:
- Contrato, exemplos cURL, códigos de erro.
- Diferenças vs `create-lead` e `create-lead-ligacao` (tabela comparativa).
- Premissa de opt-in (por isso pula quarentena/opt-out).
- Política de não-regressão de status.
- Por que NÃO dispara `trigger-webhook` (evento IA WhatsApp ≠ sync Mobi).
- Mapa de `origem` Pri → `origem_pri` no SagaOne (e nota que renomear depois é tarefa separada).

### Fora do escopo

- Não criar tabela/coluna nova para `id_evento_pri` (fica em `observacoes` como metadado textual).
- Não mexer em `bulk_upsert_contatos`.
- Não criar token novo.
- Não disparar webhooks externos nesta versão.

### Decisão pendente antes de codar

- Respeitar `global_opt_outs` mesmo com opt-in declarado pela Pri? (recomendação: respeitar, retornando 409 — risco regulatório baixo e mantém uma camada de segurança). Confirmar.