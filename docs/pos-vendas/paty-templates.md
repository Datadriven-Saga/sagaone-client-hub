# Variáveis dinâmicas — Templates Paty

Rota: `/pos-vendas/paty/templates`
Tela: `src/pages/pos-vendas/TemplatesPaty.tsx`
Editor: `src/components/TemplateVariablesEditor.tsx` (modo `named`)

## Vocabulário canônico (NAMED)

Definido em `PATY_NAMED_FIELDS` (TemplatesPaty.tsx, ~linha 144). Estes são
os únicos campos que podem ser mapeados nas variáveis `{{N}}` de um template
da Paty:

| `value` (param_name)      | Label                     | Exemplo                                  |
| ------------------------- | ------------------------- | ---------------------------------------- |
| `nome_cliente`            | Nome do Cliente           | João Silva                               |
| `data`                    | Data                      | 15/03/2025                               |
| `hora`                    | Hora                      | 14:30                                    |
| `modelo_veiculo`          | Modelo do Veículo         | HB20 1.0                                 |
| `link_agendamento`        | Link de Agendamento       | https://saga.com.br/agendar/abc123       |
| `chassi_veiculo`          | Chassi do Veículo         | 9BWZZZ377VT004251                        |
| `peca`                    | Peça                      | Filtro de óleo                           |
| `concessionaria`          | Concessionária            | Saga Hyundai Asa Sul                     |
| `endereco_loja`           | Endereço da Loja          | SCS Q. 1, Bloco H - Brasília/DF          |
| `horario_funcionamento`   | Horário de Funcionamento  | Seg a Sex, 8h às 18h                     |

Para adicionar/remover variáveis, editar `PATY_NAMED_FIELDS` —
é a única fonte de verdade no front. Não há tabela no Supabase.

## Fluxo end-to-end

```text
Usuário edita texto com {{1}}, {{2}}…
   │
   ▼
TemplateVariablesEditor (mode="named", availableFields=PATY_NAMED_FIELDS)
   - Detecta {{N}} no texto via regex /\{\{(\d+)\}\}/g
   - Para cada posição, usuário escolhe um campo do vocabulário (Select)
   - Usuário preenche um exemplo (obrigatório p/ aprovação Meta)
   │
   ▼
variableMappings: VariableMapping[]  → { position, field, example }
   │
   ├─► replacePositionalWithNamed(text, vars)
   │     {{1}} → {{nome_cliente}}  no body/header final
   │
   ├─► buildNamedParamsPayload(vars)
   │     example.body_text_named_params: [{ param_name, example }, ...]
   │     → enviado à Meta para aprovação
   │
   └─► buildVariableMappingPayload(vars)
         { 1: "nome_cliente", 2: "data", ... }
         → persistido junto com o template (lookup posição→campo)
```

## Regras

- **Modo NAMED** (Paty) — diferente dos templates da Pri (POSITIONAL).
  Cada `{{N}}` é convertido em `{{nome_canonico}}` no texto enviado à Meta.
- **Header não aceita variável.** `stripHeaderVariables()` remove qualquer
  `{{...}}` do header antes do envio.
- **Exemplo obrigatório.** Sem `example` preenchido em todas as variáveis,
  `buildNamedParamsPayload` retorna `undefined` e o envio à Meta é bloqueado.
- **Resolução em runtime é externa.** A Paty (MySaga / Saga Conecta /
  DataLake) resolve cada `{{nome_cliente}}` etc. no momento do disparo —
  o SagaOne só persiste o mapeamento.
- **Máximo 10 variáveis** por template (`maxVariables` default do editor).

## Como adicionar uma nova variável

1. Adicionar entrada em `PATY_NAMED_FIELDS` em `TemplatesPaty.tsx`.
2. Garantir que a Paty (sistema externo) sabe resolver aquele `param_name`
   em runtime — caso contrário o disparo chega com placeholder literal.
3. Não é preciso migration nem mudança no editor.

## Helpers relevantes

`src/components/TemplateVariablesEditor.tsx`:

- `extractVariablePositions(text)` — extrai `[1,2,3,...]` do texto.
- `replacePositionalWithNamed(text, vars)` — `{{1}}` → `{{nome_cliente}}`.
- `buildNamedParamsPayload(vars)` — monta payload Meta NAMED.
- `buildVariableMappingPayload(vars)` — `{ position: field }` para storage.
- `stripHeaderVariables(text)` — limpa variáveis do header.
- `buildBodyExamplePayload(vars)` — equivalente POSITIONAL (usado pela Pri).
