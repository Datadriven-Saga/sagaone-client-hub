## Objetivo
Adicionar um botão de ação ao lado do botão de telefone existente no `KanbanCard` para abrir o WhatsApp do lead via `https://wa.me/55{telefone}`.

## Arquivos envolvidos
- `src/components/KanbanCard.tsx`

## Mudanças
1. **Importar ícone**: adicionar um ícone de chat ao `lucide-react` (ex.: `MessageCircle`) ou reutilizar o padrão de WhatsApp já existente no projeto, se houver.
2. **Criar helper local**: implementar `formatPhoneForWhatsApp(channel)` baseado no telefone normalizado (`normalizePhoneForComparison`) com prefixo `55`, fallback para dígitos crus.
3. **Adicionar botão**: inserir botão ao lado do botão de ligação atual, dentro do mesmo container do telefone.
   - `aria-label="Abrir WhatsApp"`
   - `onClick` com `e.stopPropagation()`
   - `window.open(`https://wa.me/${phone}`, '_blank')`
   - Estilo visual verde (WhatsApp) para distinguir do botão de ligação azul.
4. **Tooltip opcional**: envolver o novo botão em `Tooltip` para exibir "Abrir WhatsApp".

## Diagrama do ajuste visual
```text
[Telefone]  [Ligar]  [WhatsApp]
```

## Fora do escopo
- Não alterar lógica de clique no card, drag, ou modal de confirmação de ligação.
- Não adicionar mensagem padrão no `wa.me` (a menos que seja solicitado).
- Não modificar `item.channel` ou a estrutura do `KanbanItem`.

## Critério de aceitação
- Botão verde aparece ao lado do botão de ligação em cards com telefone.
- Ao clicar, abre `https://wa.me/55{telefone}` em nova aba/janela.
- Clique no botão não dispara o clique do card nem interfere no drag.
