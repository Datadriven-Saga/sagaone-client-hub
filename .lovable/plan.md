## Redesenho do modal "Configuração IA" — evento IA Whatsapp

Reorganizar a aba **Configuração IA** de `src/components/CriarProspeccaoModal.tsx` (case `'Configuração IA'`, ~L2977–L3400) para uma UX mais densa, com menos rolagem, mantendo toda a lógica atual (states, validações, filtros de template, cadência completa vs. simples). Nada de mudança de negócio — apenas layout + o modal da descrição.

### 1. Descrição em modal (em vez de expandir inline)
- Substituir o botão Maximize/Minimize por **"Abrir editor"** que abre um `Dialog` (novo componente inline) com um `Textarea` grande (ex. `rows=20`), header com "Descrição da prospecção", botões **Aplicar modelo** e **Salvar**.
- Remover o state `descricaoExpandida` (ou renomeá-lo para `descricaoModalOpen`).
- No card principal mantém `Textarea` compacto (`rows={4}`), somente leitura visual continua editável. O botão "Aplicar modelo" fica no header do card.

### 2. Grid de templates em 3 colunas
- Envolver os 3 selects em um `grid grid-cols-1 md:grid-cols-3 gap-3`:
  - **Template Prospecção** * (sempre visível)
  - **Cadência Agendados** (renomear de "Template Agendado (opcional)")
  - **Cadência Não Responderam** (renomear de "Template Não Responderam")
- Cada select fica em um bloco compacto com label + select + botão limpar (X) inline.
- Erro de "obrigatório" fica embaixo do próprio select (mantém validação atual).
- Quando `cadenciaCompleta === true`: o grid vira `grid-cols-1 md:grid-cols-4` mostrando: Prospecção, Agendado 48h, Agendado 24h, Não Responderam (todos obrigatórios). Helpers "enviado 48h/24h antes" viram um único tooltip no label pra economizar altura.

### 3. Data/hora da cadência junto dos templates
- Mover **Data/Hora da Cadência** (renomear para **Data/Hora Cadência Agendados**) para dentro do mesmo grid de templates, ocupando a 4ª coluna quando cadência simples (grid vira `md:grid-cols-4`: Prospecção, Cadência Agendados, Data/Hora, Cadência Não Responderam) — ou linha abaixo em `grid-cols-2` se ficar apertado (validar visualmente).
- Remover a seção separada "Configurações de Disparo".

### 4. Aviso "Disparo Inicial" alinhado à realidade
- Substituir o card amarelo por uma linha discreta com ícone Info + texto:
  > "O disparo inicial pode ser feito manualmente ou agendado pela tela da base do evento."
- Colocada como legenda pequena logo abaixo do grid de templates.

### 5. Configurações do Evento em 4 colunas
- Transformar a seção "Configurações do Evento" em `grid grid-cols-1 md:grid-cols-3 gap-3` (são 3 controles: Tipo de Lead, Evento Principal, Qualificar Lead após Confirmação — o bloco "Evento de Confirmação" é só um aviso informativo, colocá-lo como banner fino abaixo do grid ocupando a linha inteira; assim ficam 3 colunas para os toggles/select + 1 banner).
- Cada toggle (Evento Principal, Qualificar Lead) vira card compacto com Switch à direita e label + tooltip à esquerda, mesma altura do card do select Tipo de Lead.
- Se o usuário preferir 4 colunas literais, colocar também o banner de "Evento de Confirmação" como 4º card (menor).

### 6. Ajustes gerais
- Reduzir `space-y-4` do container para `space-y-3` e paddings dos cards internos de `p-4` → `p-3`.
- Manter todos os states, validações, `toast` de template duplicado, filtros de `whatsappTemplates` e comportamento de `cadenciaCompleta` intactos.
- Não mexer nas outras abas (`case 'Configuração IA'` apenas para `tipoEvento === 'IA Whatsapp'`).

### Arquivos alterados
- `src/components/CriarProspeccaoModal.tsx` — reescrita da renderização do case IA Whatsapp (~L2977–L3400) + novo sub-`Dialog` da descrição.

### Fora do escopo
- Lógica de disparo/cadência no backend.
- Outros tipos de evento (Padrão, IA Ligação etc.).
- Renomear campos no banco.