

## Plan: Create "Pri IA" System User

### Summary
Create a real profile for "Pri IA" to attribute automated actions. Use a generated UUID (not a fixed one), store the email as a constant in code, skip the `prospeccao-anotacao` changes, and skip the login guard (domain check already blocks `@sagadatadriven.com.br`).

---

### Step 1 — Database Migration

Single migration that:

1. Adds `'Sistema'` to the `tipo_acesso` enum
2. Generates a real UUID for the system user
3. Creates an `auth.users` entry with no password (email: `pri.ia@sagadatadriven.com.br`)
4. Creates the `profiles` entry with `nome_completo = 'Pri IA'` and `tipo_acesso = 'Sistema'`

```sql
ALTER TYPE tipo_acesso ADD VALUE IF NOT EXISTS 'Sistema';

-- Use a DO block to generate a real UUID and insert in both tables
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at)
  VALUES (v_id, '00000000-0000-0000-0000-000000000000', 'pri.ia@sagadatadriven.com.br', '', now(), 'authenticated', 'authenticated', now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, nome_completo, tipo_acesso)
  VALUES (v_id, 'Pri IA', 'Sistema')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Pri IA user created with ID: %', v_id;
END $$;
```

After migration runs, retrieve the generated UUID from the database to set as secret.

### Step 2 — Add Supabase Secret

Query the UUID from profiles, then add secret:

- **Name:** `PRI_IA_USER_ID`
- **Value:** the UUID generated in Step 1

### Step 3 — Update `prospeccao-status/index.ts`

Three changes only:

**3.1** — At the top, read env + define email constant:
```typescript
const PRI_IA_USER_ID = Deno.env.get('PRI_IA_USER_ID');
const PRI_IA_EMAIL = 'pri.ia@sagadatadriven.com.br';
```

**3.2** — Guard: after `isAdminToken` is determined, if it's an admin-token call and `PRI_IA_USER_ID` is missing, return 500 immediately:
```typescript
if (isAdminToken && !PRI_IA_USER_ID) {
  console.error('PRI_IA_USER_ID não configurado');
  return new Response(
    JSON.stringify({ error: 'Configuração de sistema ausente (PRI_IA_USER_ID)' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**3.3** — In the `logs_movimentacao_contatos` INSERT (line ~269-278):
```typescript
usuario_id: isAdminToken ? PRI_IA_USER_ID : (userId === 'admin-api' ? null : userId),
observacoes: isAdminToken ? 'Alteração automática via Pri IA' : 'Alteração via API (lead_id)'
```

**3.4** — After the status UPDATE (line ~261), add responsavel update for admin-token:
```typescript
if (isAdminToken && PRI_IA_USER_ID) {
  const { error: respError } = await supabaseClient
    .from('contatos')
    .update({ responsavel_email: PRI_IA_EMAIL })
    .eq('id', contato.id);
  if (respError) {
    console.error('Erro ao atribuir responsável Pri IA:', respError.message);
  } else {
    console.log(`   └─ Responsável atualizado para Pri IA`);
  }
}
```

**3.5** — Deploy the function.

### What We Are NOT Doing

| Item | Reason |
|------|--------|
| Login guard for `tipo_acesso = 'Sistema'` | Domain check already blocks `@sagadatadriven.com.br` (not `@gruposaga.com.br`) |
| `prospeccao-anotacao` changes | Per user request — skip for now |
| `PermissionRegistry` changes | 'Sistema' is not a permission profile |
| Ranking/Acessos changes | Already filter by specific `tipo_acesso` values |

### Validation

1. Query DB: `SELECT id, nome_completo, tipo_acesso FROM profiles WHERE nome_completo = 'Pri IA'` — should return one row
2. Test admin-token status change via curl → check `logs_movimentacao_contatos` has `usuario_id` = Pri IA UUID
3. Check `contatos.responsavel_email` = `pri.ia@sagadatadriven.com.br` after admin-token change
4. Timeline shows "Pri IA" via JOIN with profiles

