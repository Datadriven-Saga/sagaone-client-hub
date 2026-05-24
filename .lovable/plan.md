## Objetivo

Criar um menu principal **Entra Dados** no sidebar, com o **De-Para** como primeiro item dentro dele, e enriquecer a tela `/de-para` para mostrar também a **estrutura do JSON** salvo no S3.

O "Entra Dados" será o ponto de entrada para futuras bases de dados mantidas pelo time (depara é só a primeira).

---

## 1. Menu lateral

Em `src/components/AppSidebar.tsx`:

- Remover o item solto **De-Para** (linhas ~350–370).
- Criar um grupo colapsável **Entra Dados** (ícone `Database` do lucide), no mesmo padrão visual dos outros grupos (Prospecção, Resultados, Agentes IA), usando `Collapsible` + `ChevronDown/Right`.
- Subitem inicial:
  - **De-Para** → `/de-para` (ícone `GitMerge`)
- Manter a mesma regra de permissão atual (`canSeePosVendas`) por enquanto, para não mexer em controle de acesso nesta etapa.
- Posicionar o grupo logo após **Pós-Vendas** (mesma vizinhança do item atual).
- Abertura automática quando a rota ativa começar com `/de-para` (ou qualquer futura `/entra-dados/...`).

Nenhuma rota nova precisa ser criada agora — `/de-para` continua valendo.

---

## 2. Tela De-Para — visualização da estrutura do JSON

Em `src/pages/DePara.tsx`, no modo de edição (quando `editing !== null`), adicionar um painel lateral/abaixo do editor de pares mostrando a **estrutura real do JSON** que será gravado no S3.

Layout proposto no modo edição:

```text
+--------------------------------------------------+
| Nome: [______________]   [Salvar] [Cancelar]     |
+-------------------------+------------------------+
| Pares (origem → destino)| Estrutura JSON         |
| [tabela editável]       | <pre>{ ... }</pre>     |
| [+ adicionar par]       | [Copiar JSON]          |
+-------------------------+------------------------+
```

Detalhes:

- Card "Estrutura JSON" ao lado direito (em telas md+) ou abaixo (mobile), usando `Card` + `<pre>` com `JSON.stringify(payload, null, 2)`.
- O `payload` exibido é exatamente o objeto enviado ao S3:
  ```json
  { "name": "<nome>", "pairs": [ { "origem": "...", "destino": "..." } ] }
  ```
  (apenas pares com `origem` ou `destino` preenchidos, igual ao `cleaned` no `save`).
- Atualização em tempo real conforme o usuário edita `name` / `pairs` (puro `useMemo`, sem chamadas extras).
- Botão **Copiar JSON** usando `navigator.clipboard.writeText` + toast de confirmação.
- Pequena legenda fixa acima do `<pre>` explicando o schema:
  - `name` (string) — identificador do arquivo no S3 (`de-para/<name>.json`)
  - `pairs[]` — lista de mapeamentos `{ origem, destino }`
- Estilo monoespaçado (`font-mono text-xs`), com `max-h` e `overflow-auto` para JSONs maiores.

Nada muda no backend (`supabase/functions/de-para-s3/index.ts`) nem no formato de armazenamento.

---

## 3. Critérios de sucesso

1. Sidebar mostra **Entra Dados** como grupo colapsável; ao expandir aparece **De-Para**.
2. Item solto antigo de De-Para não existe mais.
3. Ao entrar em `/de-para`, grupo "Entra Dados" abre automaticamente e o subitem fica destacado.
4. Ao criar/editar um De-Para, o painel "Estrutura JSON" reflete em tempo real o objeto que será salvo no S3.
5. Botão "Copiar JSON" copia o conteúdo formatado.
6. Salvar/listar/excluir continuam funcionando exatamente como hoje.

---

## Observações

- Não vou mexer em permissões, edge function, nem schema do S3 — só sidebar + UI da página.
- Se você quiser, num passo futuro adicionamos um seletor de "tipo de base" dentro do Entra Dados (de-para, listas, dicionários etc.), mas isso fica fora deste plano para manter o escopo cirúrgico.
