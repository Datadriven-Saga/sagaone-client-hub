## Ajustes no Cap. 5 — Pós-Vendas (Paty)

Reescrever a abertura, a tabela de sub-áreas e a seção de Agendamentos do arquivo `docs/operacoes/manual-do-usuario/05-pos-vendas.md` para refletir que a Paty é **3 IAs em uma** e que Agendamentos é o braço de Pós-Vendas propriamente dito.

### 1. Abertura — "Paty são 3 IAs em uma"

Substituir o parágrafo inicial por uma explicação clara de que sob o rótulo "Paty" existem **três agentes** integrados, cada um com origem/destino diferentes:

| Braço da Paty | Origem dos gatilhos | Para onde vai |
|---|---|---|
| **Peças** | MySaga | Cliente (WhatsApp) |
| **Entregas de veículos** | Saga Conecta | Cliente (WhatsApp) |
| **Pós-Vendas (Agendamentos)** | DataLake | Cliente (WhatsApp) + integra com Mobi |

Cada braço tem sua própria aba na tela, seus próprios gatilhos e seus próprios templates. A **regra do agente compartilhado por marca+UF vale para os três**.

### 2. Tabela "Sub-áreas" — reescrever

Trocar a tabela atual (que trata Agendamentos como "visão só-leitura") por uma que descreva os três braços + Cadência:

| Sub-área | O que é | Fonte do gatilho |
|---|---|---|
| **Peças** | Gatilhos de agendamento/retirada de peças. Um template por gatilho. | MySaga |
| **Entregas** | Gatilhos de entrega de veículo novo. Aceita **múltiplos templates em sequência** por gatilho. | Saga Conecta |
| **Agendamentos (Pós-Vendas)** | Gatilhos de serviços de pós-venda (revisão, retorno etc.). Aciona a Paty e integra com o Mobi. | DataLake |
| **Cadência** | Sequência de follow-ups conversacionais que a Paty usa depois do primeiro contato. | — |

### 3. Seção "Agendamentos" — nova (substituindo "Agendamentos está vazio" na tabela de erros e a linha antiga na tabela de sub-áreas)

Adicionar bloco explicando o estado atual **e a evolução em curso**:

> **Hoje:** os gatilhos de pós-vendas vêm do DataLake e **geram eventos direto no Mobi**. A Paty ainda não intermedeia a criação do agendamento.
>
> **Evolução em curso:** estamos migrando para que esses gatilhos **passem pela Paty antes** — ela conversa com o cliente pelo WhatsApp e **cria o agendamento de serviços de pós-venda** (revisão, retorno etc.) no Mobi só quando o cliente confirmar.
>
> **O que muda para o usuário quando estiver no ar:** as telas de Agendamentos passam a mostrar não só o que foi agendado, mas também o **status da conversa da Paty** (aguardando resposta, confirmado, recusado) antes do agendamento cair no Mobi.

Manter, no cheat sheet de erros, uma versão atualizada da linha:

| Sintoma | O que fazer |
|---|---|
| Agendamentos vazio ou desatualizado | Verificar se o pipeline DataLake→Paty→Mobi está rodando; escalar TI/CRM com o `id_meta` do agente. |

### 4. Manter (sem mudança)

- Regra número 1 ("só dispara com template ativo").
- Bloco "Agente compartilhado por marca+UF".
- Checklist mínimo dos 4 passos.
- Seções "Entregas — multi-template" e "Peças" (que já estão corretas).
- Blocos TBD (template pausado, quem configura o quê).
- Placeholder de vídeo P1 no final.

### Fora de escopo

Só documentação. Nada de código, nenhuma outra página do manual.
