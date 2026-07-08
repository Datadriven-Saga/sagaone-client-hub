## Diagnóstico

Rodei `grep -rn "Para criar\|confirmação, use\|dentro da base" src/` — o texto "Para criar um evento de confirmação, use o botão 'Criar Confirmação'..." **não existe mais no código**. A remoção anterior foi de fato aplicada; o preview do usuário está com bundle antigo em cache. Um hard reload confirma.

Já o segundo pedido (mover o texto "O disparo inicial pode ser feito manualmente..." para tooltip do Template Prospecção) e o "subir/compactar as divs" **não foram feitos** no ramo `!cadCompleta` — só no ramo `cadCompleta` (linhas 3543-3552) já existe tooltip.

## Mudanças

**Arquivo:** `src/components/CriarProspeccaoModal.tsx`

### 1. Mover texto para tooltip do Template Prospecção (ramo `!cadCompleta`, linhas 3306-3334)
- Remover o `<p className="text-xs text-muted-foreground">O disparo inicial pode ser feito manualmente...</p>` (linhas 3331-3333).
- Colapsar o grid `grid-cols-1 md:grid-cols-2` (que só existia para acomodar o parágrafo ao lado) — manter apenas a coluna do Select em largura natural.
- No Label "Template Prospecção *" (linha 3310), adicionar `<Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />` dentro de `TooltipProvider/Tooltip/TooltipTrigger` com o mesmo texto, replicando exatamente o padrão do ramo `cadCompleta` (linhas 3543-3552).

### 2. Compactar bloco Configurações do Evento (linhas 3172-3276)
- Reduzir espaçamento do container etapa 2: `space-y-2 px-4` → `space-y-1.5 px-4`.
- Reduzir gap do grid Descrição+Config: `gap-3` → `gap-2`.
- Dentro de "Configurações do Evento": `mb-2` do `<h4>` → `mb-1.5`; `gap-2` do grid interno → `gap-1.5`; `p-2` dos 4 cartões → `p-1.5`.
- Reduzir `mt-2` dos parágrafos condicionais inferiores (linhas 3269 e 3272) → `mt-1.5`.

### 3. Escopo
- Apenas espaçamento visual + reposicionamento do texto em tooltip.
- Nenhuma mudança de lógica, estado, validação ou de outros ramos do modal.
- Após aplicar, pedir ao usuário para dar **hard reload (Ctrl+Shift+R)** para descartar o bundle em cache que ainda mostra o texto de confirmação já removido.
