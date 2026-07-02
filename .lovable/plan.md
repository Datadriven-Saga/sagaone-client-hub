# Passo A — Correção UUIDs em `responsavel_email` + Documento de investigação para B/C

## Resumo executivo

- **Categoria UUID (178 contatos, 15 emails únicos, 6 empresas) — causa confirmada.**
- **Ainda está acontecendo:** últimas criações em `2026-06-30`, últimos updates em `2026-07-01`.
- Uma única linha de código no frontend está gravando `user.id` (UUID) no lugar do email do usuário logado.

## Resposta às suas perguntas

### `sync-contatos-ligacao` — o que faz

Fluxo de reconciliação de contatos entre a base local e o **webhook externo da PRI Voz** (`automatemaiawh.sagadatadriven.com.br/webhook/verifica-contatos`).

1. Recebe `telefone_pri`, `id_evento`, `empresa_id`, `prospeccao_id`.
2. Faz GET no webhook externo (com header `saga_one_supabase`) e pega a lista canônica de contatos do evento **na visão da PRI Voz**.
3. Compara com `eventos_prospeccao` local:
   - Contato no webhook e não local → cria/reaproveita `contatos` e cria vínculo em `eventos_prospeccao`. Marca `data_disparo_ia` se a PRI já ligou/enviou WhatsApp.
   - Contato local e não no webhook → **deleta o vínculo** (não o contato).
4. Persiste snapshot em `prospect_pri_voz` (backup por telefone/id_evento).

**Onde entra em `responsavel_email`:** só no ramo "criar novo contato" (linha 243), copia `webhookContato.responsavel_email` cru para o INSERT. É a segunda porta de entrada para valores inválidos vindos do webhook externo — precisa de validação, mas **não é a causa dos 178 UUIDs**.

### `dispatch-leads-webhook` pode preencher `responsavel_email`?

**Não.** `rg "responsavel" supabase/functions/dispatch-leads-webhook/index.ts` retorna zero. Essa Edge Function chama a Lambda de disparo WhatsApp com o payload dos leads; nunca escreve em `contatos.responsavel_email`. Pode ser descartado da investigação.

## Causa confirmada dos 178 UUIDs

Arquivo: `src/hooks/useContatoData.ts:1211-1223`

```ts
const atribuirResponsavel = async (contatoId: string, userId: string) => {
  await supabase.from('contatos').update({ responsavel_email: userId })...
};
```

A função aceita "userId" e grava direto na coluna `responsavel_email`. O nome do parâmetro sugere UUID, mas a coluna é email.

Callers em `src/pages/Prospeccao.tsx`:

| Linha | Argumento passado | Resultado |
|---|---|---|
| 1283 | `user.email` | ok |
| **1459** | **`user.id`** | **grava UUID** |
| 1535 | `user.email` | ok |
| 2330 | `user.email` | ok |
| 2435 | `userId` (do dropdown de responsável no ContatoModal) | pode ser email, celular ou UUID dependendo do que a UI seleciona |
| 2556 | `user.email!` | ok |

**Linha 1459** é a origem clara. **Linha 2435** é secundária: o `ContatoModal` (`src/components/ContatoModal.tsx:370-381`) resolve o responsável comparando `id`, `celular` e email — se o dropdown devolver `profile.id`, cai no mesmo bug.

## Passo A — Correção cirúrgica (o que vou fazer agora)

### A1. Renomear e enrijecer `atribuirResponsavel`

`src/hooks/useContatoData.ts`:

```ts
const atribuirResponsavel = async (contatoId: string, identifier: string) => {
  // Aceita email OU UUID de profile; sempre resolve para email do profile.
  let email: string | null = null;
  if (identifier.includes('@')) {
    email = identifier.toLowerCase();
  } else {
    const { data } = await supabase.rpc('get_email_by_profile_id', { p_id: identifier });
    email = data ?? null;
  }
  if (!email) {
    console.error('atribuirResponsavel: identificador não resolvível', identifier);
    toast({ variant: 'destructive', title: 'Não foi possível atribuir responsável' });
    return;
  }
  await supabase.from('contatos').update({ responsavel_email: email }).eq('id', contatoId);
  setContatos(prev => prev.map(c => c.id === contatoId ? { ...c, responsavel_email: email } : c));
};
```

### A2. Nova RPC `get_email_by_profile_id`

```sql
CREATE OR REPLACE FUNCTION public.get_email_by_profile_id(p_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(u.email) FROM auth.users u WHERE u.id = p_id LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_email_by_profile_id(uuid) TO authenticated;
```

### A3. Corrigir `Prospeccao.tsx:1459`

Trocar `user.id` por `user.email` (paridade com os outros callers). A resolução na RPC continua sendo defesa em profundidade.

### A4. Backfill dos 178 UUIDs existentes

Como todos os 15 UUIDs distintos batem com `auth.users.id`, é seguro reescrever:

```sql
UPDATE contatos c
SET responsavel_email = lower(u.email)
FROM auth.users u
WHERE c.responsavel_email ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND u.id::text = c.responsavel_email;
```

Executar via `supabase--insert` **com sua aprovação explícita** antes de rodar. Contadores esperados: 178 linhas afetadas, 0 restantes na categoria uuid.

### A5. Fora de escopo do Passo A

- Não mexer em `bulk_upsert_contatos`.
- Não mexer em `sync-contatos-ligacao`.
- Não corrigir typos, IDs numéricos, `com_espaco`, `email_sem_user`, `sem_arroba` — vão para o documento B/C.

### A6. Teste manual necessário

- Atribuir lead a mim mesmo pelo botão da coluna "Novo" (path da linha 1459). Verificar em `contatos.responsavel_email` que gravou email.
- Atribuir via `ContatoModal` (dropdown de responsável). Idem.
- Confirmar que o Kanban continua mostrando o nome corretamente (a lógica em `Prospeccao.tsx:3290+` que faz fallback por `id`/`celular` continua funcionando).

## Passo B/C — Documento de investigação (entrega junto)

Vou criar `docs/investigacao/responsavel-email-invalido.md` com:

### Seção 1 — Panorama

Tabela de totais por categoria (com 178 UUID zerados após Passo A) + tabela por empresa + timeline mensal:

```
uuid                mar/26   6    (última criação 25/mar)
uuid                abr/26  47
uuid                mai/26  61
uuid                jun/26  64   (última criação 30/jun — AINDA ATIVO)
apenas_numero       mar/26 593
apenas_numero       abr/26 169
apenas_numero       jun/26 152   (última criação 12/jun)
typo_dominio        jun/26 137   (última criação 26/jun — AINDA ATIVO)
com_espaco          jul/26   8   (última criação 01/jul — AINDA ATIVO)
email_sem_user      jul/26   6   (última criação 01/jul — AINDA ATIVO)
sem_arroba          jun/26  42
```

### Seção 2 — Hipóteses por categoria com ação de investigação

**`apenas_numero` (920 contatos, IDs 7-8 dígitos):**
- Hipótese: PK de vendedor no MySaga. Origens `WhatsApp` (330) descartam planilha para essas.
- Investigação: cruzar IDs `1858746`, `19044776`, etc. com API/tabela do MySaga se disponível. Auditar Edge Functions ativas em jun/26 nas empresas JEEP T9, CITROEN UDI, RAM BR, SN GO T7. Grep por `vendedor_id`, `id_mysaga` sendo mapeado para `responsavel_email` em ingest / imports customizados.
- Ainda ativo? Última criação 12/jun/26 — **provavelmente parou**, mas confirmar com últimos 30 dias.

**`typo_dominio` (236 contatos, 2 emails):**
- `diassis.junqueira@gurposaga.com.br` (TOYOTA ANA) e `marciel.reis@gruposaga.com.brs` (TOYOTA ASA NORTE).
- Hipótese: planilha (origem = 'Outros'). Última criação 26/jun/26 — **ativo, mesma pessoa reimportando errado**.
- Investigação: `import_logs WHERE empresa_id IN (...) AND created_at BETWEEN ...` para localizar arquivos. Alertar operador.

**`sem_arroba` (215 contatos):**
- Ex.: `leticia maria vieira`, `não`. Célula de nome caindo na coluna de email.
- Investigação: `import_logs` das empresas TOYOTA GYN, BURITI, SN GO T7. Última criação 01/jun — **provavelmente parou**.

**`com_espaco` (60 contatos):** `valdiria.dsantos@gruposaga.com.br dos santos`.
- Planilha. Última criação 01/jul — **ativo**.

**`email_sem_user` (91 contatos):**
- `lucas.ssantana@gruposaga.com.br` (61) — verificar se foi usuário removido de `auth.users`.
- `moroni-teste.9da56e22@one.sagadatadriven.com.br` (30) — email de teste, provavelmente conta descartada.
- Investigação: histórico em `auth.users`, `logs_prospeccoes`.

### Seção 3 — Callers suspeitos a auditar

- `sync-contatos-ligacao` (webhook externo, linha 243) — precisa de whitelist.
- `create-lead` (Edge Function pública, linha 261) — aceita qualquer string.
- `process-import` (linha 743) — planilha, precisa da validação server-side proposta anteriormente.
- `NovoLeadModal.tsx:398` — sempre grava `user.email`, ok.
- `Prospeccao.tsx:2047` — vem da leitura de planilha em memória, mesmo problema do process-import.
- `dispatch-leads-webhook` — **descartado**, não escreve.

### Seção 4 — Próximas decisões (dependem do resultado B/C)

Uma das três opções, a definir depois de mapear callers:

- **(B)** Validação server-side em cada Edge Function que aceita `responsavel_email` (mais cirúrgico, mais linhas alteradas).
- **(C)** Trigger `BEFORE INSERT/UPDATE OF responsavel_email ON contatos` que normaliza/zera valores inválidos (menos cirúrgico, cobre todos os callers de uma vez, inclusive futuros).
- Combinação: (C) com log em tabela `contatos_responsavel_email_rejeitados` para observabilidade + (B) só no `bulk_upsert_contatos` porque a KB exige testes específicos ali.

## O que NÃO alterar neste Passo A

- `bulk_upsert_contatos` (aguarda B/C).
- `sync-contatos-ligacao` (aguarda B/C).
- `create-lead` / `create-lead-pri` / `search-lead` (aguarda B/C).
- `process-import` (aguarda B/C).
- Nenhuma trigger em `contatos` (aguarda B/C).

## Ordem de execução do Passo A

1. Criar RPC `get_email_by_profile_id`.
2. Ajustar `useContatoData.ts::atribuirResponsavel`.
3. Corrigir `Prospeccao.tsx:1459` (`user.id` → `user.email`).
4. Publicar doc `docs/investigacao/responsavel-email-invalido.md`.
5. Rodar backfill SQL dos 178 UUIDs — **só após sua aprovação explícita do UPDATE**.

Nada além disso.
