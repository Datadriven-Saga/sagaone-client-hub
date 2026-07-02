## Ajustes no Cap. 4 — Disparo WhatsApp

Reescrever/expandir três blocos do arquivo `docs/operacoes/manual-do-usuario/04-disparo-whatsapp.md`. Sem outras mudanças.

### 1. Passo 2 — o que é o Pool / DataLake

Substituir a descrição atual por:

> **Pool / DataLake:** base de clientes já existente no ecossistema Saga, hoje composta **apenas por leads finalizados sem venda no Mobi** (últimos 12 meses, ingeridos por `ingest-base-clientes`). Você filtra por marca, UF, modelo etc. e vincula ao evento.
>
> *Roadmap:* o Pool vai evoluir para ingerir outras fontes além do Mobi (não é só "cliente que passou pela loja e não comprou"). Enquanto isso, se precisa de outro perfil de base, use Planilha.

Manter a linha comparativa "planilha é sua base de fora, pool é a de dentro" com o ajuste de escopo.

### 2. Passo 3 — Template e cadência (reescrita completa)

Explicar direito as duas configurações independentes:

**A. Cadência do evento (`cadencia_completa`)** — configuração do **evento**, definida na criação, controlada pela feature flag `pri_whats_cadencia_completa` por empresa:

- **Desligada (padrão) — "Cadência normal":** o evento precisa apenas do **template inicial**. Também dá para configurar dois templates opcionais para retargeting: um para leads que **agendaram** e um para os que **não agendaram** (usados pela automação da Pri quando responde).
- **Ligada — "Cadência completa":** o evento **exige 3 templates fixos** obrigatórios, com horários travados:
  - Template inicial (o convite).
  - Template para agendados **48h antes** do evento.
  - Template para agendados **24h antes** do evento.
  - Mais um follow-up **4h depois do disparo inicial** para quem não respondeu.
  - Horários **não podem ser alterados**.
- Só aparece o toggle em eventos do tipo **IA WhatsApp**, e só quando a flag da empresa está ativa. Uma vez criado o evento com Cadência completa, **não dá para desligar** (só recriando o evento).
- Quem liga/desliga a flag: **Admin + TI** via `/administracao/feature-flags`.

**B. Cadência do disparo (lotes de envio)** — configuração feita **na hora do disparo**, dentro do modal "Programar disparo". Não confundir com a cadência do evento acima — aqui é como o **envio inicial** é fatiado no tempo:

- **Tudo de uma vez:** 1 lote único no horário escolhido.
- **Dividir em N lotes:** define quantos lotes; o sistema calcula o tamanho de cada um.
- **Lotes de X contatos:** define o tamanho; o sistema calcula quantos lotes.
- **Intervalo entre lotes:** 30 min ou 1h (mínimo 30 min).
- **Janela permitida:** 07:00–20:00 (horário de Brasília, GMT-3). Fora disso o horário não é aceito.

O modal mostra "resumo" com total de lotes, primeiro/último envio e custo estimado (US$ 0,06 por disparo).

### 3. Novo bloco — "Programador de disparos" (renomear/expandir o antigo Passo 4)

Deixar claro que o programador **cria um `campaign_job` agendado** com todos os batches físicos calculados na hora — a base é **congelada no momento em que você programa** (snapshot de leads pendentes).

- **Agora:** dispara imediatamente, sem passar pelo programador.
- **Agendar (programador):**
  1. Abre modal "Programar disparo".
  2. Escolhe data e horário do **primeiro** envio (janela 07h-20h Brasília).
  3. Escolhe divisão (tudo de uma vez / N lotes / lotes de X) + intervalo.
  4. Confirma. O sistema cria o job com status `scheduled` e todos os `campaign_batches` já com `scheduled_at` calculado (primeiro + N × intervalo).
- **Um evento só pode ter um disparo programado por horário** — se tentar programar outro para o mesmo slot, dá erro (`uq_campaign_jobs_scheduled_slot`).
- **Cancelar programado:** dá para cancelar via `Prospecção → Disparos Programados` enquanto ainda não começou a processar. Ao cancelar, os batches ainda não executados são liberados.
- **Quem processa:** dispatcher automático (`scheduled-campaign-dispatcher`) roda a cada minuto, pega os batches com `scheduled_at <= agora` e envia respeitando 5 req/500ms.
- **Recuperação de órfãos:** se um batch trava >15 min em `processing`, o próprio dispatcher reivindica no ciclo seguinte (nada a fazer no front).
- **Sem aprovação prévia:** gestor com acesso programa direto. Não há duplo check.

Adicionar linha na tabela "Se algo der errado":

| Sintoma | O que fazer |
|---|---|
| "Já existe um disparo programado para este horário" | Escolher outro horário ou cancelar o programado atual. |
| Programei mas não vejo em "Disparos Programados" | Confirmar filtro/evento; o job aparece com status `scheduled` até o horário chegar. |

### Manter
- Passo 1 (evento base), Passo 5 (acompanhar), bloco "Template pausado", "Job órfão", "Regras que evitam dor de cabeça", "Ordem do processo".
- Placeholder de vídeo P1 no final.

### Fora de escopo
- Não mexer no código, só documentação.
