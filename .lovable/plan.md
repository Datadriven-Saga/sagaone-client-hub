
# Plano — Templates NAMED para a Paty

Mudança cirúrgica: só `TemplatesPaty.tsx` e o editor compartilhado de variáveis. A Pri (`Templates.tsx`) continua POSITIONAL exatamente como hoje. Sem migração de schema.

## 1. `TemplateVariablesEditor.tsx` — virar reutilizável com modo NAMED

- Transformar a constante `availableFields` (hoje hardcoded com só `nome_cliente`) em **prop opcional** `availableFields?: Field[]`, mantendo fallback no valor atual → garante zero impacto na Pri.
- Adicionar prop `mode?: "positional" | "named"` (default `"positional"`).
- Em `mode="named"`:
  - O `<Select>` lista o vocabulário canônico recebido pela prop.
  - O campo "Exemplo" continua editável (vira `example` do `body_text_named_params`).
  - Helper novo `buildNamedParamsPayload(variables)` → `[{ param_name, example }, ...]` ordenado por `position`, retornando `undefined` se algum `field`/`example` vazio.
  - Helper novo `replacePositionalWithNamed(text, variables)` → troca `{{N}}` por `{{field}}` no texto do BODY.
- Helpers atuais (`buildBodyExamplePayload`, `buildVariableMappingPayload`, `extractVariablePositions`) ficam intactos para a Pri.

## 2. `TemplatesPaty.tsx` — vocabulário e modo NAMED

- Definir constante local `PATY_NAMED_FIELDS` com o vocabulário acordado:
  `nome_cliente, data, hora, modelo_veiculo, link_agendamento, chassi_veiculo, peca, concessionaria, endereco_loja, horario_funcionamento` (label + example default por campo).
- Passar `availableFields={PATY_NAMED_FIELDS}` e `mode="named"` em **todas** as 5 instâncias do `<TemplateVariablesEditor>` do arquivo (linhas 1869, 2165, 2304, 2484, 2668).
- A Pri não recebe essas props → segue POSITIONAL.

## 3. `buildMetaPayload` da Paty — gerar componentes NAMED

Reescrever apenas o `buildMetaPayload` em `TemplatesPaty.tsx` (sem tocar no da Pri):

### BODY
- Aplicar `replacePositionalWithNamed(savedData.conteudo, variableMappings)` → texto com `{{nome_canonico}}`.
- Montar `example.body_text_named_params` com `buildNamedParamsPayload`.
- **Guard**: contar `{{...}}` no texto final e comparar com `named_params.length`. Se divergir, abortar com toast claro (evita Meta `400 / 2388043`).

### HEADER
- **TEXT**: aplicar `text.replace(/\s*\{\{.*?\}\}/g, "").trim()` e **não** incluir `example`. Se sobrar string vazia, omitir o componente HEADER inteiro.
- **IMAGE/VIDEO/AUDIO**: fluxo de mídia (base64/handle) intocado.

### BUTTONS
- `QUICK_REPLY`: igual.
- `URL` com `{{...}}` no `buttonId`: trocar por `{{nome_canonico}}` na `url` e adicionar `example: ["<URL completa de exemplo>"]`. Se o operador não tiver URL completa configurada, fallback usa o `buttonId` atual sem variáveis (e logamos warning). Nunca usar o nome da variável como example.

### Envelope
- `tem_variavel: "Sim" | "Não"` (mantido).
- `payload.parameter_format = "NAMED"` (sempre na Paty, mesmo sem variável, é inofensivo).
- Adicionar flag de topo aditiva `template_named: true` no objeto retornado por `buildMetaPayload` (a Pri não envia esse campo → contrato preservado).

## 4. Persistência (`whatsapp_templates`)

- Sem migração.
- `variable_mapping` na Paty: gravar `{ named: ["nome_cliente", "data", ...] }` como metadado/auditoria (a lista canônica usada). O dispatcher não depende disso — lê os `{{nome}}` direto do template Meta.
- `pri_components`, ciclo `APPROVED`/`REJECTED` sem `template_id_pri`, fluxo de mídia, e sync Meta (`transformMetaToPriComponents`) **inalterados**.

## 5. Tratamento de erro Meta

Reaproveitar o handler já melhorado de `handleSincronizarTemplate` no fluxo de criação para que o `2388043` (mismatch de params) e o `2388024` (idioma duplicado) apareçam com `error_user_title`/`error_user_msg` reais no toast — sem mudar contrato.

## 6. QA manual (antes de marcar como pronto)

- Pri: criar template com `{{1}}` → payload sai POSITIONAL com `variable_mapping {1: "nome_cliente"}` e sem `parameter_format`/`template_named`.
- Paty: BODY com 2 variáveis → texto sai com `{{nome_cliente}}` e `{{data}}`, `body_text_named_params` com 2 itens, contagem batendo.
- Paty: variável no HEADER TEXT → removida, header só com texto limpo, sem `example`.
- Paty: HEADER IMAGE permanece com handle/base64.
- Paty: botão URL dinâmico → `url` com `{{link_agendamento}}` e `example` = URL completa.
- Paty: BODY com 3 `{{}}` mas só 2 vars mapeadas → bloqueia envio com toast.
- Paty: template sem `template_id_pri` continua forçado para `REJECTED`.
- Retorno Meta com `%7B%7B` na URL do botão é aceito sem flag de erro.

## Arquivos tocados

- `src/components/TemplateVariablesEditor.tsx` — props novas + 2 helpers, retrocompatível.
- `src/pages/pos-vendas/TemplatesPaty.tsx` — vocabulário, props nos editores, `buildMetaPayload` NAMED, gravação opcional do `variable_mapping.named`.
- **Nada** em `src/pages/prospeccao/Templates.tsx`.

## Pendência para confirmar com o backend antes do merge

Nome exato da flag de topo: `template_named: true` vs `tipo_variavel: "named"`. Plano assume `template_named: true` (aditivo); ajusto em 1 linha se a Pri-backend pedir outro nome.
