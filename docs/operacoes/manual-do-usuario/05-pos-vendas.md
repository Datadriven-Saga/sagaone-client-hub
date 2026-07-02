# 5. Pós-Vendas (Paty)

**Perfis:** CRM *(TBD — responsável formal a definir)*, Gestor de Pós-Venda.

A **Paty** é o agente WhatsApp de pós-venda. Ela vive **fora** do SagaOne (roda no n8n + banco Paty) — o SagaOne é onde você **configura** quais mensagens ela dispara e quando.

## Paty = 3 IAs em uma

Sob o rótulo "Paty" existem, na prática, **três agentes** com objetivos diferentes. Cada um tem sua própria aba no menu, seus gatilhos e seus templates. Todos seguem a **mesma regra de agente compartilhado por marca + UF**.

| Braço da Paty | Origem dos gatilhos | Para onde vai |
|---|---|---|
| **Peças** | MySaga | Cliente (WhatsApp) |
| **Entregas de veículos** | Saga Conecta | Cliente (WhatsApp) |
| **Pós-Vendas (Agendamentos)** | DataLake | Cliente (WhatsApp) + integra com Mobi |

## Regra número 1

> **A Paty só dispara se o gatilho tiver template vinculado e ativo.** Sem template, o gatilho é recebido e ignorado silenciosamente.

## Agente compartilhado por marca + UF

- Cada agente Paty é um número WhatsApp cadastrado.
- **Quando marca e UF são iguais, o agente é compartilhado entre todas as lojas.** Exemplo: todas as Hyundai do DF usam o mesmo agente/número.
- Consequência prática: **o template que você configura numa loja vale para todas as lojas da mesma marca+UF**. Não precisa (nem deve) duplicar a configuração loja a loja.

## Sub-áreas

| Sub-área | O que é | Fonte do gatilho |
|---|---|---|
| **Peças** | Gatilhos de agendamento/retirada de peças. Um template por gatilho. | MySaga |
| **Entregas** | Gatilhos de entrega de veículo novo. Aceita **múltiplos templates em sequência** por gatilho (ex.: 24h antes + 1h antes + confirmação). | Saga Conecta |
| **Agendamentos (Pós-Vendas)** | Gatilhos de serviços de pós-venda (revisão, retorno etc.). Aciona a Paty e integra com o Mobi. | DataLake |
| **Cadência** | Sequência de follow-ups conversacionais que a Paty usa depois do primeiro contato. | — |

## Checklist mínimo para a Paty começar a disparar

1. **Agente ativo** para a marca/UF (Admin/TI cadastra).
2. **Template aprovado na Meta** para aquele agente.
3. **Gatilho vinculado ao template** na tela de Peças/Entregas.
4. **Toggle "Ativo" ligado** no gatilho.

Faltando qualquer um dos 4, a Paty não dispara.

## Entregas — como funciona a multi-template

- Cada gatilho (ex.: "Aviso 24h antes da Entrega") pode ter **N templates em sequência**.
- Você adiciona, remove e reordena na tela. A Paty dispara na ordem configurada.
- Toggle liga/desliga o gatilho inteiro — não precisa apagar templates para pausar.

**Origem dos gatilhos de Entregas:** o Saga Conecta **já envia todos os gatilhos automaticamente**. Você só precisa garantir que cada gatilho relevante tenha template vinculado. Se o gatilho não tem template, a mensagem simplesmente não sai — sem erro visível.

## Peças — como funciona

- Um template por gatilho. Selecione da lista de aprovados.
- Toggle liga/desliga.
- Ao ligar/desligar, o sistema **automaticamente sincroniza** com o backend externo — o que você vê na tela é o que a Paty faz.

## Agendamentos (Pós-Vendas) — como funciona

É o braço da Paty voltado para **serviços de pós-venda** (revisão, retorno de garantia, etc.). Origem dos gatilhos: **DataLake**.

> **Hoje:** os gatilhos de pós-vendas vêm do DataLake e **geram eventos direto no Mobi**. A Paty ainda **não** intermedeia a criação do agendamento — a tela de Agendamentos serve para acompanhar o que já caiu no Mobi.
>
> **Evolução em curso:** estamos migrando para que esses gatilhos **passem pela Paty antes**. Ela conversa com o cliente pelo WhatsApp e **só cria o agendamento no Mobi quando o cliente confirmar**. Assim para de gerar agendamento cego no Mobi.
>
> **O que muda quando estiver no ar:** a tela de Agendamentos vai mostrar não só o que foi agendado, mas também o **status da conversa da Paty** (aguardando resposta, confirmado, recusado) antes do registro cair no Mobi.

## Template pausado (Meta pausou)

> **TBD — comportamento operacional ainda não definido pelo time.**

Hoje o SagaOne detecta a pausa e marca o template como indisponível. A ação recomendada até o time definir SLA é:

1. Trocar o template pausado por um equivalente aprovado.
2. Se não houver equivalente, desligar o toggle do gatilho até resolver com a Meta.

## Quem configura o quê

> **TBD** — a responsabilidade formal está em definição. Encaminhamento provável: **CRM** configura templates e gatilhos; **Admin/TI** cadastra agentes e números.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Paty não disparou depois do gatilho | Conferir se o gatilho tem template vinculado E está ativo. |
| Mudei template numa loja e a outra da mesma marca/UF também mudou | Comportamento esperado — agente compartilhado. |
| Template não aparece na lista | Não está aprovado, ou está pausado, ou é de outro agente. |
| Toggle não desliga | Aguardar 3s (sincronização externa) e recarregar. |
| Agendamentos vazio ou desatualizado | Pipeline DataLake→(Paty→)Mobi parado. Escalar TI/CRM com o `id_meta` do agente. |

> 🎥 Vídeo sugerido: *"Configurar Paty — vincular gatilho e template em Peças e Entregas"* (P1 — pendente de gravação).