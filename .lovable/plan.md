## Ajustes no CriarProspeccaoModal.tsx

### 1. Calendário visível em ambos os temas

Nos dois `<Input type="datetime-local">` (linhas ~3373 e ~3444), adicionar as classes:

```
[color-scheme:light] dark:[color-scheme:dark]
```

Isso faz o navegador renderizar o popup nativo do calendário conforme o tema atual (claro no light, escuro no dark), mesmo comportamento que os campos de texto já têm ao herdar as cores do tema.

### 2. Reduzir largura do modal ~30% em telas grandes

Linha 4654, `DialogContent`. Atualmente:

```
w-[calc((100vw-2rem)*0.8)] sm:max-w-[calc((100vw-2rem)*0.8)]
```

Mudar para manter o tamanho atual em telas pequenas e reduzir só em telas maiores:

```
w-[calc((100vw-2rem)*0.8)]
sm:max-w-[calc((100vw-2rem)*0.8)]
lg:w-[calc((100vw-2rem)*0.65)] lg:max-w-[calc((100vw-2rem)*0.65)]
xl:w-[calc((100vw-2rem)*0.55)] xl:max-w-[calc((100vw-2rem)*0.55)]
```

Resultado: `lg` (≥1024px) ~65%, `xl` (≥1280px) ~55% — ~30% mais estreito que o atual em tela cheia; abaixo de `lg` o modal segue com a largura atual.

### Escopo
- Somente `src/components/CriarProspeccaoModal.tsx`.
- Nenhuma alteração de lógica, payload ou banco.
