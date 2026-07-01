# 5. Pós-Vendas (Paty)

**Perfis:** CRM *(TBD — responsável formal a definir)*, Gestor de Pós-Venda.

A **Paty** é o agente WhatsApp de pós-venda. Ela vive **fora** do SagaOne (roda no n8n + banco Paty) — o SagaOne é onde você **configura** quais mensagens ela dispara e quando.

## Regra número 1

> **A Paty só dispara se o gatilho tiver template vinculado e ativo.** Sem template, o gatilho é recebido e ignorado silenciosamente.

## Agente compartilhado por marca + UF

- Cada agente Paty é um número WhatsApp cadastrado.
- **Quando marca e UF são iguais, o agente é compartilhado entre todas as lojas.** Exemplo: todas as Hyundai do DF usam o mesmo agente/número.
- Consequência prática: **o template que você configura numa loja vale para todas as lojas da mesma marca+UF**. Não precisa (nem deve) duplicar a configuração loja a loja.

## Sub-áreas

| Sub-área | O que é | Gatilhos que aceitam template |
|---|---|---|
| **Peças** | Templates para agendamento/retirada de peças. | Um template por gatilho. |
| **Entregas** | Templates para entrega de veículo novo. Aceita **múltiplos templates em sequência** por gatilho (ex.: 24h antes + 1h antes + confirmação). | Vários templates por gatilho, em ordem. |
| **Agendamentos** | Visão consolidada de tudo que a Paty agendou. Só leitura. | — |
| **Cadência** | Sequência de follow-ups conversacionais. | — |

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
| Agendamentos está vazio | Stack Paty externa fora — avisar TI. |

> 🎥 Vídeo sugerido: *"Configurar Paty — vincular gatilho e template em Peças e Entregas"* (P1 — pendente de gravação).