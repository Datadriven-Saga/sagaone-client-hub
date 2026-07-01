# Atribuição SDR / Vendedor

**Área:** Prospecção
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Regras que determinam **quem** atende cada lead. Divididas em duas famílias:

1. **Auto-atribuição** (Grande Evento / Mensal): distribui leads recém-chegados para SDRs disponíveis usando modelos **Round-Robin** ou **Fila** por departamento.
2. **Manual**: gestor atribui direto, ou SDR "puxa" um lead disponível.

## Fluxo funcional (para usuário)

### SDR
- Recebe até **30 leads** em atendimento simultâneo (Atribuído + Contatado + Em Espera). Ao passar do limite, o próximo é bloqueado até liberar.
- Só enxerga leads dos **eventos aos quais está vinculado** via `prospeccao_equipe_membros`.
- Multi-select de eventos no Kanban usa filtro `ANY()` — vê a interseção real das suas prospecções.

### Vendedor
- Recebe leads em status **Em Espera** / **Convidado**.
- Faz check-in no dia do evento (via FAB ou pela Recepção).
- Registra Venda / Descarte com motivo.

### Gestor
- Vê todos os leads da empresa.
- Redistribui manualmente, aprova exceções ao lock.
- Configura equipes em [`/administracao/equipes-prospeccao`] via `canManageProspeccaoEquipes`.

### Master / TI / Admin
- `canSeeAllEventos = true` — enxerga eventos de qualquer empresa dentro do escopo permitido.

## Detalhes técnicos

- **Hooks:** `useAutoAtribuirLeads`, `useUserAccessType`, `useQuarentenaData`.
- **Tabelas:** `prospeccao_equipes`, `prospeccao_equipe_membros`, `contatos.responsavel_email`, `contatos.responsavel_id`.
- **Normalização de email:** `trg_normalize_responsavel_email` força `LOWER()` em insert/update; frontend também normaliza em lookups (ver memory `useUserAccessType`).
- **Regras de visibilidade:** [`.lovable/memory/security/enforcement/lead-visibility-security-rules`](../../.lovable/memory) — SDR só vê próprios; management sees all.
- **Lock 30 leads:** validado tanto no hook (`useAutoAtribuirLeads`) quanto server-side na RPC de atribuição.
- **Grande Evento / Mensal:** distribuição automática dispara ao vincular lead (via `bulk_upsert_contatos` ou `create-lead-pri`).

## Regras de negócio

- Sistema **preserva** responsável se já preenchido — nunca sobrescreve por integração automática.
- `create-lead-pri` só atribui à Pri IA se `responsavel_email IS NULL` **E** status é `Novo`.
- SDR excluído da equipe perde acesso ao evento — leads sob sua responsabilidade **permanecem** com o nome dele, mas ficam invisíveis; gestor precisa reatribuir.
- Se `bypass_compliance = true` na empresa, o lock de 30 é ignorado (uso restrito interno).

## Erros comuns

| Sintoma | Causa | Ação |
|---------|-------|------|
| Lead atribuído a mim mas não aparece | Filtro do Kanban não inclui o evento | Adicionar o evento no multi-select. |
| Contagem de atribuídos oscila | Case-sensitive em email do responsável | Rodar backfill lowercase, verificar `trg_normalize_responsavel_email`. |
| Nome do responsável diferente entre leads iguais | Diferença de casing no email | Mesma causa acima. |
| SDR não consegue puxar lead | Está no limite (30) ou fora da equipe | Verificar `prospeccao_equipe_membros`. |

## Relacionado

- [Kanban e status](./kanban-e-status.md)
- [Auditoria](./auditoria.md)
- [Permissões e RBAC](../arquitetura/permissoes-e-rbac.md) *(pendente)*