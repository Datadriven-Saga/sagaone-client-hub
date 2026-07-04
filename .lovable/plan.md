# Diagnóstico e plano — vendedores não aparecem no check-in

## Diagnóstico confirmado

Você está certo: **`profiles.empresa_id` não é a fonte correta** para saber em quais lojas um vendedor está atribuído.

O clique nessa tela de **Acessos > Empresas com Acesso** atualiza a tabela:

```text
user_empresas
```

Fluxo real confirmado no código:

```text
Acessos.tsx
  └─ EmpresasSelector
      └─ form.empresas = IDs marcados no checkbox
          └─ manage-users edge function
              └─ delete/insert em public.user_empresas
```

Na criação/edição de usuário, a Edge Function `manage-users` grava os vínculos assim:

```ts
.from('user_empresas')
.insert({
  user_id,
  empresa_id,
  is_ativa
})
```

Ou seja: **a tabela que representa a atribuição real usuário/vendedor → empresa é `user_empresas`**.

## Onde está o erro hoje

A RPC usada no campo **“Vendedor que irá atender”** é:

```sql
public.get_vendedores_atendimento(p_empresa_id uuid)
```

Ela busca assim hoje:

```sql
FROM public.profiles p
WHERE p.empresa_id = p_empresa_id
  AND p.tipo_acesso = 'Vendedor'
```

Esse trecho é o problema:

```sql
p.empresa_id = p_empresa_id
```

Porque `profiles.empresa_id` é só uma empresa primária/default do perfil, não a lista real de lojas marcadas no controle de acessos.

## Comportamento correto

A busca deve ser:

```text
Buscar vendedores cujo usuário tenha vínculo com a loja ativa em user_empresas.
```

Ou seja:

```sql
profiles p
JOIN user_empresas ue ON ue.user_id = p.id
WHERE ue.empresa_id = p_empresa_id
  AND p.tipo_acesso = 'Vendedor'
  AND p.is_active = true
```

Importante: **não usar `ue.is_ativa = true`** para listar vendedores da loja.

Motivo: `is_ativa` representa a empresa ativa na sessão daquele usuário, não se ele pertence à loja. Se o vendedor tem acesso a BMW GYN mas naquele momento está com outra loja ativa, ele ainda assim precisa aparecer como vendedor disponível para BMW GYN.

## Correção proposta

### 1. Alterar a RPC `get_vendedores_atendimento`

Trocar a origem da loja de:

```sql
p.empresa_id = p_empresa_id
```

para:

```sql
JOIN public.user_empresas ue
  ON ue.user_id = p.id
 AND ue.empresa_id = p_empresa_id
```

Mantendo:

```sql
p.tipo_acesso::text = 'Vendedor'
COALESCE(p.is_active, true) = true
public.user_can_access_empresa(p_empresa_id, auth.uid())
```

A chamada de `user_can_access_empresa` continuará com **dois argumentos**, como exige a regra do projeto, para evitar erro de overload.

### 2. Não mexer no frontend

O frontend já chama a RPC corretamente:

```ts
supabase.rpc("get_vendedores_atendimento", {
  p_empresa_id: activeCompany.id,
})
```

A falha está na lógica SQL da RPC, não no componente.

A correção no banco resolve os dois lugares que usam o check-in:

```text
/prospeccao/recepcao
DashboardLayout / FAB global
```

### 3. Validar com dados reais

Depois da alteração, validar para a loja selecionada na tela, por exemplo BMW GYN:

```sql
SELECT p.id, p.nome_completo, p.tipo_acesso, ue.empresa_id
FROM public.user_empresas ue
JOIN public.profiles p ON p.id = ue.user_id
WHERE ue.empresa_id = '78a6c1bd-1296-411b-a602-707c47e93e59'
  AND p.tipo_acesso::text = 'Vendedor'
  AND COALESCE(p.is_active, true) = true
ORDER BY p.nome_completo;
```

Se essa query retornar vendedores, o combobox deve deixar de mostrar **“Nenhum vendedor cadastrado.”**

### 4. Atualizar documentação/memória

Registrar a regra para não repetirmos esse erro:

```text
Para atribuição de vendedor por loja, nunca usar profiles.empresa_id.
Usar user_empresas como fonte real de vínculo usuário/empresa.
```

## Resultado esperado

Após a migration:

```text
Recepção / Check-in
  └─ Vendedor que irá atender
      └─ lista vendedores vinculados à loja ativa via user_empresas
```

E não mais apenas vendedores cujo `profiles.empresa_id` bate com a loja.