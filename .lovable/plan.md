# Plano — Restauração loja a loja (somente Vendedor)

Objetivo: restaurar `status` e `responsavel_email` de leads cujo último log válido em `logs_movimentacao_contatos` aponta para um usuário com **acesso de Vendedor** (não SDR), executando **uma loja por vez** a partir de um botão na tela `/administracao/diagnostico-status`.

SDRs entram em plano separado (descrito no fim) e não são tocados nesta rodada.

---

## 1. Regras de elegibilidade (por lead)

Um lead entra na restauração desta rodada quando **todas** as condições valem:

1. `contatos.empresa_id = <loja selecionada>`.
2. Existe `logs_movimentacao_contatos` para `(contato_id, prospeccao_id)` cujo **último registro** tem `status_novo` em: `Atribuído`, `Em Espera`, `Em Atendimento`, `Convidado`, `Confirmado`, `Compareceu`, `Não Compareceu`, `Venda`, `Sem Interesse`, `Sem Contato`, `Insucesso`.
3. O `responsavel_email` gravado no último log resolve para um `profiles.id` cujo `tipo_acesso` (via `useUserAccessType`/`cargo_tipo_acesso_mapping`) é **Vendedor** — nunca SDR, Gerente, Admin, etc.
4. Estado atual diverge: `contatos.status = 'Novo'` **ou** `contatos.responsavel_email` está vazio/diferente do log.
5. Evento (`prospeccoes`) da loja alvo — não propaga para outras lojas.

Leads sem log, com log apontando para SDR, ou cujo último status legítimo já é `Novo` **não são tocados**.

---

## 2. Fluxo por loja

```text
[Tela Diagnóstico de Status]
   ↓ usuário seleciona 1 loja no filtro
   ↓ clica "Restaurar loja (Vendedor)"
[Modal de confirmação]
   • Total divergente na loja
   • Elegíveis Vendedor (a restaurar)
   • Descartados (SDR / sem log / sem match)
   ↓ confirma
[RPC restore_leads_vendedor_por_loja]
   • dry_run=true → devolve preview
   • dry_run=false → aplica em lote de 500, transacional
[Toast + refetch da tabela]
```

---

## 3. Backend

### 3.1 RPC de preview

`public.preview_restauracao_vendedor(p_empresa_id uuid)` retorna:

- `total_divergentes`
- `elegiveis_vendedor`
- `descartados_sdr`
- `descartados_sem_log`
- `descartados_sem_perfil`
- amostra de até 20 leads (contato_id, nome, status_atual, status_esperado, responsavel_email)

### 3.2 RPC de execução

`public.restore_leads_vendedor_por_loja(p_empresa_id uuid, p_dry_run boolean default true, p_limit int default 500)`:

- `SECURITY DEFINER`, `search_path = public`, restrita a Admin/Master/TI (checa via `has_role`).
- Monta CTE com o último log por `(contato_id, prospeccao_id)` da loja.
- Junta com `profiles` + mapping `cargo_tipo_acesso_mapping` para filtrar `tipo_acesso = 'vendedor'`.
- Atualiza `contatos.status` e `contatos.responsavel_email` **sem** disparar reatribuição/round-robin (flag interna `p_skip_auto = true` no caminho de update).
- Grava `logs_movimentacao_contatos` com `motivo = 'restauracao_vendedor_v1'` e `usuario_id = auth.uid()` para auditoria.
- Não emite webhook externo (evita 24k eventos).
- Retorna `{ processados, atualizados, ignorados, amostra }`.

### 3.3 Guard rails

- `statement_timeout = 60s` local via `SET LOCAL`.
- Lote máximo 500; a UI chama em loop até `processados < p_limit`.
- Bloqueia execução se `p_empresa_id IS NULL` (nunca "todas as lojas de uma vez").

---

## 4. Frontend — `src/pages/admin/DiagnosticoStatus.tsx`

1. Novo botão **"Restaurar loja (Vendedor)"** no header, **habilitado apenas quando `empresaIds.length === 1`**. Tooltip explicando o requisito quando desabilitado.
2. Ao clicar: chama `preview_restauracao_vendedor` e abre `AlertDialog` com os contadores + amostra.
3. Confirmação executa `restore_leads_vendedor_por_loja` em loop de lotes com barra de progresso (`processados / elegiveis`).
4. Ao terminar, refetch de `get_leads_status_divergente` e `porLoja`; toast com o resumo.
5. Log de execução aparece no `logs_prospeccoes` já existente (motivo `restauracao_vendedor_v1`) para consulta posterior.

Apenas UI e chamadas de RPC — nenhuma alteração em regras de negócio de Kanban/atribuição.

---

## 5. Rollout

1. Migration cria as duas RPCs.
2. Deploy da UI com o botão.
3. Executar `dry_run` em 3 lojas piloto (menor, média, maior) e conferir amostra.
4. Rodar restauração real loja a loja, validando no `/administracao/diagnostico-status` que `total` cai para o esperado.
5. Registrar cada execução em `docs/reset-leads-*.md` com contadores antes/depois.

---

## 6. Rollback

Como cada update grava log com `motivo = 'restauracao_vendedor_v1'`, uma RPC `rollback_restauracao_vendedor(p_empresa_id, p_desde timestamptz)` reverte usando o `status_anterior`/`responsavel_email` do log imediatamente anterior. Fica pronta mas não é executada na rodada normal.

---

## 7. Plano separado (SDR) — pendente

Mesma mecânica, mas:

- Filtra `tipo_acesso = 'sdr'`.
- Precisa validar `prospeccao_equipe_membros` no momento do log (SDR pode ter saído da equipe).
- Decisão pendente: se SDR não pertence mais à equipe do evento, restaurar mesmo assim (auditoria) ou deixar sem responsável para o gestor reatribuir. Fica documentado aqui e será detalhado quando esta rodada de Vendedor terminar.
