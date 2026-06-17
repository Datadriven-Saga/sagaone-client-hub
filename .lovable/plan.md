# Padronizar leads sem nome como "Lead sem nome"

A consulta confirmou: hoje há **30.003** registros em `contatos` com `nome` nulo ou string vazia (não são só ~1.500 — o problema é maior do que parecia). Hoje o front filtra `contato.nome` falsy e some com todos esses cards no Kanban, mesmo com os badges contando certo. Vamos atacar em duas frentes, como você pediu.

## 1. Backfill retroativo (UPDATE em produção)

Rodar via a ferramenta de data-change do Supabase, em uma única transação:

```sql
UPDATE public.contatos
SET nome = 'Lead sem nome',
    updated_at = now()
WHERE nome IS NULL OR trim(nome) = '';
```

- Escopo: **todas as empresas** (a contagem global é 30.003).
- Atualiza `updated_at` para os registros aparecerem como recém-tocados nos refreshes do Kanban.
- Não mexe em `telefone`, `lead_id`, `responsavel_email`, `status`, vínculos em `eventos_prospeccao`, anotações ou quarentena. É só rótulo.
- Não há trigger conhecido em `contatos.nome` que dispare side-effects (verifico antes de rodar; se houver, paro e reporto).

Após o UPDATE, valido com:
```sql
SELECT count(*) FROM public.contatos WHERE nome IS NULL OR trim(nome) = '';
-- esperado: 0
```

E faço uma checagem no evento AUTOSHOW da TOYOTA ANA simulando o `moroni-teste` para confirmar que os 49 leads aparecem com o título "Lead sem nome" + telefone.

## 2. Fallback no `process-import` (importação futura)

Em `supabase/functions/process-import/index.ts`, linha 719, hoje:

```ts
nome: colIndices.nome >= 0 ? (row[colIndices.nome] || '').trim() : '',
```

Trocar por um helper local que retorna `'Lead sem nome'` quando o valor da planilha estiver vazio/whitespace ou quando a coluna nome não existir no header:

```ts
const rawNome = colIndices.nome >= 0 ? String(row[colIndices.nome] ?? '').trim() : '';
const nome = rawNome.length > 0 ? rawNome : 'Lead sem nome';
```

E aplicar exatamente o mesmo tratamento nos outros pontos do arquivo que montam payload de contato a partir da planilha:
- linha 1029 (`importedContatos.push({ nome: c.nome || '', ... })`) — trocar `c.nome || ''` por `c.nome?.trim() || 'Lead sem nome'`.
- linha 1045 e 1083 (payloads para webhook/outras camadas) — mesma normalização, para não vazar string vazia para downstream.

Não mexer em `bulk_upsert_contatos` (RPC SECURITY DEFINER, área crítica segundo a memória do projeto). O fallback fica 100% no Edge Function, antes do RPC; o RPC continua recebendo `nome` sempre não-vazio e nada na assinatura muda. Não muda comportamento de:
- `upsert_quarentena` (chave é telefone+marca+canal, não usa nome),
- `import_logs` / `bases_importadas`,
- deduplicação por telefone,
- whitelist / opt-out.

## 3. Validação

Depois das duas mudanças:
1. Logado como `moroni-teste` em TOYOTA ANA, abrir o evento AUTOSHOW: as colunas **Novos (19)** e **Atribuído (30)** devem renderizar os cards (badge = quantidade visível).
2. Importar uma planilha de teste com 2 linhas: uma com nome preenchido, outra com a célula de nome em branco. Conferir em `contatos` que a segunda linha gravou `nome = 'Lead sem nome'` e a primeira manteve o nome original.
3. Conferir `import_logs` da execução: `inserted`/`updated` consistentes, sem novos `error_details`.

## Fora de escopo (não vou fazer agora)
- Não vou alterar o filtro do `contatosToKanbanItems` em `src/pages/Prospeccao.tsx`. Com o backfill + fallback, nenhum contato chega ao front com nome vazio, então o sintoma some sem precisar mexer na lógica de renderização. Se você quiser também a proteção defensiva no front (para o caso de algum dia voltar a entrar registro sem nome por outro caminho), me avisa que adiciono em seguida.
- Não vou mudar a UI do `KanbanCard` — ele já mostra `nome` como título, agora vai mostrar "Lead sem nome".
