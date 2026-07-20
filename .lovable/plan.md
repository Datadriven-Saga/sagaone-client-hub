# Plano: Reset de leads herdados no evento SUPER AÇÃO TOYOTA T7

## Regra definitiva (exemplo Roberto)

> Se o Roberto está como responsável de um lead no T7, mas o Roberto **não faz parte da equipe do evento T7**, o lead do Roberto volta para **Novo, sem responsável**. Assim as prospectoras da equipe do T7 podem solicitar esse lead.

Isso vale independente de o Roberto estar em outros eventos — o critério é só "pertence ou não à equipe do T7".

## Escopo (o que muda)

Evento alvo: `04b7c015-a189-4b32-98bc-beae52ea3294` (SUPER AÇÃO TOYOTA T7).

Universo: leads vinculados ao T7 em `eventos_prospeccao` que **não têm nenhum log** em `logs_movimentacao_contatos` para esse `prospeccao_id` (~1436 leads).

Para cada lead desse universo:

1. Inserir 1 log em `logs_movimentacao_contatos`:
   - `contato_id` = lead
   - `prospeccao_id` = T7
   - `status_novo` = `'Novo'`
   - `status_anterior` = status derivado atual (informativo)
   - `usuario_id` = NULL
   - `observacoes` = `'Reset de herança T7 — lead sem histórico neste evento'`

2. `UPDATE contatos SET responsavel_email = NULL` **quando** o `responsavel_email` atual do lead não pertence à equipe do T7 (não está em `prospeccao_equipe_membros` para nenhuma equipe do T7). O status global (`contatos.status`) **não** é alterado.

## O que NÃO muda

- ~727 leads oficiais do T7 (com log próprio no evento) — intocados.
- `contatos.status` global — inalterado.
- Outros eventos do lead — inalterados; se Roberto trabalha o mesmo lead em outro evento, aquele Kanban continua mostrando Roberto como responsável (a leitura por evento usa os logs do próprio evento — o global só é fallback).
- Funções `get_contato_status_por_evento` / `get_kanban_columns_limited` — não alteradas neste passo.
- Webhook Mobi — não dispara (só reage a `Confirmado/Check-in/Descartado`).

## Riscos e mitigação

- **Risco:** limpar `responsavel_email` global impacta a leitura de outros eventos que ainda usam esse campo como fallback (leads sem log próprio em outros eventos). **Mitigação:** só limpamos quando o responsável não está na equipe do T7 — na prática, esse responsável já não faz sentido para o T7. Nos outros eventos, se ele também estiver "fantasma" (sem log próprio lá), o lead vira Novo lá também — o que é o comportamento correto, porque significa que ninguém realmente trabalhou aquele lead lá.
- **Rollback do reset de status:** `DELETE FROM logs_movimentacao_contatos WHERE prospeccao_id = '04b7c015-…' AND observacoes = 'Reset de herança T7 — lead sem histórico neste evento'`.
- **Rollback do responsável:** faço snapshot em CTE antes do UPDATE — se precisar reverter, restauramos a partir do snapshot (posso deixar num `.csv` em `/mnt/documents/` antes de rodar).

## Validação após executar

1. Abrir Kanban do T7:
   - Coluna **Novo** aumentou em ~1436.
   - **Confirmado** = 1 (Francisco de Assis Moraes).
   - Colunas Atribuído / Em Espera / Descartado / Convidado só mostram os leads oficiais (~727 no total).
   - Nenhum lead novo aparece com Roberto (ou qualquer responsável fora da equipe do T7).
2. Conferir 3 leads que estavam "Confirmado fantasma" (ex.: `jose.rfilho`) — devem aparecer em Novo, sem responsável.
3. Abrir a fila de solicitação da equipe do T7 — os leads liberados devem estar disponíveis.

## Passo 2 (num plano separado depois de validar)

Ajustar `get_contato_status_por_evento` / `get_kanban_columns_limited` para nunca herdar `contatos.status` e `responsavel_email` global quando não há log próprio do evento **e** o responsável global não faz parte da equipe do evento. Assim a herança fantasma nunca reaparece em nenhum evento.

## Execução

Um único bloco SQL (INSERTs em `logs_movimentacao_contatos` + UPDATE seletivo em `contatos.responsavel_email`), rodado via ferramenta de dados. Antes do UPDATE eu gero um CSV de snapshot com `(contato_id, responsavel_email_antigo)` para permitir rollback fino.

Confirma para eu executar.