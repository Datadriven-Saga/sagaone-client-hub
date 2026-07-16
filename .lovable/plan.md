## Análise da coluna "Status Lead" em `/prospeccao/eventos/:id/base`

### 1. Origem dos dados

**Arquivo:** `src/pages/prospeccao/EventoBase.tsx` (linhas ~910–930)

**Query principal da tabela de leads:**
```
supabase
  .from('contatos')
  .select('id, lead_id, nome, telefone, email, status, origem, ...')
  .eq('status', statusFilter)   // quando filtro != 'todos'
```

- **Tabela:** `public.contatos`
- **Coluna exibida como "Status Lead":** `contatos.status`
- **Filtro do dropdown "Status":** também `contatos.status`, populado pela RPC `get_prospeccao_status_options`

### 2. Qual "status" está sendo considerado

O `contatos.status` é **global do lead**, não do vínculo com o evento. Isso é um débito arquitetural já mapeado na KB (`kanban-e-status.md`, memory core):

> `contatos.status` é global — não é por evento. Um lead em `Check-in` num evento aparece `Check-in` em qualquer outro evento em que estiver vinculado.

O vínculo evento↔lead vive em `eventos_prospeccao (contato_id, prospeccao_id, ...)`, mas essa tabela **não tem uma coluna de status por evento**. Ela guarda a interação/vínculo, não o estado do funil naquele evento específico.

### 3. Divergência real vs esperada

- **Esperado pelo usuário:** a base da tela `/eventos/:id/base` mostrar o status do lead **naquele evento**.
- **Hoje:** mostra o status **global** do contato. Se o lead está `Em Espera` em outro evento, aparece `Em Espera` aqui, mesmo tendo entrado como `Novo` neste evento.
- **Efeito colateral:** o filtro "Status" também filtra por status global, então esconde/mostra leads com base em outro evento — dá a sensação de leads "sumindo" ou "duplicando" entre eventos.

### 4. Próximos passos possíveis (aguardando decisão)

Antes de mexer, preciso confirmar com você qual caminho:

- **(a) Apenas documentar/rotular:** manter como está, mas deixar claro na UI que "Status Lead" é global do contato (rótulo + tooltip).
- **(b) Derivar status por evento a partir de sinais existentes:** usar `logs_movimentacao_contatos` + `eventos_prospeccao` do vínculo daquele `prospeccao_id` para reconstruir o último status registrado **no contexto do evento**. Sem migração de schema.
- **(c) Mudança estrutural:** adicionar `status` em `eventos_prospeccao` e migrar leitura/escrita — é o débito arquitetural mapeado; alto risco, exige plano próprio (Kanban, RPCs de agregação, webhook Mobi, importação, etc.).

Sem alteração de código nesta etapa — só diagnóstico. Me confirma qual direção seguir (a, b ou c) que eu monto o plano de implementação.
