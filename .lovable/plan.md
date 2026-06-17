# Atualizar documentacao com as duas ultimas alteracoes concluidas

## Contexto

As duas alteracoes recentes no sistema de disparo WhatsApp ja foram implementadas e precisam ser refletidas corretamente na documentacao:

1. **Chunking server-side para disparos imediatos** — Mitigacao do timeout do Edge Function (`waitUntil` ~5-6 min) dividindo batches grandes (>250 leads) em batches filhos `scheduled` processados pelo cron.
2. **Janela de disparo alterada de 07-22 para 07-20** — Reducao do horario permitido em todas as camadas (UI, edge dispatcher e doc).

## Tarefas

### 1. Atualizar `.lovable/plan.md`

O plano atual esta escrito como instrucao de implementacao (futuro). Precisa ser reescrito como registro de conclusao:

- Renomear titulo para refletir ambas as alteracoes concluidas.
- Reestruturar como "Registro de alteracoes" em vez de plano de execucao.
- Adicionar secao sobre o chunking server-side (contexto, mitigacao, parametros `MAX_LEADS_PER_BATCH=250` / `STAGGER_MS=30000`, guarda `lot_index IS NULL`).
- Manter secao da janela 07-20 como concluida.
- Atualizar verificacao para incluir testes do chunking.

### 2. Revisar `docs/fluxo-disparo-whatsapp.md`

O documento ja contem as duas alteracoes, mas sera revisado para garantir consistencia:

- Confirmar que a secao de chunking esta completa e alinhada com a implementacao real.
- Confirmar que todas as menencias a janela sao `07-20` (sem resquicios de `07-22` ou `22:00`).
- Corrigir qualquer inconsistencia encontrada.

### 3. Verificar memorias relacionadas

Se houver memoria em `.lovable/memory/` sobre disparo WhatsApp, atualizar com:
- Horario da janela (07-20).
- Chunking como mecanismo de resiliencia para batches grandes.

## Fora de escopo

- Nenhuma mudanca de codigo (ja implementada).
- Nenhuma migration SQL.
