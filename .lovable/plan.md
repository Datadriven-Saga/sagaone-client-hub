## Objetivo

Adicionar a aba **Peças** em `/pos-vendas` (após Agendamentos) com a configuração da Paty de Peças: 6 gatilhos de template + gestão das lojas (prazo, endereço, horário, agente).

---

## Estrutura da aba

A aba `PecasTab` é composta por **dois blocos** dentro de um único `Card`/seções:

### Bloco 1 — Templates por gatilho
- Selector de agente Paty (reaproveita `AgenteSelector` + `usePatyAgentes`, igual Entregas).
- Lista 6 cards de gatilho fixos:

  | Label UI | status | tipo_requisicao |
  |---|---|---|
  | Pedido Faturado | PEDIDO_FATURADO | "" |
  | Pedido em BO | PEDIDO_EM_BO | "" |
  | Pedido em Trânsito | PEDIDO_EM_TRANSITO | "" |
  | Peça chegou — Balcão | PEDIDO_ENTREGUE | "" |
  | Peça chegou — Carro c/ cliente | PEDIDO_ENTREGUE | Normal |
  | Peça chegou — Imobilizado (VOR) | PEDIDO_ENTREGUE | VOR |

- Cada card: switch ativo/inativo + `TemplateSelectApproved` (templates aprovados da Paty, mesmo fluxo de Entregas — `template_id_pri`).
- Carrega via `GET busca-paty-pecas-template` com `agente_telefone` do agente selecionado, faz match por `(status, tipo_requisicao)`.
- Save → `POST upsert-paty-pecas-template`.
- Desativar (toggle off) → se já existir registro com `id`, chama `POST desativa-paty-pecas-template`; se ainda não existir, só não envia upsert.
- Validação: ao ativar sem template selecionado, mostra toast (mesmo padrão de `EntregasTab`).

### Bloco 2 — Configuração de Lojas (prazo/endereço)
- Tabela paginável/filtrável de lojas (`GET busca-paty-pecas-prazo`, sem filtro).
- Colunas: CNPJ, Nome, Dias adicionais, Agente (telefone), Endereço, Horário, Status.
- Botão "Nova Loja" e "Editar" abrem modal com:
  - `cnpj` (obrigatório, único — desabilitado em edição)
  - `nome_loja`
  - `dias_adicionais` (number, default 0)
  - `agente_telefone` (Select com agentes Paty da empresa via `usePatyAgentes`)
  - `endereco_loja` (textarea)
  - `horario_funcionamento` (text)
  - `ativo` (switch)
- Save → `POST upsert-paty-pecas-prazo` (chave de conflito = `cnpj`, mesmo endpoint para criar/atualizar).
- Filtros simples: busca por CNPJ/nome, filtro por agente, filtro por status.

> Observação: a doc não menciona endpoint de delete para lojas; soft-delete é via toggle `ativo`.

---

## Arquivos a criar/editar

**Criar:**
- `src/components/pos-vendas/PecasTab.tsx` — container com as duas seções.
- `src/components/pos-vendas/PecasTemplatesSection.tsx` — Bloco 1 (gatilhos + templates).
- `src/components/pos-vendas/PecasLojasSection.tsx` — Bloco 2 (tabela + modal CRUD lojas).
- `src/hooks/pos-vendas/usePecasData.ts` — hooks:
  - `usePatyPecasTemplates(agenteTelefone)` → `{ rows, loading, reload, upsert, desativar }`
  - `usePatyPecasLojas()` → `{ lojas, loading, reload, upsert }`
- `src/constants/pos-vendas-pecas.ts` — array `GATILHOS_PECAS` com `{ label, status, tipo_requisicao }`.

**Editar:**
- `src/pages/pos-vendas/PosVendas.tsx` — incluir `"pecas"` em `VALID`, adicionar `<TabsTrigger value="pecas">Peças</TabsTrigger>` e `<TabsContent>` logo após Agendamentos.
- `supabase/functions/external-webhook-proxy/index.ts` — adicionar ao `ALLOWED_ENDPOINTS`:
  - `busca-paty-pecas-template` (POST — body com `agente_telefone`)
  - `upsert-paty-pecas-template` (POST)
  - `desativa-paty-pecas-template` (POST)
  - `busca-paty-pecas-prazo` (POST — sem body)
  - `upsert-paty-pecas-prazo` (POST)
  
  Todos sob o domínio `automatemaia.sagadatadriven.com.br` (já está na allowlist).

---

## Detalhes técnicos

- **Identificação do gatilho:** combinação `(status, tipo_requisicao)`. Não usar `slug`. Como `PEDIDO_ENTREGUE` aparece 3x, sempre comparar os dois campos juntos.
- **Templates Paty:** usar `usePatyTemplates(agenteId, true)` (aprovados). `template_id` enviado ao webhook = `template_id_pri` (numérico, igual fluxo da cadência Paty existente).
- **Sem persistência local:** todas as configs vivem no n8n (mesmo padrão de `usePatyCadenciaTemplates`/`Steps`). Sem migration.
- **Sem alteração** nas abas existentes (Entregas, Agendamentos, Conversacional, Lojas, Templates).

---

## Riscos / validação manual
- Confirmar que `template_id` no webhook é o ID PRI (não o UUID local) — consistente com cadência Paty atual.
- Testar fallback: ativar só o gatilho genérico `PEDIDO_ENTREGUE` com `tipo_requisicao=""` deve funcionar isoladamente.
- Confirmar com backend o método HTTP real do `busca-paty-pecas-template` e `busca-paty-pecas-prazo` (doc diz GET com body — irreal; vou registrar como POST no proxy, padrão dos outros `busca-paty-*`).