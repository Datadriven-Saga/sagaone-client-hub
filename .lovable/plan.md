## Tornar data/hora obrigatória nas cadências extras (linhas 2 e 3)

### Contexto
No modal `CriarProspeccaoModal.tsx`, a tabela de cadências para eventos `IA Whatsapp` permite até 3 cadências:
- Cadência #1: usa campos legacy (`dataEnvioCadencia`); permanece opcional.
- Cadências #2 e #3: vêm do estado `cadenciasExtras` e possuem o campo `data_envio_cadencia`.

O usuário pediu que os campos de data/hora das cadências extras sejam obrigatórios quando essas cadências existem (ou seja, `cadenciasExtras.length > 0`).

### Escopo
Alterações somente no frontend, no arquivo `src/components/CriarProspeccaoModal.tsx`.

### Implementação

1. **Validação no submit (`handleSubmit`)**
   - Após as validações existentes de `IA Whatsapp` e antes de iniciar o `setLoading(true)`, verificar se há cadências extras.
   - Para cada item de `cadenciasExtras`, garantir que `data_envio_cadencia` esteja preenchido.
   - Se algum estiver vazio, exibir `toast` de erro e abortar o submit.

2. **Validação na navegação entre etapas (`handleNextStep`)**
   - Quando o usuário estiver na etapa `Configuração IA` e tentar avançar, se houver cadências extras sem data/hora preenchida, exibir `toast` e impedir a navegação.

3. **Indicador visual com asterisco**
   - Seguir o mesmo padrão do campo `Descrição` (`<span className="text-destructive">*</span>` no `Label`).
   - Adicionar o asterisco no cabeçalho da coluna `Data/Hora` da tabela de cadências (ou em cada input das linhas 2 e 3) para indicar obrigatoriedade quando cadências extras existirem.
   - Não exibir texto "Obrigatório" em vermelho abaixo dos inputs.

### Fora de escopo
- Não alterar a cadência #1 (legacy).
- Não modificar payload, banco, webhooks, RLS ou migrations.
- Não adicionar validação server-side (a regra é de UX do modal; o backend continua aceitando `null` e aplicando o fallback de 24h antes do evento).