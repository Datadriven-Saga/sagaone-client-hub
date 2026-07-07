## Ajustes de UI na Etapa 2 — Editar Evento (IA WhatsApp)

Escopo: apenas layout/apresentação em `src/components/CriarProspeccaoModal.tsx`, sem tocar em lógica de persistência, webhook ou banco.

### 1. Mover "Configurações do Evento" para o topo, ao lado da Descrição

Hoje o bloco `Configurações do Evento` (Tipo de Lead, Evento Principal, Qualificar após Confirmação, Evento de Confirmação) fica na última linha do formulário (linha ~3541 do arquivo), depois da tabela de cadências.

Passar para o topo, formando um grid de 2 colunas com a Descrição:

- Coluna esquerda: bloco atual da Descrição (com os botões "Aplicar modelo" e "Abrir editor").
- Coluna direita: os 4 cartões de configuração, em grid 2x2 compacto (mesma estética atual dos cartões `p-2 rounded-lg border bg-card`), rótulo `Configurações do Evento` acima.

Estrutura no JSX:

```text
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <DescricaoBlock />
  <ConfiguracoesEventoBlock />
</div>
<TemplateProspeccao + TabelaCadencias />
```

Manter, logo abaixo do grid de configurações, os textos auxiliares que já existem hoje ("Tipo de Lead e Evento de Confirmação não podem ser alterados…", "Para criar um evento de confirmação…", "Confirmação vinculada ao evento…").

Remover o bloco duplicado da posição original (linhas ~3541–3618) para não repetir os controles.

### 2. Centralizar o botão "Adicionar cadência"

Hoje o botão `Adicionar cadência` fica alinhado à esquerda logo abaixo da tabela. Envolver em um wrapper `flex justify-center` (mantendo o estilo `variant="outline" size="sm"` atual) para ficar centralizado sob a tabela, como no mockup enviado.

### 3. Não muda

- Modo "Cadência Completa" (`cadCompleta === true`): permanece exatamente como está.
- Persistência (`saveCadencias`, colunas legacy, tabela `prospeccao_cadencias`).
- Payload do webhook.
- Regras de validação de templates e uniqueness por linha.
- Migration/schema: nenhuma mudança neste passo.

### Como aumentar o limite de cadências no futuro (referência, fora deste plano)

Para permitir N cadências:

1. `ALTER TABLE public.prospeccao_cadencias DROP CONSTRAINT prospeccao_cadencias_ordem_check; ALTER TABLE ... ADD CONSTRAINT ... CHECK (ordem BETWEEN 1 AND N);` (ou remover o check).
2. No modal, trocar `cadenciasExtras.length < 2` pelo novo teto (`< N-1`, porque a linha #1 é fixa).

Nenhuma outra alteração de código é necessária — save, hydrate e webhook já são dinâmicos.
