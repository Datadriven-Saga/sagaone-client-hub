## Plano — Logs detalhados da solicitação de leads

### Objetivo
Instrumentar o fluxo sem mudar regra de negócio agora, para descobrir por que a Lays'la recebeu só 4 leads mesmo havendo espaço aparente no limite.

### O que será logado no console

1. **Início da solicitação**
   - `user_id`, email e nome do usuário.
   - Se é SDR/Vendedor/acesso limitado.
   - Evento(s) filtrados na tela, quando disponível.

2. **Contagem antes da solicitação**
   - Resultado da RPC `count_vendedor_leads_pendentes`.
   - Contagem detalhada dos leads da usuária por status no evento atual:
     - `Atribuído`
     - `Em Espera`
     - `Convidado`
     - `Confirmado`
     - `Check-in`
     - demais status
   - Quantidade de vagas calculada: `30 - atribuídos`.

3. **Validação dos leads Novos disponíveis**
   - Total de leads `Novo` no evento atual.
   - Quantos são elegíveis para puxar.
   - Quantos foram descartados por motivo, por exemplo:
     - já tem `responsavel_email`
     - já tem `vendedor_responsavel_id`
     - status por evento não é `Novo`
     - evento não está ativo/encerrado
     - usuário não está vinculado/bypass de terceiro não aplicado

4. **Chamada da solicitação**
   - Payload enviado para `auto_atribuir_leads_vendedor`.
   - Resposta bruta da RPC: `data`, `error`, quantidade atribuída.

5. **Estado depois da solicitação**
   - Nova contagem de pendentes.
   - Nova distribuição por status no evento.
   - Diferença esperada vs. realizada:
     - vagas antes
     - novos elegíveis antes
     - quantidade que deveria puxar
     - quantidade que realmente puxou

### Onde implementar

1. **Frontend**
   - Adicionar logs estruturados em `useAutoAtribuirLeads.ts`, usando `console.groupCollapsed`, `console.table` e objetos detalhados.
   - Se possível, incluir o contexto do evento selecionado vindo da tela de Prospecção.

2. **Banco/RPC auxiliar de diagnóstico**
   - Criar uma RPC somente de leitura, por exemplo `debug_auto_atribuicao_leads(user_id_param uuid, prospeccao_id_param uuid)`.
   - Ela não atribui leads; apenas retorna JSON com:
     - contagem por status;
     - limite;
     - vagas livres;
     - leads novos elegíveis;
     - leads bloqueados por motivo;
     - amostra dos primeiros leads elegíveis/bloqueados.

3. **Integração do log**
   - Antes de chamar `auto_atribuir_leads_vendedor`, chamar a RPC de diagnóstico quando houver evento selecionado.
   - Logar o JSON completo no console.
   - Depois chamar a RPC real normalmente.
   - Depois chamar novamente a RPC de diagnóstico para comparar antes/depois.

### Importante

- Não vou alterar ainda a regra de atribuição.
- Não vou mover leads retroativos.
- A mudança será apenas observabilidade para confirmar exatamente onde a seleção está parando.

### Resultado esperado
Depois disso, ao clicar em **Solicitar**, o console deve mostrar claramente:

```text
Solicitação iniciada
Atribuídos atuais: X
Vagas livres: 30 - X
Novos no evento: Y
Elegíveis: Z
Bloqueados por motivo: {...}
RPC retornou: N atribuídos
Se N < min(vagas, elegíveis), mostrar onde a diferença apareceu
```

Com esses dados, conseguimos separar se o problema está em:

- contagem de status;
- status por evento mal alocado;
- filtro de elegibilidade;
- regra de equipe/acesso de terceiros;
- evento ativo/inativo;
- ou na própria `auto_atribuir_leads_vendedor`.