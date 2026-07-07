---
name: user_can_access_empresa - assinatura e fonte de verdade
description: Ordem correta dos args (empresa_id, user_id) e qual tabela usar para vínculo usuário↔empresa; nunca usar profiles.empresa_id como fonte de verdade
type: constraint
---

## Assinatura correta

```
public.user_can_access_empresa(target_empresa_id uuid, user_id uuid DEFAULT auth.uid())
```

**Sempre chamar a versão 2-arg explícita, nesta ordem:**

```sql
public.user_can_access_empresa(<empresa_id>, auth.uid())
```

Primeiro é EMPRESA, segundo é USUÁRIO. Inverter faz a função retornar sempre `false` — RLS bloqueia leituras e escritas silenciosamente. Bug real já ocorrido em `prospeccao_cadencias` (policies com args invertidos → tabela ficou 0 linhas globalmente).

**Não usar overload de 1-arg** (vide memory `user-can-access-empresa-overload-call`).

## Fonte de verdade do vínculo usuário↔empresa

A função consulta 3 fontes em UNION, mas a canônica é **`user_empresas`** (N:N).

1. `get_user_active_company(user_id)` → empresa ativa da sessão (secundária)
2. `user_empresas` → **fonte principal**, único vínculo real
3. `profiles.empresa_id` → apenas default do perfil, **NÃO é vínculo**

**Nunca** usar `profiles.empresa_id` como fonte de verdade para:
- decidir acesso a dados de outra empresa
- listar vendedores/SDRs/recepcionistas/CRMs de uma loja
- atribuir leads
- policies RLS
- RPCs de operação (ex.: `get_vendedores_atendimento`)

Sempre consultar `user_empresas` diretamente ou delegar a `user_can_access_empresa`.

## Padrão para policies RLS em tabelas filhas

```sql
USING (
  EXISTS (
    SELECT 1 FROM public.<parent> p
    WHERE p.id = <child>.<parent>_id
      AND public.user_can_access_empresa(p.empresa_id, auth.uid())
  )
)
```

Revisar visualmente a ordem dos args antes de submeter qualquer migration.
