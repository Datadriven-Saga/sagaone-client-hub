---
name: Chamada SQL de user_can_access_empresa precisa passar auth.uid()
description: Funções SQL/RPC que chamam public.user_can_access_empresa devem passar (empresa_id, auth.uid()) - chamar só com (empresa_id) explode 42725 "is not unique"
type: constraint
---

Existem duas funções `public.user_can_access_empresa`:

- `user_can_access_empresa(target_empresa_id uuid)` - wrapper de 1 arg.
- `user_can_access_empresa(target_empresa_id uuid, user_id uuid DEFAULT auth.uid())` - implementação.

Como o overload de 2 args tem `DEFAULT`, o resolver do Postgres considera ambas candidatas para chamadas de 1 argumento e explode com `42725 function public.user_can_access_empresa(uuid) is not unique` (HTTP 400 no PostgREST). O `RAISE EXCEPTION` do caller nem chega a rodar.

**Regra:** em qualquer função SQL/RPC chame sempre passando o segundo argumento explícito:

```sql
IF v_uid IS NULL OR NOT public.user_can_access_empresa(v_job.empresa_id, v_uid) THEN
  RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
END IF;
```

Validado em jun/2026 com `cancel_scheduled_campaign_job` - chamava `user_can_access_empresa(v_job.empresa_id)` e bloqueava 100% dos cancelamentos de disparos programados na UI.

**Why:** os overloads são intencionais (uso por RLS, autenticado e anônimo) - corrigir no caller, não remover overload.
