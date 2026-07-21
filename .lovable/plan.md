## Diagnóstico de Eventos — nova tela gerencial

Rota: `/administracao/diagnostico-eventos` (dentro de Administração). Acesso: `canAccessAdminConfig` (Admin/TI/Master).

### Estrutura

```text
Breadcrumb: Administração / Diagnóstico de Eventos
Header: título + subtítulo + botão "Exportar" (CSV)

Barra de filtros (independentes, combináveis):
- Usuário terceiro (multi)
- Loja / Empresa (multi)
- Evento / Prospecção (multi)
- Cadeira / external_access_seat (multi)
- Range de datas (data_inicio..data_fim do evento) — padrão: últimos 60 dias
- Botões: Filtrar / Limpar

KPIs (cards):
- Total de Leads (contatos vinculados no escopo)
- Eventos Ativos (com sub-linha: encerrados · pausados)
- Leads Atribuídos (com sub-linha: não atribuídos)
- Leads por Loja (média)
- Eventos Expirados (data_fim < hoje e não encerrados) com leads pendentes

Barra "Status dos Leads": chips com contagem por status derivado por evento
(Novo, Atribuído, Em Espera, Convidado, Descartado, Confirmado, Check-in, Vendas, Opt-out) + barra proporcional.

Tabela "Leads dos Eventos":
Colunas: checkbox · Lead (nome/telefone) · Evento · Loja · Atribuído a · Cadeira · Status · Data Final · Ações (kebab)
Busca por lead (nome/telefone), paginação server-side (25/50/100).

Barra de ações em lote (aparece com seleção):
- Reatribuir (modal 1b)
- Alterar Data (modal 1c — altera data_fim do evento pai)
- Alterar Lead (modal edição rápida)
- Encerrar Evento (modal 1d — marca leads não atribuídos como Descartado)
- Cancelar seleção
```

### Modais

- **Reatribuir**: lista de leads selecionados + busca de novo responsável (mostra cadeira e leads ativos). Confirma via RPC que grava logs em `logs_movimentacao_contatos` e `eventos_prospeccao` (status Atribuído).
- **Alterar Data Final**: campo data atual (read-only) + nova data + aviso "afetará N leads". Atualiza `prospeccoes.data_fim`.
- **Encerrar Evento**: mostra totais (leads, atribuídos, pendentes). Ao confirmar: `prospeccoes.encerrado_at = now()` e leads sem responsável viram Descartado (log por evento).
- **Alterar Lead**: edição inline de dados básicos do contato.

### Backend (migração)

Novas RPCs `SECURITY DEFINER` com guarda de `canAccessAdminConfig` via `has_role`/checagem de perfil:

- `get_diagnostico_eventos_kpis(filtros jsonb)` → retorna KPIs + breakdown de status por evento (usa `get_contato_status_por_evento`).
- `get_diagnostico_eventos_leads(filtros jsonb, page, page_size)` → lista paginada.
- `bulk_reatribuir_leads(lead_ids uuid[], prospeccao_id uuid, novo_user_id uuid)` → grava logs por evento.
- `bulk_alterar_data_fim(prospeccao_ids uuid[], nova_data date)`.
- `encerrar_evento_diagnostico(prospeccao_id uuid)` → seta `encerrado_at`, marca pendentes como Descartado via `logs_movimentacao_contatos`.

Todas com log de auditoria em `logs_prospeccoes` (actor = admin real, motivo = "diagnostico-eventos").

### Frontend

Arquivos novos:
- `src/pages/admin/DiagnosticoEventos.tsx` — página principal.
- `src/components/admin/diagnostico/DiagnosticoFilters.tsx`
- `src/components/admin/diagnostico/DiagnosticoKpis.tsx`
- `src/components/admin/diagnostico/DiagnosticoStatusBar.tsx`
- `src/components/admin/diagnostico/DiagnosticoLeadsTable.tsx`
- `src/components/admin/diagnostico/ReatribuirModal.tsx`
- `src/components/admin/diagnostico/AlterarDataModal.tsx`
- `src/components/admin/diagnostico/EncerrarEventoModal.tsx`
- `src/components/admin/diagnostico/AlterarLeadModal.tsx`
- `src/hooks/useDiagnosticoEventos.ts` — filtros/queries via React Query.

Alterações:
- `src/App.tsx`: rota `/administracao/diagnostico-eventos`.
- `src/pages/Administracao.tsx`: novo card "Diagnóstico de Eventos" (ícone `Activity`), permissão `canAccessAdminConfig`.

### Regras / observações

- Status na tabela usa `get_contato_status_por_evento(contato_id, prospeccao_id)` — sem `contatos.status` global.
- "Cadeira" = registro em `external_access_seats` do responsável quando aplicável.
- "Eventos expirados" = `data_fim < CURRENT_DATE AND encerrado_at IS NULL`.
- Empresa sandbox `b32ae8c9-...` excluída por padrão.
- Exportar CSV usa mesma consulta filtrada, servidor-side.
- Segue tokens semânticos (nada de cores hardcoded).
- Não altera `bulk_upsert_contatos`, quarentena, ou lógica de auto-atribuição.

### Perguntas em aberto (posso assumir defaults se preferir)

1. "Alterar Lead" em lote deve editar apenas campos comuns (nome/telefone/observação) ou abrir modal por lead? Assumindo edição individual via kebab.
2. Ao encerrar evento com leads Atribuídos ainda ativos, apenas os "não atribuídos" viram Descartado (como no print 1d) — Atribuídos permanecem no status atual. OK?
3. "Cadeira" exibida vem de `external_access_seats` do responsável — se o responsável for interno (não terceiro), mostrar "—". OK?
