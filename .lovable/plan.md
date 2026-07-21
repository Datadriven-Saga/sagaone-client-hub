## Ajuste — limite de leads apenas em eventos ativos

### Causa raiz confirmada

`count_vendedor_leads_pendentes` conta corretamente só `Atribuído`, mas considera todos os eventos da empresa. Lays'la tem 2 Atribuídos no evento visível (SUPER AÇÃO) e 28 em dois eventos antigos (`CRM - TOYOTA AUTOSHOW`, `crm_nacional_evento_dia_s_toyota_go_anapolis`) — total 30 → travada. Auto-atribuição também sofre do mesmo problema para o cálculo de quantos leads pode buscar.

### Regra desejada

Um lead só ocupa slot do limite se estiver em status `Atribuído` **em um evento ativo** (`prospeccoes.ativo = true` e `encerrado_at IS NULL`).

### Alteração — camada única (SQL)

Atualizar `public.count_vendedor_leads_pendentes(uuid)` (`SECURITY DEFINER`, `search_path=public`):

- Remove o ramo por `contatos.status` global (não há como amarrá-lo a um evento específico).
- Mantém match por email/nome + `empresa_id` da empresa ativa.
- Novo predicado único:
  ```
  EXISTS (
    SELECT 1 FROM eventos_prospeccao ep
    JOIN prospeccoes pr ON pr.id = ep.prospeccao_id
    WHERE ep.contato_id = c.id
      AND pr.ativo = true
      AND pr.encerrado_at IS NULL
      AND get_contato_status_por_evento(c.id, ep.prospeccao_id) = 'Atribuído'
  )
  ```
- `COUNT(DISTINCT c.id)` para não duplicar quando o mesmo contato está `Atribuído` em vários eventos ativos (continua ocupando 1 slot).

`vendedor_precisa_leads` e `auto_atribuir_leads_vendedor` herdam automaticamente. Nenhuma mudança em frontend.

### Impacto imediato (medido nos dados de produção)

- Lays'la (`f1f21b82…`): passa de 30 → 2 pendentes (28 dos antigos ficam de fora, dependendo de os eventos estarem inativos/encerrados). Vou confirmar antes da mudança que aqueles dois eventos estão inativos ou encerrados; se estiverem ativos, ela ainda fica travada e a decisão precisa ser reavaliada.
- Auto-atribuição volta a puxar `30 - pendentes_ativos` leads.

### Riscos e o que NÃO muda

- Zero mudança em `contatos`, `eventos_prospeccao`, `logs_movimentacao_contatos`, RLS, webhooks, triggers.
- Rollback trivial: reaplicar versão anterior.
- Eventos ativos com muito lead Atribuído continuam travando normalmente — comportamento correto.
- Se um evento for reaberto (`encerrado_at` volta a NULL, `ativo=true`), os Atribuídos dele voltam a contar. Também correto.
- Métricas/relatórios: nenhum consumidor conhecido dessa RPC além do Kanban/hook `useAutoAtribuirLeads`.

### Validação após deploy

1. Rodar `count_vendedor_leads_pendentes` para Lays'la — esperar cair para o número de Atribuídos em eventos ativos.
2. Chamar `auto_atribuir_leads_vendedor` num usuário de teste que tenha Atribuídos em evento encerrado e Novos em evento ativo — deve puxar.
3. UI: clicar "Solicitar" no Kanban e verificar que puxa leads e o toast de limite só aparece quando fizer sentido.

### Fora de escopo

- Limite por evento (opção A) — não é o que foi decidido.
- Extração de helper/testes automatizados — pendente, entra em plano à parte quando você pedir.
