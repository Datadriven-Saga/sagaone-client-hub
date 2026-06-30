## Plano — Liberar Segmentar Base (Pool / DataLake) para uso

Decisões confirmadas:

1. **Escopo:** validar + paridade total com planilha (quarentena, opt-out global, opt-out externo, `import_logs`, auditoria item-a-item).
2. **ReadOnly + eventos:** bloquear quando o evento já terminou (`data_fim < now()`). Eventos em progresso e futuros continuam permitidos.
3. **Governança:** leads em quarentena / opt-out são bloqueados silenciosamente e contados no toast (mesmo padrão da planilha).
4. **Auditoria:** resumo em `pool_segmentacoes` (já existe) + 1 entrada em `logs_prospeccoes` por importação.

### Mudanças por área

**Banco (migration)**

- `get_pool_clientes_for_empresa`
  - Ler `dias_max` da permissão efetiva do `auth.uid()` (`canImportPoolFull` ou `canImportPoolReadOnly`) e clampar `p_dias_atras` server-side.
  - Aplicar mascaramento `LEFT(digits,4) || '****'` no telefone quando o usuário só tem `canImportPoolReadOnly`.
  - Retornar 401/erro se o usuário não tem nenhuma das duas permissões (defesa em profundidade — o front já bloqueia).

- `importar_pool_para_evento`
  - Revalidar `dias_max` contra `criado_em_origem` de cada item em `p_itens`.
  - Quando `eventos_permitidos='futuros'` no `valor` do ReadOnly: recusar se `prospeccoes.data_fim < now()` (evento encerrado). Permite em progresso e futuros.
  - Validar `global_opt_outs` (telefone).
  - Validar `contato_quarentena` por marca/UF/canal (mesma lógica usada pelo `bulk_upsert_contatos`).
  - Validar opt-out externo via cache `external_optout_snapshots` (mesmo helper do `process-import`, fail-closed).
  - Retornar contadores estruturados: `imported`, `blocked_quarentena`, `blocked_optout_global`, `blocked_optout_externo`, `blocked_janela`, `blocked_evento_encerrado`.
  - Inserir 1 linha em `logs_prospeccoes` com `acao='importacao_pool'`, `detalhes` (JSON com `segmentacao_id`, contadores, filtros).
  - Inserir 1 linha em `import_logs` com origem `pool` (para auditoria unificada com a planilha).

**Frontend**

- `PermissionRegistry.ts` / `useUserAccessType.ts`: remover o macro `canImportPool` legado, manter só `canImportPoolFull` e `canImportPoolReadOnly` (corrige a inconsistência de CRM "ter acesso macro" sem entrar na tela).
- `ImportarDoDataLake.tsx`:
  - Toast de resumo com os 6 contadores (Importados / Quarentena / Opt-out global / Opt-out externo / Fora da janela / Evento encerrado), reaproveitando o componente do resumo da planilha.
  - Mensagem clara quando o ReadOnly tenta um evento encerrado.

**Docs**

- `docs/fluxo-importacao-pool.md`: fluxo, RPCs, permissões, regras de quarentena/opt-out, auditoria, checklist de liberação.

### Checklist de pré-liberação

- Admin Master → slider ilimitado, importa qualquer evento.
- CRM (`dias_max=90`) → slider trava em 90 mesmo chamando o RPC direto.
- SDR (`dias_max=30`, `eventos_permitidos='futuros'`) → bloqueado para eventos já encerrados, telefone mascarado, sem edição inline.
- Sem permissão → opção "Segmentar Base" desabilitada e RPC rejeita.
- Lead em quarentena / opt-out global / opt-out externo aparece como bloqueado no toast e não vincula.
- `logs_prospeccoes` ganha 1 entrada `importacao_pool` por importação.
- `import_logs` ganha 1 entrada com origem `pool`.

### Áreas críticas / fora de escopo

- **Não alterar** `bulk_upsert_contatos`.
- Não mexer em RLS de `eventos_prospeccao` nem em visibilidade de leads.
- Não tocar no fluxo de planilha.
- Não adicionar busca textual server-side agora (segue local, conforme decisão anterior).
