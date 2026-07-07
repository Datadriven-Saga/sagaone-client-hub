Ajustes visuais na Etapa 2 (Configuração IA) do modal "Novo Evento".

## 1. Remover o "X" de fechar do topo-direito (apenas neste modal)

O botão X vem de `DialogContent` em `src/components/ui/dialog.tsx` (linha ~52) e é global — não vou alterar o dialog base para não afetar todos os modais do sistema.

Em `src/components/CriarProspeccaoModal.tsx`, adicionar CSS para esconder somente o botão de close deste modal:
- Passar uma classe extra ao `DialogContent` (ex.: `[&>button.absolute]:hidden`) que oculta o `<button>` de close renderizado pelo Radix logo dentro do `DialogContent`.

## 2. Calendário invisível no modo claro

Nos `<Input type="datetime-local">` das cadências (linhas ~3385 e ~3457), remover `style={{ colorScheme: 'dark' }}`. O ícone do calendário passa a herdar o color-scheme do tema (claro/escuro), ficando visível em ambos.

## 3. Remover linhas da tabela de cadências e reduzir altura dos dropdowns

Na tabela de "Cadências (até 3)" (linhas ~3322–3500):
- Trocar wrapper `<div className="rounded-md border overflow-x-auto">` por `<div className="overflow-x-auto">`.
- Adicionar `className="border-0 hover:bg-transparent"` a cada `<TableRow>` (header e body) para eliminar as divisórias.
- Reduzir padding vertical das células: `<TableHead>` recebe `h-8 py-1`; `<TableCell>` recebe `py-1`.
- Reduzir altura dos controles: `SelectTrigger` e `Input datetime-local` ganham `h-8 text-sm`.

## 4. Mover texto do tooltip para o espaço em branco

Hoje o bloco "Template Prospecção" ocupa `max-w-md` sozinho, deixando o quadrado à direita vazio (marcado em vermelho na screenshot anterior).

Reestruturar em grid de 2 colunas:
```
[ Label + Select Template Prospecção ]   [ Texto informativo ]
```
- Remover o `<TooltipProvider>` ao lado do label "Template Prospecção".
- À direita, renderizar `<p className="text-xs text-muted-foreground self-center">` com o conteúdo antes escondido no tooltip: *"O disparo inicial pode ser feito manualmente ou agendado na tela da base do evento. Aqui você configura apenas as cadências automáticas."*
- Manter o `*` obrigatório e a mensagem "Obrigatório" abaixo do select.

## Fora de escopo
- Modo cadência completa (`cadCompleta`).
- Outros modais / dialog base (`ui/dialog.tsx`).
- Botões "X" de limpar seleção dos selects (foram mantidos, não é o X que o usuário quer remover).
- Lógica de negócio, payloads, banco.
