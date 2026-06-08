# Corrigir extração de mídia no `handleSincronizarTemplate` (Pós-Vendas › Templates Paty)

## Problema

Template `entrega_agendada_test` (id_pri 1685) sincronizado tem `card_data.imagemUrl = "h"` no banco. O `TemplatePreview` tenta renderizar `<img src="h">`, falha, e mostra o placeholder cinza.

Causa: o webhook externo `criar-template-pri-from-meta` está devolvendo um `card_data` com `imagemUrl` quebrado/truncado (provavelmente lendo `url[0]` de uma string em vez de `header_handle[0]` de um array). No nosso código (`src/pages/pos-vendas/TemplatesPaty.tsx`, linha ~1559), confiamos cegamente em `res.card_data`:

```ts
const cardData =
  res.card_data ??
  (transformed?.cardData ? { ...transformed.cardData, corpoTexto: transformed.conteudo } : {});
```

Quando o webhook devolve `card_data = { imagemUrl: "h", corpoTexto: "..." }`, ignoramos o `transformed` (que foi montado a partir de `meta.components` da própria listagem da Meta e tem a URL pública correta em `header_handle[0]`).

## Correção

### 1. Preferir/mesclar a URL de mídia derivada de `meta.components`

Em `src/pages/pos-vendas/TemplatesPaty.tsx`, ajustar a montagem de `cardData` para:

1. Calcular `transformed` a partir de `res.components ?? meta.components` (já é feito).
2. Tomar `res.card_data` como base, **mas sobrescrever `imagemUrl`/`videoUrl` quando a URL do webhook não for válida** (não é string que começa com `http`) e existir uma URL válida em `transformed.cardData`.
3. Mesmo tratamento para `textoCabecalho`, `rodape`, `botoes` — se vierem vazios do webhook e existirem no `transformed`, usar o do `transformed`.

Pseudocódigo:

```ts
const isValidUrl = (v: unknown) => typeof v === "string" && /^https?:\/\//i.test(v);

const base = (res.card_data ?? {}) as Record<string, any>;
const fromMeta = transformed?.cardData ?? {};

const cardData = {
  ...fromMeta,
  ...base,
  corpoTexto: base.corpoTexto ?? transformed?.conteudo ?? "",
  imagemUrl: isValidUrl(base.imagemUrl) ? base.imagemUrl : (fromMeta as any).imagemUrl || "",
  videoUrl: isValidUrl(base.videoUrl) ? base.videoUrl : (fromMeta as any).videoUrl || "",
  textoCabecalho: base.textoCabecalho || (fromMeta as any).textoCabecalho || "",
  rodape: base.rodape || (fromMeta as any).rodape || "",
  botoes: (Array.isArray(base.botoes) && base.botoes.length > 0)
    ? base.botoes
    : ((fromMeta as any).botoes || []),
};
```

Mesma lógica para `formato`: se `res.formato` vier mas `transformed.formato` for "imagem"/"video" e tivermos URL válida no transformed, manter a do transformed (cobre o caso de o webhook devolver `"texto"` por erro).

### 2. Corrigir o registro já gravado no banco

Para o template `27625cf5-588b-4424-b1ed-d80f5345e61d` (id_pri 1685), fazer um `UPDATE` em `whatsapp_templates.card_data` substituindo `imagemUrl="h"` pela URL pública correta do header da Meta. A URL exata sai de uma chamada nova ao webhook ou da listagem `meta.components[].example.header_handle[0]` no front. Como já foi sincronizado e some da lista de "templates só na Meta", o caminho mais simples é: clicar de novo no botão de sincronizar após o fix — mas como já existe registro, vamos:

- Apagar o registro local (`DELETE` pontual) e re-sincronizar pelo UI corrigido; **ou**
- `UPDATE` direto setando a URL correta, que o usuário fornecerá ou que buscamos pela Meta.

Recomendo apagar o registro e re-sincronizar pelo UI já corrigido — é determinístico e valida o fix.

## Fora de escopo

- Mudar o webhook externo `criar-template-pri-from-meta` (fora do repo).
- Mexer no `TemplatePreview` ou no `transformMetaToPriComponents`.
- Tocar em outros templates que não tenham o mesmo sintoma.

## Validação

- Sincronizar `entrega_agendada_test` novamente → `card_data.imagemUrl` recebe URL pública completa do bucket (`https://.../templates-api/.../*.jpg`).
- Preview abre com a imagem renderizada (sem placeholder cinza).
- Templates "texto puro" continuam funcionando (não recebem `imagemUrl` espúrio).
