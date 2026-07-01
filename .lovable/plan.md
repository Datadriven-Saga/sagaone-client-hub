## Objetivo

Deixar rastro visível toda vez que a Pri IA vincula (ou revincula) um lead a um evento via `create-lead-pri`, usando a mesma superfície de log que a operação já enxerga (`logs_movimentacao_contatos`), sem disparar o webhook do MobiGestor.

## Por que é seguro escrever em `logs_movimentacao_contatos`

O dispatcher (`_shared/movimentacao-lead-webhook.ts`) já tem 2 guardas que garantem skip para chamadas da Pri:

- **Guarda 1 (linha 101-106):** `usuario_id === PRI_IA_USER_ID` → retorna `skipped: true, reason: "pri_ia"` sem tocar no Mobi.
- **Guarda 2 (linha 125-128):** canal precisa ser `Mensal` ou `Grande Evento`. Eventos da Pri normalmente caem fora, mas mesmo se caírem dentro a guarda 1 protege.

Ou seja: basta escrever o log com `usuario_id = PRI_IA_USER_ID` e o webhook Mobi nunca é chamado. Isso já foi a decisão de arquitetura documentada (memória `movimentacao-lead-single-source`).

## Mudanças

### 1. Edge function `create-lead-pri`

- Ler `PRI_IA_USER_ID` do env (já usado pelo dispatcher; mesmo segredo).
- Antes do `bulk_upsert_contatos`, fazer um `SELECT` em `eventos_prospeccao` por `(contato_id, prospeccao_id)` para calcular corretamente `vinculo_ja_existia` (hoje esse valor é sempre `true` porque a checagem é feita depois do upsert).
- Inserir 1 registro em `logs_movimentacao_contatos`:
  - `contato_id`, `prospeccao_id`, `empresa_id`
  - `status_anterior` e `status_novo` = status atual do contato (sem transição, para consistência)
  - `usuario_id` = `PRI_IA_USER_ID` (dispara a trigger mas o dispatcher faz skip)
  - `observacoes` = `Pri IA (${origem}) — vínculo ${vinculo_ja_existia ? "reforçado" : "criado"}${id_evento_pri ? ` | pri_evento_id:${id_evento_pri}` : ""}`
- Se `PRI_IA_USER_ID` não estiver setado, **não** escrever nada em `logs_movimentacao_contatos` (evita risco de webhook Mobi vazar) e logar warning.
- Enriquecer resposta com `vinculo_ja_existia: boolean` (novo campo).
- Enriquecer `logs_prospeccoes.detalhes` com `vinculo_ja_existia` (segue existindo como auditoria interna).

### 2. Documentação `docs/api-create-lead-pri.md`

- Adicionar seção "Rastro / Auditoria":
  - `logs_movimentacao_contatos`: 1 registro por chamada, com `usuario_id = Pri IA`. Aparece no timeline unificado do lead. Trigger dispara o dispatcher mas ele retorna `skipped: pri_ia` — Mobi nunca é chamado.
  - `logs_prospeccoes`: auditoria interna (`lead_criado_pri` / `lead_vinculado_pri`, com `vinculo_ja_existia`).
- Atualizar tabela de resposta com novo campo `vinculo_ja_existia`.
- Nota operacional: exige `PRI_IA_USER_ID` no env da function (mesmo segredo usado pelo dispatcher).

### 3. Fora de escopo

- Nenhuma mudança no dispatcher, na trigger PG, ou em `bulk_upsert_contatos`.
- Nenhuma mudança em atribuição/status.
- `contato_timeline` não é tocado (já é alimentado por outras fontes e o rastro fica em `logs_movimentacao_contatos`).

## Validação

- Confirmar que `PRI_IA_USER_ID` está setado como secret da function (`create-lead-pri` além do dispatcher).
- Rechamar o payload do teste (`Luiz`, evento `345699aa...`):
  - Conferir em `logs_movimentacao_contatos` o novo registro com `usuario_id = Pri IA`.
  - Conferir nos logs da function dispatcher a linha `⏭️ skip pri_ia`.
  - Conferir que **não** houve chamada HTTP para `WEBHOOK_MOVIMENTACAO_LEAD_URL`.
  - Conferir em `logs_prospeccoes` o registro `lead_vinculado_pri` com `vinculo_ja_existia`.
- Chamar 2ª vez com o mesmo payload: novo log em `logs_movimentacao_contatos`, sem duplicar vínculo em `eventos_prospeccao`, sem chamar Mobi.
