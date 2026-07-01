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
- **Pool / DataLake:** base já disponível no SagaOne (últimos 12 meses de clientes Saga). Filtre por marca, UF, modelo etc. e vincule ao evento.

Diferença prática: planilha é sua base "de fora", pool é a base "de dentro" já enriquecida.

## Passo 3 — Template e cadência

- **Template** = a mensagem aprovada na Meta. Você escolhe um da lista disponível para a marca/loja.
- **Cadência automática (4 templates)** — quando a flag está ativa, o sistema exige os 4 templates da sequência (convite, lembrete, D-1, D-0). Sem os 4, não deixa disparar.
- Cada template só aparece se estiver **aprovado** e **não pausado** pela Meta.

## Passo 4 — Disparar

- **Agora:** dispara imediatamente. O sistema quebra em lotes de 5 msgs a cada 500ms para respeitar rate-limit.
- **Agendado:** você escolhe data/hora. O dispatcher pega no minuto certo e roda.
- **Sem aprovação prévia:** hoje qualquer gestor com acesso dispara direto. Não há fluxo de aprovação em duas camadas.

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
| Template sumiu da lista | Foi pausado ou reprovado pela Meta — escolher outro. |
| Agendamento não rodou na hora | Dispatcher processa em janela de 1 min; aguarde 2 min. |
| Job "em processamento" há mais de 15 min | Recuperação automática vai pegar; se não, chamar TI. |

> 🎥 Vídeo sugerido: *"Criar evento, subir base e disparar campanha WhatsApp"* (P1 — pendente de gravação).