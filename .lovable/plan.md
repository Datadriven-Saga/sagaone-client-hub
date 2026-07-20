# Plano definitivo: restaurar status dos leads com responsável afetados pelo reset

## Objetivo
Corrigir os leads que foram indevidamente jogados para **Novo** pelo reset de herança, sem mexer nos leads que estão sem responsável.

Regra final definida:

```text
Se o lead tem responsável atual e o reset mudou ele para Novo,
voltamos esse lead para o status anterior correto.

Se o lead está sem responsável,
não mexemos agora.
```

## O que aconteceu
Foi executado um reset em massa em:

```text
2026-07-20 17:50:47 UTC
observacoes = 'Reset de herança — lead sem histórico neste evento'
status_novo = 'Novo'
usuario_id = NULL
```

Esse reset atingiu:

```text
75.174 leads
70 eventos
```

Mas nem todos devem ser corrigidos agora, porque muitos estão sem responsável.

## Escopo da correção
Aplicar correção somente em leads que atendem aos 4 critérios:

```text
1. O log é do reset indevido de 2026-07-20 17:50:47.
2. status_novo = 'Novo'.
3. status_anterior existe e é diferente de 'Novo'.
4. contato.responsavel_email está preenchido hoje.
```

Resultado do dry-run global:

```text
20.773 leads serão corrigidos
43 eventos serão afetados
```

Distribuição por status que será restaurado:

```text
Atribuído: 16.428
Em Espera: 3.028
Convidado: 817
Descartado: 419
Confirmado: 48
Opt Out: 23
Check-in: 9
Venda: 1
```

## Eventos já confirmados no problema
Entre os eventos afetados aparecem os casos citados:

- Toyota Nápoles / T7
- Toyota Anápolis
- Toyota Asa Norte
- Toyota Colorado
- RAM / JEEP Exclusive Day
- Outros eventos afetados pelo mesmo reset

A correção será global para o mesmo incidente, mas limitada à regra acima.

## Como corrigir sem quebrar produção

### Estratégia segura
Não vamos atualizar `contatos.status` diretamente.

Vamos remover somente o log artificial do reset para os leads-alvo. Como o status por evento é derivado da última movimentação em `logs_movimentacao_contatos`, ao remover o log indevido o sistema volta a enxergar o status anterior real daquele evento.

Exemplo:

```text
Antes:
Atribuído -> Em Espera -> Novo   [reset indevido]

Depois:
Atribuído -> Em Espera

Resultado na tela:
Em Espera
```

## O que será alterado
Somente registros em:

```text
logs_movimentacao_contatos
```

A alteração será:

```text
DELETE dos logs de reset indevidos
apenas para leads com responsável atual preenchido
e status_anterior diferente de Novo
```

## O que NÃO será alterado

```text
contatos.status global
contatos.responsavel_email
contatos.vendedor_nome
bulk_upsert_contatos
get_contato_status_por_evento
Kanban/UI
RLS
webhooks
importação
cadência/templates
```

## Responsáveis
Não vamos tentar reconstruir responsável.

Como sua regra agora é que eles **já estão com responsável**, vamos preservar o responsável atual e corrigir apenas o status.

Quem estiver sem responsável fica sem alteração.

## Risco

### Baixo para produção
Porque:

- Não altera estrutura do banco.
- Não mexe em função crítica.
- Não atualiza `contatos` em massa.
- Não muda código do site.
- Não toca no importador.
- Não executa reset global novo.

### Principal risco
Se algum lead com responsável atual realmente deveria estar Novo, ele voltará para o status anterior do reset.

Mitigação: isso só acontece se ele foi incluído exatamente no reset indevido das 17:50:47. Ou seja, estamos desfazendo uma ação artificial e identificável.

## Custo e complexidade

```text
Complexidade técnica: baixa/média
Risco operacional: baixo
Tempo de execução: curto
Impacto no site: não deve parar o site
```

O cuidado maior é fazer em lotes e guardar backup dos IDs removidos.

## Execução proposta

### Passo 1 — Backup
Gerar CSV com todos os logs que serão removidos:

```text
log_id
contato_id
prospeccao_id
status_anterior
status_novo
responsavel_email
created_at
observacoes
```

### Passo 2 — Amostra de validação
Antes de deletar tudo, validar alguns exemplos dos eventos principais:

- T7
- Anápolis
- Asa Norte
- Colorado
- Nápoles

Para cada lead amostrado:

```text
status atual exibido: Novo
responsável atual: preenchido
status que voltará: status_anterior do reset
```

### Passo 3 — Correção em lote
Remover os logs de reset indevidos para os 20.773 leads-alvo.

### Passo 4 — Validação pós-correção
Recontar os mesmos eventos e confirmar:

```text
- os leads com responsável voltaram para Atribuído / Em Espera / Convidado / etc.
- os leads sem responsável permaneceram como estavam
- Novo reduziu apenas onde era reset indevido
- responsáveis não foram alterados
```

### Passo 5 — Prevenção
Depois da correção, localizar e neutralizar o caminho que executou esse reset com a observação antiga:

```text
'Reset de herança — lead sem histórico neste evento'
```

A função atual `reset_leads_evento_sem_log` grava outra observação, então esse reset parece ter vindo de SQL/script anterior ou execução manual. Precisamos impedir que isso rode de novo.

## Critério de sucesso

```text
20.773 leads com responsável atual voltam ao status anterior ao reset.
0 leads sem responsável são alterados.
0 alteração em responsável.
0 alteração em contatos.status global.
0 alteração no código do site.
```

## Próximo passo
Se aprovado, eu executo primeiro o backup + amostra de validação, mostro os números finais e então aplico a correção cirúrgica.