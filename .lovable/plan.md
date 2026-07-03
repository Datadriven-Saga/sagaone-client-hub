# Plano: Corrigir seção "canal reverso" na doc MobiGestor

## Correção conceitual

Não existe canal síncrono MobiGestor → SagaOne. O que a doc chamou de "loop reverso" está errado.

O comportamento real:

- A **Pri IA (bot de disparo WhatsApp)** movimenta os leads **em paralelo nos dois sistemas**: aqui no SagaOne (Kanban) e no MobiGestor. Ex.: cliente responde → move para *Atribuído*; cliente agenda → move para *Convidado*; e assim por diante — a IA faz isso em ambos os lados.
- Quando a IA escreve no SagaOne, o log em `logs_movimentacao_contatos` sai com `usuario_id = PRI_IA_USER_ID`.
- O gate #2 do trigger PG (`skip pri_ia`) existe justamente para **não reenviar ao Mobi**, já que a própria IA já cuidou disso em paralelo. Não é anti-loop de callback — é anti-duplicação.

`atendimento-status-webhook` é assunto separado: notifica o **agente Pri** no n8n quando um lead em campanha WPP muda de status pela ação humana no SagaOne (payload com `telefone_pri`/`dealer_id` do agente). Não recebe nada do Mobi.

## Arquivos a atualizar

### 1. `docs/arquitetura/sincronizacao-mobigestor.md`

- Reescrever o parágrafo "O canal reverso …" na seção **O que é** para dizer: não há canal reverso — o gate `PRI_IA_USER_ID` existe porque a Pri IA já movimenta o lead em paralelo no Mobi.
- Substituir a seção **Loop reverso (entrada)** por **Movimentações da Pri IA em paralelo** explicando o comportamento acima: a IA sincroniza os dois sistemas por conta própria; o log sai com `usuario_id = PRI_IA_USER_ID` e o gate #2 skipa o envio para evitar duplicidade.
- Ajustar o diagrama end-to-end: remover a caixa "MobiGestor → atendimento-status-webhook" e substituir por:

```text
Pri IA (bot WPP) move lead
   ├── SagaOne: INSERT log (usuario_id = PRI_IA_USER_ID) → gate #2 skipa
   └── Mobi: atualiza direto (mesma ação, em paralelo)
```

- Ajustar linha do runbook "Loop de eventos …" para "Duplicação em movimentações da Pri IA — confirmar que o log veio com `usuario_id = PRI_IA_USER_ID`".
- Na seção **Código & tabelas**: remover a linha "Edge reversa: atendimento-status-webhook" (não é reversa).

### 2. `docs/apis/webhooks-recebidos.md`

- Reescrever a seção `atendimento-status-webhook`:
  - Deixar claro que **não** é webhook recebido do Mobi — é edge de **saída**, chamada pelo FE (`useContatoData.ts`) quando um lead em campanha WPP muda de status, para notificar o fluxo do agente Pri no n8n.
  - Melhor: mover para uma nota "Edges relacionadas (saída)" no fim do arquivo, já que a página é de recebidos.
- Remover o bullet "Contrato reverso" apontando erroneamente para a doc de sincronização.

### 3. `docs/arquitetura/webhooks-e-integracoes.md`

- Remover `atendimento-status-webhook | MobiGestor` da tabela **Webhooks recebidos**.
- Adicionar linha equivalente em **Webhooks enviados**: `atendimento-status-webhook (Edge) | n8n agente Pri | Notificação de mudança de status em campanha WPP`.

## Fora de escopo

- Documentar em profundidade o fluxo da Pri IA no n8n.
- Alterar código.

Se ok, sigo em build.
