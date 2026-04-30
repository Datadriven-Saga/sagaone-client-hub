---
name: Quarentena visibility by brand
description: Visualização e ações da quarentena escopadas por MARCA (não por empresa), alinhadas à regra de bloqueio
type: feature
---
A quarentena bloqueia importações por `(telefone_normalizado, marca, canal)` — globalmente por marca, não por loja.
Para evitar gap em que CRM era bloqueado mas não enxergava o registro:

- RLS SELECT/UPDATE em `contato_quarentena`: admin vê tudo; demais veem se `marca = ANY(get_user_marcas(auth.uid()))`.
- `get_user_marcas(uuid)`: união de marcas de `user_empresas`, perfil e empresa ativa.
- `get_quarentena_paginated`: para não-admin, intersecta `p_marcas` com marcas do usuário; sem `p_empresa_id` forçado.
- `useQuarentenaData`: NÃO filtra por `empresa_id` no client; RPC e RLS cuidam do escopo.
- `upsert_quarentena`: ao impactar novamente, reseta `desativado=false`, `desativado_por=NULL`, `desativado_em=NULL` — desativação manual vale só até o próximo impacto real.
