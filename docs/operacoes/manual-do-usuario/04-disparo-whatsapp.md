# 4. Disparo WhatsApp

**Perfis:** Gestor de leads, CRM.

Este capítulo cobre o disparo em massa de WhatsApp para uma base — o clássico "convite para o evento". Não confunda com a Paty (pós-venda) — essa está no capítulo 5.

## Ordem do processo

```text
1. Criar evento base  →  2. Subir base (planilha ou pool)
           ↓                              ↓
3. Escolher template + cadência  →  4. Disparar (agora ou agendado)
           ↓
5. Acompanhar (Kanban + Relatórios)
```

## Passo 1 — Evento base

- Menu **Prospecção → Evento Base**.
- Preencha nome, período e loja. Isso vira o "container" da campanha.
- Só gestor de leads ou CRM cria evento.

## Passo 2 — Subir a base

Você tem dois caminhos:

- **Planilha (XLSX/CSV):** para bases próprias, negociadas fora do sistema. Suba no menu **Entra Dados → Importar Planilha** ou direto no evento.
- **Pool / DataLake:** base de clientes já existente no ecossistema Saga. Hoje o Pool é composto **apenas por leads finalizados sem venda no Mobi** (últimos 12 meses, ingeridos pela integração `ingest-base-clientes`). Você filtra por marca, UF, modelo etc. e vincula ao evento.

> *Roadmap:* o Pool vai evoluir para receber outras fontes além do Mobi (não é só "cliente que passou pela loja e não comprou"). Enquanto isso, se precisa de outro perfil de base, use Planilha.

Diferença prática: planilha é sua base "de fora", pool é a base "de dentro" — hoje limitada a Mobi sem venda.

## Passo 3 — Template e cadência

O SagaOne trata **cadência** em dois níveis independentes que costumam confundir. Não são a mesma coisa.

### A. Cadência do evento (`cadencia_completa`)

Configuração do **evento**, definida na **criação** dele. Só existe para eventos do tipo **IA WhatsApp** e depende da feature flag `pri_whats_cadencia_completa` estar **ligada para a empresa**.

- **Desligada (padrão) — "Cadência normal":**
  - Evento precisa apenas do **template inicial** (o convite).
  - Opcionalmente configura dois templates de **retargeting** que a Pri usa quando o lead responde: um para quem **agendou** e outro para quem **não agendou**.
  - Mais flexível — bom para eventos pontuais.

- **Ligada — "Cadência completa":**
  - Evento **exige** os templates fixos abaixo, com horários **travados** (você não escolhe quando):
    - Template **inicial** (o convite).
    - Template para agendados — **48h antes** do evento.
    - Template para agendados — **24h antes** do evento.
    - Follow-up **4h depois** do disparo inicial para quem **não respondeu**.
  - Sem esses templates preenchidos, o evento não deixa disparar.

- **Quem liga o toggle no evento:** gestor de leads / CRM na criação (`Prospecção → Evento Base`).
- **Uma vez criado com Cadência completa, não dá para desligar** — só recriando o evento (o toggle fica travado na edição).
- **Quem controla a flag da empresa:** **Admin + TI**, em `/administracao/feature-flags` (`pri_whats_cadencia_completa`). Sem a flag ligada, o toggle nem aparece.

### B. Cadência do disparo (lotes de envio)

Configuração feita **na hora do disparo**, dentro do modal **"Programar disparo"**. É só como o **envio inicial** é fatiado no tempo — nada a ver com a cadência do evento.

| Modo | O que faz |
|---|---|
| **Tudo de uma vez** | 1 lote único no horário escolhido. |
| **Dividir em N lotes** | Você define quantos lotes; sistema calcula o tamanho de cada um. |
| **Lotes de X contatos** | Você define o tamanho; sistema calcula quantos lotes. |

- **Intervalo entre lotes:** 30 min ou 1h (mínimo 30 min).
- **Janela permitida:** **07:00–20:00 (Brasília, GMT-3)**. Horário fora disso é recusado.
- O modal mostra um **resumo** com total de lotes, horário do primeiro e último envio e **custo estimado** (US$ 0,06 por disparo).

### Sobre o template em si

- **Template** = mensagem aprovada na Meta. Só aparece na lista se estiver **aprovado** e **não pausado**.
- Templates são compartilhados por `id_meta` — ver [Pós-Vendas / Paty](./05-pos-vendas.md) para a lógica de compartilhamento por marca + UF.

## Passo 4 — Programador de disparos

Você tem duas formas de disparar:

### Agora (disparo imediato)
Envia direto, sem passar pelo programador. O sistema quebra em micro-lotes de 5 msgs a cada 500ms para respeitar o rate-limit da Meta.

### Programar (agendar)
Abre o modal **"Programar disparo de WhatsApp"** e o fluxo é:

1. Escolhe **data + horário** do **primeiro** envio (janela 07h–20h Brasília).
2. Escolhe a **divisão** (tudo de uma vez / N lotes / lotes de X) + **intervalo**.
3. Confirma.

O que o sistema faz nos bastidores:

- **Congela um snapshot** da base pendente no momento em que você confirma. Leads que entrarem depois **não** vão junto — precisam de novo disparo.
- Cria um `campaign_job` com status `scheduled`.
- Cria todos os `campaign_batches` já com `scheduled_at` calculado (`primeiro + N × intervalo`).
- Um dispatcher (`scheduled-campaign-dispatcher`) roda **a cada minuto**, pega batches com `scheduled_at <= agora` e envia respeitando 5 req/500ms.

**Regras do programador:**

- **Um evento só pode ter um disparo programado por horário.** Tentar programar outro no mesmo slot dá erro (`uq_campaign_jobs_scheduled_slot`).
- **Cancelar programado:** pelo menu `Prospecção → Disparos Programados`, enquanto o job ainda não começou a processar. Ao cancelar, batches não executados são liberados.
- **Recuperação de órfãos:** batch travado >15 min em `processing` é reivindicado pelo próprio dispatcher no ciclo seguinte — nada a fazer no front.
- **Sem aprovação prévia:** gestor com acesso programa direto. Não há duplo check.

## Passo 5 — Acompanhar

- **Prospecção → Disparos Programados:** mostra jobs ativos, em processamento, agendados.
- **Administração → Logs de Disparos:** log completo, exportável, com custo por template.
- **Resultados → Dashboards:** métricas de entrega e resposta.

## Template pausado — o que fazer

Quando a Meta pausa um template (excesso de bloqueios pelos usuários), o SagaOne recebe o aviso automaticamente e:

- **Cancela** os agendamentos futuros que usariam aquele template.
- **Notifica** o dono da campanha.
- **Bloqueia** novos disparos com aquele template até você vincular outro válido.

Ação do usuário: abrir o evento, escolher outro template aprovado e reagendar. Se estava no meio de uma cadência de 4, precisa substituir o template pausado por um equivalente.

## Job órfão / disparo "travado"

- Se um disparo fica **>15 min** no status "em processamento" sem avançar, o sistema tem **recuperação automática** (roda a cada minuto) que reivindica o job e continua.
- Ação do usuário: **aguardar até 15 min**. Se passar disso e o contador não mexer, avisar TI com o ID do evento.
- Nunca "reforçar disparo" cancelando e recriando — cria duplicata.

## Regras que evitam dor de cabeça

- **Não trocar de empresa ativa no meio de um disparo.** O contexto muda.
- **Não subir a mesma planilha duas vezes** — o pool deduplica por telefone, mas planilha vai para import direto.
- **Custo por template:** MARKETING ≈ $0.0625 / UTILITY ≈ $0.0068 (USD/disparo). Aparece na tela ao selecionar.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| "Disparo já em andamento" | Já existe job ativo pro mesmo evento. Espere terminar. |
| "Já existe um disparo programado para este horário" | Escolher outro horário ou cancelar o programado atual em Disparos Programados. |
| Programei mas não vejo em "Disparos Programados" | Confirmar filtro e evento — o job aparece com status `scheduled` até o horário chegar. |
| Template sumiu da lista | Foi pausado ou reprovado pela Meta — escolher outro. |
| Agendamento não rodou na hora | Dispatcher processa em janela de 1 min; aguarde 2 min. |
| Job "em processamento" há mais de 15 min | Recuperação automática vai pegar; se não, chamar TI. |

> 🎥 Vídeo sugerido: *"Criar evento, subir base e disparar campanha WhatsApp"* (P1 — pendente de gravação).