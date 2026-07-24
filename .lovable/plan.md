
# Kanban de Atendimento — entendimento, explicação e proposta base

Antes de qualquer código, precisamos concordar em três coisas: **onde o lead vive**, **onde o "contato" (interação) vive**, e **quais colunas mínimas** o Kanban precisa. Esta é a versão "básico do básico" — nada de agregações, dispatch, IA, temperatura. Só o esqueleto.

---

## 1. Onde o lead vive (modelo de dados atual)

```text
empresas
  └── eventos_prospeccao (prospecções / eventos de venda)
         └── eventos_prospeccao (tabela vínculo lead ↔ evento)   ⚠ nome sobrecarregado
                    │
                    └── contatos (a "pessoa" — 1 por telefone/empresa)
                              ├── contato_anotacoes    (histórico textual do lead)
                              ├── logs_movimentacao_contatos  (mudanças de status)
                              └── contato_timeline     (view agregada)
```

Pontos importantes (e débitos já mapeados na memória do projeto):

- **`contatos`** é a entidade "pessoa" — única por telefone dentro da empresa. Tem um campo `status` **global**, que hoje é o que o Kanban lê/escreve na maior parte dos fluxos.
- **`eventos_prospeccao`** faz dois papéis no mesmo nome de tabela: cadastro do evento **e** vínculo lead↔evento. É débito arquitetural conhecido.
- **`logs_movimentacao_contatos`** é a única fonte confiável de "qual era o status desse lead **neste evento** naquele momento". É o que já usamos para derivar status por evento em algumas telas (`get_contato_status_por_evento`).
- **`contato_anotacoes`** pertence ao **lead**, não ao evento. `prospeccao_id` é só metadado. Ou seja: histórico é compartilhado entre eventos do mesmo lead.

**Consequência prática que precisa ficar clara antes de desenhar o Kanban:**
o mesmo lead pode aparecer em N eventos. Hoje o status é global → em todos os eventos ele aparece com o mesmo status. Isso já é reconhecido como débito e parcialmente mitigado (leitura por evento em algumas telas, escrita ainda global via `mutate_contato_status_atomic`).

---

## 2. Onde o "contato" (interação) vive

"Contato" no sentido do SDR ("realizei contato com o cliente") **não é uma entidade separada**. Hoje ele é registrado como:

- **anotação** em `contato_anotacoes` (texto livre, prefixado: `📞 CONTATO REALIZADO`, `📵 TENTATIVA SEM SUCESSO`, etc.);
- **mudança de status** em `logs_movimentacao_contatos` (ex.: Novo → Em Espera);
- opcionalmente, incremento de tentativas de ligação (contagem no card).

Ou seja: **um "contato realizado" = uma linha em `logs_movimentacao_contatos` + uma linha em `contato_anotacoes`**, correlacionadas por `contato_id` (+ `prospeccao_id` como metadado).

Não existe hoje uma tabela `contatos_realizados` ou `interacoes` dedicada — e para o "básico do básico" **não precisa existir**. Reaproveitamos anotação + log.

---

## 3. Colunas mínimas do Kanban

Consolidando o que já está em produção (`docs/operacoes/manual-do-usuario/03-prospeccao-kanban.md`), o conjunto reduzido para "básico do básico" é:

| # | Coluna    | Status interno | Quem move  |
|---|-----------|----------------|------------|
| 1 | Novos     | `Novo`         | sistema (import) |
| 2 | Atribuídos| `Atribuído`    | sistema/gestor (auto-atribuição) |
| 3 | Em Espera | `Em Espera`    | SDR (contato feito, sem decisão) |
| 4 | Convidados| `Convidado`    | SDR (cliente confirmou interesse) |
| 5 | Descartados| `Descartado`  | SDR (sem interesse) |

Ficam **fora** do MVP (voltam depois, uma a uma):
- `Confirmado`, `Check-in`, `Venda`, `Opt Out` — pertencem a fluxos vizinhos (Recepção, Pós-venda, Compliance) e já têm regras/webhooks próprios; entram depois de o esqueleto estar estável.

---

## 4. Proposta de reconstrução (esqueleto mínimo)

**Objetivo desta fase:** ter um Kanban que **apenas** liste leads de **um evento** nas 5 colunas acima e permita mover entre elas. Sem filtros avançados, sem popover de "Contato Realizado", sem temperatura, sem dispatch, sem IA. Nada.

### 4.1 Contrato de dados (leitura)

Uma única RPC nova, ex.: `get_kanban_basico(p_prospeccao_id uuid, p_status text[], p_limit int, p_offset int)` que retorna, **por status derivado do evento**:

```text
{
  colunas: [
    { status: 'Novo',       total: N, items: [ {contato_id, nome, telefone, responsavel} ... ] },
    { status: 'Atribuído',  ... },
    ...
  ]
}
```

Regras:
- Status derivado por `logs_movimentacao_contatos` **para aquele `prospeccao_id`**, com fallback documentado (última entrada do lead ou `Novo` se nunca movimentado nesse evento).
- Sempre exige `prospeccao_id` — nunca roda "todos os eventos" (respeita a memory `kanban-default-filter-and-timeout-prevention` que bloqueia timeout 57014).

### 4.2 Contrato de escrita (mover card)

Reaproveitar o que já existe e é seguro:
- **`mutate_contato_status_atomic(contato_id, prospeccao_id, novo_status, autor)`** — única porta de escrita.
- Grava log em `logs_movimentacao_contatos` + atualiza `contatos.status`.
- Trigger PG cuida do webhook Mobi (memory `movimentacao-lead-single-source`). FE **não** chama `trigger-webhook`.

### 4.3 Componentes de UI (do zero, isolados)

Novos arquivos, sem tocar em `Prospeccao.tsx` (3925 linhas — refactor pendente):

```text
src/features/kanban-basico/
  KanbanBasicoPage.tsx         ← rota nova (ex.: /prospeccao/atendimento-v2)
  KanbanBasicoBoard.tsx        ← board com as 5 colunas
  KanbanBasicoColumn.tsx       ← coluna, conta total + lista items
  KanbanBasicoCard.tsx         ← só nome, telefone, responsável
  useKanbanBasico.ts           ← chama a RPC, expõe move()
```

Nada mais. Sem drag-and-drop na v0 se quisermos simplificar ainda mais — botão "mover para →" no card já resolve a premissa.

### 4.4 O que **não** entra nesta fase

- Filtros (responsável, temperatura, marca, origem, busca).
- Multi-evento no mesmo board.
- Popover "Contato Realizado" com incremento de tentativas.
- Solicitar leads / auto-atribuição.
- Anotações inline.
- Regras de bloqueio 24h, limite 30 leads SDR, opt-out.
- Realtime / otimista.
- Substituir a tela antiga (`/prospeccao/atendimento` continua rodando em paralelo).

Cada um desses volta como um passo separado, encaixando no esqueleto.

---

## 5. Perguntas antes de eu prosseguir para um plano executável

1. **Escopo de colunas do MVP:** as 5 acima (`Novo`, `Atribuído`, `Em Espera`, `Convidado`, `Descartado`) estão OK, ou você quer incluir/excluir alguma já no esqueleto?
2. **Único evento por vez:** confirma que o MVP mostra **um** `prospeccao_id` obrigatoriamente selecionado (sem multi-evento)?
3. **Substituir ou coexistir:** construímos em rota nova (ex.: `/prospeccao/atendimento-v2`) enquanto o Kanban atual continua vivo, ou você quer que já **substitua** a tela atual desde a v0?
4. **Fonte do status:** vamos oficializar leitura por `logs_movimentacao_contatos` (por evento) já na v0, ou começamos lendo `contatos.status` global só para não misturar refactor de leitura com refactor de UI?

Assim que você responder essas 4, eu volto com o plano de implementação em passos concretos (RPC + rota + componentes), sem tocar em nada até você aprovar.
