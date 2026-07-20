
# Recomendação: Passo 1 primeiro, depois Passo 2

## Minha sugestão

**Fazer Passo 1 hoje** (data fix no evento T7) e **validar visualmente no Kanban do T7**. Só depois, num segundo turno, aplicar o Passo 2 (mudar as funções de fallback + esconder responsável fora da equipe). Assim, se algo estranho aparecer, a gente reverte apenas 1 INSERT em `logs_movimentacao_contatos` sem ter mexido em função crítica que serve outros eventos.

## O que EXATAMENTE o Passo 1 toca (e o que NÃO toca)

Regra do filtro é uma só, e é muito estrita:

> Só entram no reset os `(contato_id, prospeccao_id='04b7c015-…')` que **não têm nenhum registro** em `logs_movimentacao_contatos` para esse `prospeccao_id`. Ou seja, o Kanban do T7 nunca tocou nesses leads — o status/responsável exibido veio 100% do global.

### NÃO mexemos em (leads "oficiais" do T7)

Todos que têm ao menos 1 log neste evento — total **~727 leads**:

- 330 Atribuído + 168 Descartado + 100 Convidado + 100 Em Espera (log deste evento bate com global) — intocados.
- 27 Atribuído no evento / Em Espera global — intocados (log deste evento manda).
- 25 Atribuído no evento / Descartado global — intocados.
- 3 Atribuído no evento / Convidado global — intocados.
- **1 Confirmado real (Francisco de Assis Moraes)** — intocado.

### MEXEMOS em (herança de outros eventos) — total **~1436 leads**

Todos com `(sem log neste evento)`:

- 672 aparecendo como Atribuído
- 389 aparecendo como Em Espera
- 254 aparecendo como Descartado
- 96 aparecendo como Convidado
- 25 aparecendo como Confirmado (os que você viu — jose.rfilho etc.)

Para cada um desses, inserimos **1 log** no evento T7 com `status_novo='Novo'`, `usuario_id=NULL`, `observacoes='Reset herança T7'`. Depois disso o Kanban do T7 mostra eles como Novo, sem responsável fantasma.

## O que pode quebrar (auditoria de riscos)

1. **Webhook Mobi**: o trigger `trg_dispatch_movimentacao_lead_webhook` só dispara para `status_novo ∈ {Confirmado, Check-in, Descartado}`. Estamos inserindo `Novo` → **não dispara nada** para o Mobi. ✅
2. **`contatos.status` global**: **não é alterado**. Eventos anteriores (`FECHA QUARTEIRÃO`, `DIA DAS MÃES`, etc.) continuam vendo o lead como Confirmado lá, porque a leitura deles usa os logs **daqueles** eventos, que continuam intocados. ✅
3. **Responsável (`contatos.responsavel_email` global)**: também não é alterado. No T7, para esconder responsável fora da equipe, isso vai no Passo 2 (filtro na RPC do Kanban). Enquanto o Passo 2 não sai, os leads resetados vão aparecer como Novo mas ainda com o nome do vendedor herdado ao lado — visualmente estranho, mas dado consistente. Se quiser, no Passo 1 já jogamos `NULL` em `responsavel_email` **apenas para os leads resetados que não estão em outro evento ativo**, para não impactar outros Kanbans. Me diz se prefere assim.
4. **`get_contato_status_por_evento` / `get_kanban_columns_limited`**: continuam como estão. O Passo 1 sozinho não muda função nenhuma — se novos leads forem adicionados amanhã ao T7 vindos de eventos antigos, o problema reapareceria (por isso o Passo 2 é o fix definitivo).
5. **Relatórios agregados**: usam `contatos.status` global ainda — não são afetados pelo Passo 1.

## Ordem sugerida

1. Rodar Passo 1 (INSERTs seletivos). Você abre o Kanban do T7 e valida: Confirmado = 1, colunas com contagem esperada.
2. Se ok → rodar Passo 2 (ajuste da RPC de fallback + filtro do responsável por equipe). Isso evita a herança voltar em novos leads.
3. Documentar no memory que fallback de `contatos.status` no `get_contato_status_por_evento` é PROIBIDO quando não há log próprio.

## Pergunta antes de executar

No Passo 1, para os leads resetados, você quer que eu **também zere o `responsavel_email`**?

- (a) **Não** — mantém o email atual (fica visual estranho até Passo 2). Mais seguro, zero risco de mexer em outros eventos.
- (b) **Sim, mas só quando o lead não está ativo em nenhum outro evento** (`Novo/Atribuído/Contatado/Em Espera/Convidado` em outra prospecção). Zera com segurança.
- (c) **Sim, sempre** — zera para todos os 1436. **NÃO recomendo**, porque afeta outros eventos ativos.

Me confirma (a), (b) ou (c) e se prefere aplicar Passo 1 agora e Passo 2 depois (recomendado) ou os dois juntos.
