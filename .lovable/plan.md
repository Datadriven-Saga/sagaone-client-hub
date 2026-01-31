
# Plano: Corrigir Dropdown de Eventos WhatsApp

## Problema Identificado

O dropdown de eventos no Dashboard WhatsApp está chamando um webhook externo (`verifica-todos-eventos-pri`) que **não existe para a PRI de WhatsApp**, resultando em dados inválidos ("Evento undefined / ID:0"). 

A lógica correta é usar os dados já existentes no banco de dados Supabase (tabela `prospeccoes`), filtrando eventos WhatsApp das lojas às quais o usuário tem acesso que compartilham o mesmo telefone PRI do agente configurado.

---

## Fluxo Atual vs. Proposto

```text
ATUAL (errado):
┌─────────────────────┐
│ Identifica agente   │
│ Pri WhatsApp        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Chama webhook       │
│ verifica-todos-     │
│ eventos-pri         │  ← Não existe para WhatsApp
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Retorna dados       │
│ inválidos/vazios    │
└─────────────────────┘

PROPOSTO (correto):
┌─────────────────────┐
│ Identifica agente   │
│ Pri WhatsApp +      │
│ telefone_pri        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Busca user_empresas │
│ (todas as lojas     │
│  do usuário)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Query prospeccoes:  │
│ • canal='Whatsapp'  │
│ • event_id_pri set  │
│ • empresa_id in     │
│   [lojas usuário]   │
│ • JOIN agentes_ia   │
│   por telefone      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Multi-select de     │
│ eventos com nome    │
│ e id_evento (PRI)   │
└─────────────────────┘
```

---

## Mudanças Técnicas

### 1. Refatorar `DashboardWhatsAppTab.tsx` - Fetch de Eventos

**Antes:**
```typescript
// Chama webhook externo (NÃO EXISTE para WhatsApp)
const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
  body: { 
    endpoint: 'verifica-todos-eventos-pri', 
    telefone_pri: cleanPhone
  },
});
```

**Depois:**
```typescript
// 1. Buscar IDs das empresas do usuário
const { data: userEmpresas } = await supabase
  .from('user_empresas')
  .select('empresa_id')
  .eq('user_id', userId);

const empresaIds = userEmpresas?.map(ue => ue.empresa_id) || [];

// 2. Buscar prospeccoes WhatsApp dessas empresas
//    que usam o mesmo telefone PRI do agente
const { data: prospeccoes } = await supabase
  .from('prospeccoes')
  .select(`
    id, 
    titulo, 
    event_id_pri, 
    data_inicio, 
    data_fim,
    empresa_id,
    empresas!inner(nome_empresa)
  `)
  .eq('canal', 'Whatsapp')
  .not('event_id_pri', 'is', null)
  .in('empresa_id', empresaIds);

// 3. Filtrar apenas eventos que pertencem a empresas
//    com o mesmo agente WhatsApp (telefone_pri)
const eventosDoAgente = await filtrarPorTelefonePri(prospeccoes, agent.telefone);
```

### 2. Lógica de Filtro por Telefone do Agente

Para garantir que mostramos apenas eventos do mesmo agente PRI WhatsApp:

1. Buscar `agente_empresas` para cada `empresa_id` retornado
2. Verificar se o agente vinculado tem o mesmo `telefone` que o agente atual
3. Incluir apenas os eventos dessas empresas

```typescript
// Buscar agentes de todas as empresas do usuário
const { data: agentesEmpresas } = await supabase
  .from('agente_empresas')
  .select('empresa_id, agentes_ia!inner(telefone, nome, ativo)')
  .in('empresa_id', empresaIds);

// Filtrar empresas que têm o mesmo agente WhatsApp (por telefone)
const empresasComMesmoAgente = agentesEmpresas
  ?.filter(ae => {
    const nome = (ae.agentes_ia?.nome || '').toLowerCase();
    const isWhatsApp = nome.includes('whatsapp') || nome.includes('wpp') || nome.includes('zap');
    const telefonesIguais = ae.agentes_ia?.telefone === agent.telefone;
    return isWhatsApp && telefonesIguais && ae.agentes_ia?.ativo;
  })
  .map(ae => ae.empresa_id);

// Filtrar prospeccoes apenas dessas empresas
const eventosFinais = prospeccoes?.filter(p => 
  empresasComMesmoAgente?.includes(p.empresa_id)
);
```

### 3. Estrutura dos Dados no Dropdown

A interface `EventOption` será atualizada para incluir informações úteis:

```typescript
interface EventOption {
  id_evento: number;        // event_id_pri numérico
  nome: string;             // titulo da prospeccao
  empresa_nome?: string;    // nome da empresa (para multi-loja)
  prospeccao_id: string;    // UUID interno
}
```

### 4. UI do Dropdown com Contexto de Loja

O dropdown mostrará o nome da loja para ajudar o usuário a identificar eventos de outras lojas:

```tsx
<div className="flex-1 min-w-0">
  <p className="text-sm font-medium truncate">{event.nome}</p>
  <p className="text-xs text-muted-foreground">
    {event.empresa_nome} • ID: {event.id_evento}
  </p>
</div>
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/resultados/DashboardWhatsAppTab.tsx` | Refatorar `fetchEvents` para consultar `prospeccoes` + `agente_empresas` localmente |
| `src/components/resultados/EventoSelectorWhatsApp.tsx` | (Opcional) Alinhar com nova lógica se necessário |

---

## Fluxo Completo Após Implementação

1. **Usuário acessa** `/prospeccao/performance` → aba WhatsApp
2. **Sistema identifica** o agente "Pri WhatsApp" configurado para a loja ativa
3. **Sistema busca** todas as empresas do usuário (`user_empresas`)
4. **Sistema filtra** quais dessas empresas têm o mesmo agente WhatsApp (mesmo telefone)
5. **Sistema consulta** `prospeccoes` com `canal='Whatsapp'` e `event_id_pri` válido dessas empresas
6. **Dropdown exibe** lista de eventos com nome e loja de origem
7. **Usuário seleciona** um ou mais eventos (multi-select)
8. **Sistema busca métricas** via `dashboard-evento-pri-whats` para cada `event_id_pri` selecionado

---

## Validações de Segurança

- RLS de `prospeccoes` restringe ao `empresa_id` ativo, mas podemos consultar `user_empresas` sem restrição (política permite visualizar próprias associações)
- Não há risco de vazamento pois só mostramos eventos de empresas onde o usuário tem vínculo E o agente é o mesmo
