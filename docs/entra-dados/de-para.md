# De-Para (mapeamentos S3)

**Área:** Entra Dados
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Tela `/de-para` para cadastrar **tabelas de mapeamento origem→destino** (ex.: nomes de marcas vindas de fontes externas para o padrão interno). Cada mapeamento é gravado como um arquivo JSON no **bucket S3 `dados-custom-entradados`**, prefixo `de-para/`.

Não usa banco Supabase. É um repositório de arquivos consumido por pipelines externos (n8n, jobs do Datalake).

## Fluxo funcional (para usuário)

1. Abrir `/de-para`. Lista mostra todos os arquivos existentes (nome, tamanho, atualizado em).
2. Clicar em **Novo De-Para** → informar **Nome** (usado no nome do arquivo) e adicionar linhas `(De, Para)`.
3. Painel lateral exibe o **JSON gerado** e botão **Copiar**.
4. **Salvar** grava `de-para/<nome>.json` no S3 e retorna à lista.
5. **Editar** carrega um existente — o nome fica bloqueado (renomear = criar novo).

## Detalhes técnicos

- **Página:** `src/pages/DePara.tsx`.
- **Rota:** `/de-para` — guard `canAccessPosVendas`.
- **Edge Function:** `supabase/functions/de-para-s3/index.ts`.
- **Bucket:** `dados-custom-entradados` (secrets `AWS_S3_REGION`, `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`).
- **SDK:** `aws4fetch` (SigV4 direto do Deno, sem passar pelo gateway Lovable).
- **Prefixo:** `de-para/`. Chave = `de-para/<nome sanitizado>.json`.
- **Sanitização de nome:** `replace(/[^a-zA-Z0-9_\-]/g, "_")`. Caracteres inválidos viram `_`.

### Ações da Edge Function

Todas via `POST` com body `{ action, ...args }`.

| `action` | Body | Retorno |
|---|---|---|
| `list` | — | `{ items: [{ name, key, size, lastModified }] }` — lista até 1000 objetos com sufixo `.json` |
| `get` | `{ name }` | `{ data: { pairs, ... } \| null }` — 404 vira `null` |
| `save` | `{ name, data: { pairs } }` | `{ ok: true, key }` — grava JSON incluindo `_name` e `_savedAt` |
| `delete` | `{ name }` | `{ ok: true, key }` — idempotente (404 é ok) |
| `debug` | — | metadados das secrets AWS (comprimento, prefixo) — não expõe segredo |

### Modelo do arquivo

```json
{
  "pairs": [
    { "origem": "HYUNDAI MOTOR BRASIL", "destino": "HYUNDAI" },
    { "origem": "hyundai", "destino": "HYUNDAI" }
  ],
  "_name": "marcas",
  "_savedAt": "2026-07-01T18:00:00.000Z"
}
```

`_name` e `_savedAt` são injetados no `save` — a UI ignora esses metadados no `get`.

## Regras de negócio

- **Nome imutável** após criação. Para renomear, criar novo e apagar o antigo manualmente (não há UI de delete — só via `action: delete` na Edge Function).
- **Sem versionamento** — salvar sobrescreve. Se o bucket tiver versionamento habilitado no S3, o histórico fica lá.
- **Nenhum consumidor no app** — os arquivos são lidos por **jobs externos** (n8n, ETL do Datalake). Alterar um mapeamento pode afetar pipelines em produção.

> **TODO:** documentar quais pipelines externos consomem cada arquivo (mapeamento nome → pipeline).

## Erros comuns

| Sintoma | Causa | Ação |
|---|---|---|
| "Secrets AWS_S3_* não configuradas" | Faltando secret na Edge Function | Configurar em Supabase → Edge Functions → Secrets |
| "List falhou [403]" | Chave AWS sem permissão `s3:ListBucket` | Ajustar policy IAM do usuário |
| "Upload falhou [403]" | Sem `s3:PutObject` no prefixo `de-para/` | Ajustar policy IAM |
| Nome muda ao salvar | Caracteres especiais (`@`, `/`, espaço) viraram `_` | Usar somente `[a-zA-Z0-9_-]` |

## Relacionado

- [Entra Dados — Visão Geral](./visao-geral.md)