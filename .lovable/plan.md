## Situação atual

- **1.522 leads** com `responsavel_email` inválido (não existe em `auth.users`):
  - 920 apenas números (SAGA vendedor ID)
  - 387 com `@` mas typo (`.brs`, domínios errados)
  - 215 texto livre ("não", nomes)
  - 0 UUID (já limpos na Fase A)
- Hoje `bulk_upsert_contatos` valida `responsavel_email` **apenas no INSERT** e, quando inválido, salva o lead com `responsavel_email = NULL` (conta em `responsavel_skipped`). O lead é criado normalmente.
- `process-import` já expõe `responsavel_skipped` / `rejected_responsavel`, mas o fluxo hoje **importa mesmo assim** — não devolve a linha ao usuário para reimportar.

## O que muda

### 1. Backfill: liberar leads órfãos para redistribuição

Um único `UPDATE` limpando `responsavel_email` (→ `NULL`) nos 1.522 leads cujo email não existe em `auth.users`. Assim eles voltam ao pool de distribuição normal.

Registro em `logs_prospeccoes` com motivo `backfill_responsavel_invalido` para auditoria.

### 2. Importação de planilha: rejeitar linha com responsável inválido

Mudança **apenas no caminho de planilha** (`process-import` + `bulk_upsert_contatos`):

- Novo parâmetro `p_strict_responsavel boolean DEFAULT false` em `bulk_upsert_contatos`.
- Quando `true` **e** a linha tem `responsavel_email` preenchido mas inválido (não resolve em `profiles`/`auth.users`):
  - Lead **não é criado nem atualizado**.
  - Incrementa contador novo `skipped_responsavel_invalido`.
  - Retorna detalhe `{ telefone, nome, responsavel_email, motivo: 'responsavel_inexistente' }` em `error_details` (mesma estrutura que os outros skips já mostrados na UI).
- `process-import` chama com `p_strict_responsavel = true` e propaga o novo contador em `import_logs` (nova coluna `skipped_responsavel_invalido int default 0`).
- **Regra chave**: se `responsavel_email` na planilha vier vazio → segue o fluxo normal (lead criado sem responsável, disponível para distribuição). Só bloqueia quando vem preenchido e inválido.

### 3. UI de resultado da importação (`UploadPlanilha.tsx`)

Adicionar bloco de aviso quando `skipped_responsavel_invalido > 0`:

- Mensagem: "N leads não foram importados porque o responsável informado não existe no sistema. Reimporte com um email válido ou deixe a coluna em branco para distribuição automática."
- Botão "Baixar leads pendentes" → CSV com as linhas rejeitadas (telefone, nome, responsavel_email, motivo), tirado de `error_details`.

### 4. Outros caminhos (pool, sync externo, criação manual)

Ficam com o comportamento atual (silenciosamente `NULL` quando inválido) — a mudança estrita fica isolada à planilha, que é o único caminho onde o usuário controla a coluna e pode corrigir.

## Tradeoffs

| Opção | Prós | Contras |
|---|---|---|
| **Rejeitar linha (escolhida p/ planilha)** | Dado do usuário fica intacto; ele corrige e reimporta; nunca gera lead "meio-atribuído" silenciosamente | Requer reimportação; usuário precisa ler o aviso |
| Aceitar com `NULL` silencioso (hoje) | Não perde lead | Usuário não descobre o erro; lead entra na distribuição sem intenção clara |
| FK dura em `responsavel_email` | Impossível gravar inválido | Quebraria imports parciais, sync externo, migrações; alto risco |
| Trigger global de validação | Cobre todos os caminhos | Já vimos que sync/pool preenchem sem intenção; quebraria fluxos legítimos hoje. Melhor manter o guard só na planilha + `NULL` nos outros. |

## Prevenção futura (já ativa hoje, mantém)

- `bulk_upsert_contatos` v2 valida `responsavel_email` no INSERT (Fase B já feita).
- `sync-contatos-ligacao` força `NULL` (Fase B).
- Frontend usa `user.email` (não UUID) desde Fase A.
- Novo: planilha vira o único ponto onde o valor bruto do usuário passa por validação estrita **com feedback**.

## Testes obrigatórios (regra crítica do projeto p/ `bulk_upsert_contatos`)

1. Planilha com responsavel vazio → cria lead sem responsável.
2. Planilha com email válido → cria com responsável.
3. Planilha com email typo (`.brs`) → **rejeita**, aparece no relatório.
4. Planilha com número puro → **rejeita**, aparece no relatório.
5. Planilha mista (válidos + inválidos) → válidos entram, inválidos ficam pendentes.
6. Pool → segue silencioso com `NULL` (não muda).
7. Contato existente sendo revinculado → não afetado (validação só no INSERT).
8. Quarentena + telefone duplicado no arquivo → contadores existentes intactos.

## Detalhes técnicos

- Migration:
  - `ALTER TABLE import_logs ADD COLUMN skipped_responsavel_invalido int NOT NULL DEFAULT 0;`
  - `CREATE OR REPLACE FUNCTION bulk_upsert_contatos(..., p_strict_responsavel boolean DEFAULT false)` — mantém assinatura antiga funcional via default.
  - Backfill: `UPDATE contatos SET responsavel_email = NULL WHERE responsavel_email NOT IN (SELECT email FROM auth.users) AND responsavel_email IS NOT NULL;` + log agregado.
- Edge function `process-import`: passar `p_strict_responsavel: true`, somar `skipped_responsavel_invalido`, propagar `error_details` com motivo.
- `src/components/UploadPlanilha.tsx`: bloco de aviso + export CSV das linhas rejeitadas.
