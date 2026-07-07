Ajustar o layout do modal de Configuração IA em `src/components/CriarProspeccaoModal.tsx` para eliminar o espaço vazio e reposicionar o aviso informativo.

## O que será feito

### 1. Mover o aviso informativo para o lado do dropdown
- Remover o bloco de aviso atual no rodapé da etapa Configuração IA (linhas ~3612-3616):
  - Texto: "O disparo inicial pode ser feito manualmente ou agendado na tela da base do evento. Aqui você configura apenas as cadências automáticas."
- Adicionar o mesmo texto como tooltip do ícone `Info` ao lado do label "Template Prospecção", no bloco de `!cadCompleta` (linhas ~3280-3303) e no bloco `cadCompleta` (linhas ~3509-3526).
- Isso libera a linha do rodapé e deixa a informação contextual junto ao campo principal.

### 2. Reduzir o padding da modal (eliminar os espaços vazios)
Ajustar os espaçamentos internos do `DialogContent` principal (linhas ~4644-4724):
- Header: `px-6 py-3` → `px-4 py-2`
- Conteúdo (ScrollIndicator): `px-6 py-4` → `px-4 py-2`
- Footer: `px-6 py-4` → `px-4 py-3`

Isso fará o conteúdo ocupar melhor a altura da modal, reduzindo o espaço vazio nas bordas (os "quadrados vermelhos" indicados).

## Fora de escopo
- Não alterar a tabela de cadências, lógica de persistência, payload ou banco de dados.
- Não alterar outros passos do modal (Dados Gerais, Convite, etc.).
- Não alterar o `DialogContent` global do shadcn; ajuste somente nas classes passadas na instância do modal.