
## Reanálise validada com o log + banco

### O que o log prova (Lays'la, evento SUPER AÇÃO 971be09c)
- `pendentesRpc = 30`, `vagasCalculadas = 0`, `auto_atribuir → 0`.
- No evento em tela ela tem **0 Atribuído** (7 Convidado, 4 Descartado, 226 Em Espera).
- 866 novos / 806 elegíveis / 160 bloqueados por `ja_tem_responsavel_email` (leads de outro SDR — correto).

### De onde vêm os 30 pendentes (query no banco)
| Evento | Atribuídos | `ativo` | `encerrado_at` | `data_fim` | Status na UI |
|---|---|---|---|---|---|
| CRM - TOYOTA AUTOSHOW | **29** | true | `NULL` | 2026-06-20 | **Encerrado** (screenshot) |
| SUPER AÇÃO JULHO [TRAFEGO] | 1 | true | `NULL` | — | ativo |
| _(2 encerrados via `encerrado_at`)_ | não contam | — | preenchido | — | Encerrado |

**Dois problemas confirmados:**

1. **Encerramento fantasma:** o AUTOSHOW aparece "Encerrado" na UI (via `data_fim < hoje`), mas no banco `encerrado_at IS NULL` e `ativo = true`. Por isso a RPC continua contando os 29 Atribuídos dele.
2. **Escopo global do limite:** mesmo se o AUTOSHOW estivesse corretamente encerrado, o desenho atual soma Atribuídos de **todos os eventos** da empresa. A regra desejada é contar **apenas o evento atual** que o SDR está trabalhando.

---

## Estrutura proposta (limite por evento)

### Contrato

```text
LIMITE_POR_EVENTO = 30
pendentes(evento E, usuário U) = COUNT DISTINCT c
    WHERE c.responsável = U
      AND status_por_evento(c, E) = 'Atribuído'
vagas(E, U) = max(0, 30 - pendentes(E, U))
podeSolicitar(E, U) = vagas(E, U) > 0  AND  E está ativo e não-encerrado
```

Escopo "ativo e não-encerrado":
- `pr.ativo = true`
- `pr.encerrado_at IS NULL`
- **E** `pr.data_fim IS NULL OR pr.data_fim >= CURRENT_DATE`  ← fecha o gap do AUTOSHOW

### Diagrama do fluxo (novo)

```text
Botão Solicitar (Kanban filtrado por 1 evento E)
   │
   ▼
count_vendedor_leads_pendentes(user, E)
   │   conta APENAS Atribuído em E
   ▼
vendedor_precisa_leads(user, E) = pendentes(E) < 30
   │
   ▼
auto_atribuir_leads_vendedor(user, E)
   │   puxa até (30 - pendentes(E)) leads Novos DO EVENTO E
   ▼
UPDATE contatos + INSERT logs_movimentacao_contatos (prospeccao_id = E)
```

### Mudanças no banco (migration)

1. **`count_vendedor_leads_pendentes(user_id_param uuid, prospeccao_id_param uuid DEFAULT NULL)`**
   - Se `prospeccao_id_param` informado → conta Atribuído **apenas naquele evento**.
   - Se `NULL` → mantém comportamento global (compatibilidade com chamadas antigas), mas já aplicando o filtro `data_fim >= CURRENT_DATE` para não vazar eventos encerrados por data.
2. **`vendedor_precisa_leads(user_id_param, prospeccao_id_param uuid DEFAULT NULL)`** — repassa o evento.
3. **`auto_atribuir_leads_vendedor(user_id_param, prospeccao_id_param uuid DEFAULT NULL)`**
   - Se `prospeccao_id_param` informado: valida evento ativo/não-encerrado/`data_fim` futuro, calcula `vagas` só nesse evento, e restringe o `INSERT INTO _tmp_leads_pick` a `ep.prospeccao_id = prospeccao_id_param`.
   - Se `NULL`: fallback ao comportamento global atual (usado por integrações que não têm contexto).
4. **`debug_auto_atribuicao_leads`** — passar a expor também `pendentes_no_evento` e `pendentes_global` lado a lado, para não confundir análises futuras.

Nenhuma quebra de contrato: todos os parâmetros novos têm `DEFAULT NULL`.

### Mudanças no frontend

- `src/hooks/useAutoAtribuirLeads.ts`
  - `contarLeadsPendentes(prospeccaoId?)`, `verificarPrecisaLeads(prospeccaoId?)`, `atribuirLeadsAutomaticamente(showToast, debugContext)` passa `prospeccaoId` (quando `debugContext.prospeccaoIds.length === 1`) para as três RPCs.
  - Se o usuário estiver com múltiplos eventos selecionados no filtro: manter o comportamento antigo (global) e avisar no toast que a solicitação só é possível com **1 evento selecionado**.
- `src/pages/Prospeccao.tsx`
  - `solicitarClientes` já monta `debugContext.prospeccaoIds`; apenas garantir que o botão fica desabilitado com tooltip "Selecione um evento" quando `prospeccaoIds.length !== 1`.
- Toast de erro atual "Você já possui 30 leads pendentes" muda para: *"Limite de 30 atingido neste evento. Finalize atendimentos deste evento antes de puxar novos."*

### Efeito no caso da Lays'la (validação esperada)

Rodando a nova regra com `prospeccao_id = 971be09c` (SUPER AÇÃO em tela):
- `pendentes(E) = 0` (ela tem 0 Atribuído neste evento).
- `vagas = 30`.
- `auto_atribuir` puxa até 30 dos 806 elegíveis. ✅ Destrava sem tocar no AUTOSHOW.

### Fora de escopo (fica para outro plano se você quiser)

- Corrigir os 29 Atribuídos "presos" no AUTOSHOW (evento encerrado por data mas com `encerrado_at IS NULL`). Podemos fazer um job que preenche `encerrado_at = data_fim` quando `data_fim < hoje`. Recomendo separar porque afeta relatórios históricos.
- Bloquear atribuição automática em qualquer evento onde `data_fim < hoje` mesmo com `ativo=true` (já contemplado no filtro proposto acima).

### Testes obrigatórios antes de aprovar

- SDR com 0 Atribuído no evento atual e 29 em outro evento → **consegue** solicitar (antes: bloqueado).
- SDR com 30 Atribuído no evento atual → **bloqueado** apenas nesse evento; pode trabalhar em outro.
- Solicitação sem `prospeccao_id` (integração antiga) → mantém comportamento global.
- Solicitação em evento com `data_fim` passado → **bloqueada** com mensagem clara.
- Múltiplos eventos filtrados no Kanban → botão desabilitado, toast pedindo 1 evento.
- Log `logs_movimentacao_contatos` sempre com o `prospeccao_id` correto (já garantido pela função atual).

Aguardo sua aprovação para implementar como migration + ajustes no hook e na tela.
