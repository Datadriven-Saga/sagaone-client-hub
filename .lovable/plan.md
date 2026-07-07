## Remover texto de confirmação e ajustar espaçamento na Configuração IA

### Contexto
Na etapa "Configuração IA" do modal `CriarProspeccaoModal.tsx`, abaixo da div "Configurações do Evento" existe um texto explicativo (print do usuário, caixa vermelha):
> "Para criar um evento de confirmação, use o botão 'Criar Confirmação' dentro da base de um evento existente."

O usuário quer remover esse texto e, com isso, "subir as duas divs" (Descrição e Configurações do Evento) para aproveitar melhor o espaço vertical do modal.

### Escopo
Alterações somente no frontend, no arquivo `src/components/CriarProspeccaoModal.tsx`.

### Implementação

1. **Remover o texto explicativo**
   - Remover o bloco condicional:
     ```tsx
     {!editingProspeccao && !isConfirmacaoFlow && (
       <p className="text-xs text-muted-foreground mt-2">Para criar um evento de confirmação...</p>
     )}
     ```
   - Manter os outros textos da div (edição e confirmação vinculada), pois não estão no print e não foram solicitados para remoção.

2. **Ajustar o espaçamento vertical para elevar o conteúdo**
   - Reduzir o `space-y` do container da etapa `Configuração IA` para deixar o conteúdo mais compacto após a remoção do texto.
   - Ou reduzir o padding/margin inferior da div "Configurações do Evento" para aproximá-la da seção "Template Prospecção" abaixo.

### Resultado esperado
- O texto destacado em vermelho desaparece.
- A div "Descrição" e a div "Configurações do Evento" ocupam menos altura, e a seção "Template Prospecção" sobe, ocupando o espaço liberado.

### Fora de escopo
- Não alterar a lógica de criação de confirmação, payload, banco ou validações.
- Não modificar o texto dos outros estados (`editingProspeccao` / `isConfirmacaoFlow`).