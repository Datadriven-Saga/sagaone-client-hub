# Plano — Filtros do Kanban (A + B + Status + Temperatura)

Escopo: frontend + 1 migration mínima (necessária pra temperatura funcionar). Sem edge functions novas, sem RPC nova.

## Contexto — o problema da temperatura

- `temperaturas_lead` é só o **catálogo** por empresa (nome + cor). É onde a empresa configura "Quente / Morno / Frio".
- `contatos` (o lead) **não tem coluna** que aponta pra uma temperatura. Nenhuma tabela liga lead↔temperatura.
- Os modais `ContatoModal.tsx` (linha 102, 1360+) e `AtendimentoModal.tsx` (linha 39) têm a aba Temperatura, mas o valor selecionado vive só num `useState` React e é descartado ao fechar. Nunca vai pro banco.
- Consequência: sem persistência, não dá pra filtrar nem pintar bolinha (não existe dado a ler).

## Colunas x Status (achado)

Colunas reais do Kanban (`src/pages/Prospeccao.tsx:1866-1874`):
```
Novo · Atribuído · Em Espera · Convidado · Confirmado · Check-in · Venda · Descartado · Opt Out
```
Options do filtro Status hoje (`ProspeccaoGlobalFilter.tsx:43-55`):
```
Novo · Atribuído · Em Espera · Convidado · Agendado←órfão
Confirmado · Check-in · Venda · Descartado · Desperdício←órfão · Opt Out
```
"Agendado" e "Desperdício" não existem como coluna. Selecionar → Kanban vazio.

---

## Execução

### [A] Botão "Todos" respeita a busca do popover
Arquivo: `src/components/ProspeccaoGlobalFilter.tsx`
- `selectAllProspeccoes()` passa a marcar `filteredEventList` (a lista já filtrada por `eventSearchTerm`), não `prospeccoes` inteiro.
- Label muda pra "Todos filtrados" quando há termo de busca.
- **Impacto:** só o popover. Zero em consumidores.

### [B] Simplificar match Vendedor/Responsável
Arquivo: `src/pages/Prospeccao.tsx` (~linhas 1644-1654, `useMemo` de `filteredContatos` por responsável)
- Remover fallbacks legados (comparação por `celular`, `profile.id === contato.responsavel_email`).
- Manter só: `contato.responsavel_email?.toLowerCase() === profile.email?.toLowerCase()`.
- Alinhado com a memória `emails normalizados lowercase` (backfill de 426 rows já feito + trigger `trg_normalize_responsavel_email`).
- **Impacto:** filtro por responsável no Kanban vira consistente com o resto do sistema.

### [F1] Remover status órfãos
Arquivo: `src/components/ProspeccaoGlobalFilter.tsx`
- Tirar `"Agendado"` e `"Desperdício"` de `statusOptions`.
- **Impacto:** zero. Só some do dropdown; hoje já não filtrava nada.

### [T-DB] Persistência de temperatura (**migration — precisa aprovação sua**)
1 migration, cirúrgica:
```sql
alter table public.contatos
  add column temperatura_id uuid null
  references public.temperaturas_lead(id) on delete set null;

create index idx_contatos_temperatura on public.contatos(temperatura_id)
  where temperatura_id is not null;
```
- Sem default, sem backfill (todos começam `null` = "Sem temperatura").
- Grants já cobertos (tabela `contatos` já existe).
- RLS já existe na `contatos`, coluna herda.

### [T-UI] Frontend da temperatura
Arquivos:
- `src/components/ContatoModal.tsx` — no `handleSave`/mutation, incluir `temperatura_id: temperaturaAtual || null` no update do contato. Carregar `temperaturaAtual` do `contato.temperatura_id`.
- `src/components/AtendimentoModal.tsx` — idem.
- `src/hooks/useRecepcaoData.ts` (fonte do `KanbanItem`) — trazer `temperatura_id`, `temperaturas_lead(cor, nome)` no select.
- `src/components/KanbanBoard.tsx` — adicionar `temperatura_cor?: string; temperatura_nome?: string` em `KanbanItem`.
- `src/components/KanbanCard.tsx` — renderizar bolinha (12px, `rounded-full`, `style={{background: item.temperatura_cor}}`) ao lado do nome, com Tooltip mostrando o nome. Se `null`, não renderiza.
- `src/components/ProspeccaoGlobalFilter.tsx` — adicionar seção "Temperatura" no popover (multi-select como responsável), carregar catálogo via `temperaturas_lead` da empresa ativa.
- `src/pages/Prospeccao.tsx` — aplicar filtro em `filteredContatos` (`selectedTemperaturas.length === 0 || selectedTemperaturas.includes(contato.temperatura_id)`).

## Onde impacta / não impacta

| Área | Impacto |
|---|---|
| `contatos` (tabela) | +1 coluna nullable. Não quebra RLS, RPCs existentes, `bulk_upsert_contatos`, importações. |
| `bulk_upsert_contatos` | **Não tocar.** Coluna é nullable e não faz parte do upsert; imports continuam iguais. |
| `useRecepcaoData` / RPCs de Kanban | Adicionar `temperatura_id` no select. Sem mudança de contrato — campos extras são ignorados por quem não usa. |
| Outras telas (Resultados, Relatórios, Pós-Vendas) | Zero. Nenhuma lê temperatura. |
| Webhook Mobi / dispatchers | Zero. Payload não muda. |
| Modais `ContatoModal`/`AtendimentoModal` | Passam a persistir uma coluna nova. Feature que era morta vira funcional. |
| Filtro por Responsável | [B] normaliza pra 1 caminho só. Casos de e-mail com caixa mista continuam funcionando (trigger + backfill já ativos). |
| Dropdown de Status | [F1] some com 2 opções que hoje já não faziam nada. |

## Riscos

| Risco | Mitigação |
|---|---|
| [B] usuário com `responsavel_email` guardando UUID antigo | Backfill lowercase já feito; se aparecer regressão, adicionar fallback opcional. Baixo. |
| [T-DB] alguém futuramente deletar uma temperatura em uso | `ON DELETE SET NULL` — leads voltam pra "Sem temperatura", sem quebrar. |
| [T-UI] performance no Kanban com JOIN | Ler `temperaturas_lead` **1x** na página (catálogo por empresa é pequeno, <20 rows) e mapear no cliente por `temperatura_id`. Não fazer JOIN por linha. |

## Fora do escopo

- Filtro por temperatura em Resultados/Relatórios (só Kanban).
- Persistir filtros em URL (E) — cancelado.
- Refactor de `Prospeccao.tsx`.
- Mudar `contatos.status` para por-evento (débito estrutural conhecido).

---

Confirma pra eu implementar [A] + [B] + [F1] + [T-DB] + [T-UI]?
