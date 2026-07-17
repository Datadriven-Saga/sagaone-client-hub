## Plano

1. **Corrigir a condição que decide se o campo fica editável**
   - Hoje o modal só consulta `contatoData?.nome` para decidir se mostra input.
   - Se `contatoData` ainda não carregou, ou se o nome exibido vem do card (`item.title`) enquanto o dado real ainda está ausente, a tela cai no modo texto fixo.
   - Vou criar uma variável única, por exemplo `nomeAtualDoLead`, usando `contatoData?.nome || item?.title || ''`.
   - A regra continuará estrita: só será editável quando o nome normalizado for exatamente `Lead sem nome`.

2. **Aplicar essa variável no render**
   - Trocar `isNomePlaceholder(contatoData?.nome)` por `nomeEhLeadSemNome`.
   - No modo texto, exibir `nomeAtualDoLead`, evitando depender de `contatoData.nome` quando ainda estiver nulo.

3. **Ajustar o preenchimento inicial do input**
   - Quando o contato carregado tiver nome `Lead sem nome`, o input inicia vazio.
   - Quando tiver nome real, continua sem input e sem edição.

4. **Manter escopo mínimo**
   - Não tornar o campo sempre editável.
   - Não aceitar outros placeholders como `Cliente Saga`, `SEM NOME`, `N/D`, etc.
   - Não alterar banco, importação, Kanban, card ou outras abas.

5. **Validar o comportamento esperado**
   - Lead com `Lead sem nome` abre input + botão Salvar.
   - Após salvar, o modal troca para texto fixo com o nome real.
   - Lead com qualquer outro nome continua apenas leitura.