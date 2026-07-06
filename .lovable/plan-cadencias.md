## Plano salvo — Cadências na criação de prospecção

### Objetivo

Substituir a tela antiga de "cadência completa" por uma tabela de até 3 cadências dentro da etapa "Configuração IA" do modal de criação de prospecção.

### Regras

- Deve valer apenas para `tipoEvento === 'IA Whatsapp'`.
- A antiga tela/branch de cadência completa deixa de existir.
- Deve ser possível adicionar até 3 cadências.
- A primeira cadência reaproveita os campos atuais.
- Cadências adicionais entram como linhas extras.
- O payload atual permanece igual.
- Deve ser adicionado ao payload um item extra com uma lista dessas cadências.

### UI

- Header "Novo Evento" quase encostado no topo da div.
- Conteúdo interno deve preencher a div.
- Descrição e Configurações do Evento ficam lado a lado.
- Cadências viram uma tabela/grade abaixo.
- Botão `+` adiciona novas linhas até o máximo de 3.
- Linhas extras podem ser removidas.

### Payload

Adicionar campo novo:

```ts
payload.cadencias = [
  {
    ordem: 1,
    template_id,
    template_nome,
    template_id_pri,
    template_id_meta,
    template_agendado_id,
    template_agendado_nome,
    template_agendado_id_pri,
    template_agendado_id_meta,
    data_envio_cadencia,
    template_nao_agendado_id,
    template_nao_agendado_nome,
    template_nao_agendado_id_pri,
    template_nao_agendado_id_meta,
  }
]
```

### Fora de escopo

- Não alterar banco agora.
- Não mexer em IA Ligação.
- Não alterar dispatcher/webhooks além do payload da criação/edição de evento.