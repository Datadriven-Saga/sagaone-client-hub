## O que vai mudar na prática

Hoje, quando você entra na tela de Prospecção (Kanban), seleciona a loja RAM HOUSE e marca **todos os 44 eventos**, o Kanban aparece zerado — mesmo sabendo que existem milhares de leads. Se você filtrar por um responsável específico, os leads aparecem.

### Por quê isso acontece

O banco calcula o status de cada lead **dentro de cada evento** linha a linha. Com 44 eventos e ~93 mil vínculos, essa conta explode e a query **estoura o timeout** antes de devolver resposta. Filtrar por responsável reduz o volume, então consegue terminar a tempo.

### O que vamos fazer

1. **Otimizar o RPC do banco** (`get_kanban_columns`) para calcular o status **uma vez por lead/evento**, em vez de repetir a mesma conta 10 vezes (uma para cada coluna do Kanban).
2. **Adicionar índice** em `logs_movimentacao_contatos` para achar o "último status" mais rápido.
3. **Aplicar a mesma otimização** no caminho de SDR/Vendedor, mantendo a regra de "só ver leads da minha equipe / atribuídos a mim".

### O que NÃO muda

- Nada na tela: mesmas colunas, filtros, cores, tooltips.
- Nada na regra de acesso: SDR continua vendo só o que deve, Admin continua vendo tudo.
- Nada no status em si: a regra de "status por evento" continua a mesma.

### Resultado esperado

- Selecionar **todos os eventos** da RAM HOUSE vai carregar o Kanban com os números reais.
- O filtro por responsável continua funcionando igual.
- Outras lojas grandes (Toyota, Colorado) param de dar branco quando seleciona múltiplos eventos.
- Nenhuma funcionalidade existente quebra.

### Risco e rollback

A mudança é só na função do banco. Se os números saírem diferentes do esperado, podemos reverter a função anterior em minutos, sem tocar em dados.