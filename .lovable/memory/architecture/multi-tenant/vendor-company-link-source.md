---
name: Fonte real de vínculo vendedor-empresa
description: Listagens/atribuições de vendedor por loja devem usar user_empresas, nunca profiles.empresa_id
type: constraint
---

Para qualquer regra de vendedor/SDR/CRM/recepção por loja, a fonte real do vínculo usuário↔empresa é `public.user_empresas`.

`profiles.empresa_id` é apenas referência/default do perfil e não representa as lojas marcadas em **Acessos > Empresas com Acesso**.

Aplicar especialmente em:

- lista "Vendedor que irá atender" no check-in;
- atribuição manual/automática por loja;
- filtros administrativos por empresa;
- RPCs que recebem `p_empresa_id` e listam usuários da loja.

Não filtrar por `user_empresas.is_ativa` quando o objetivo é saber se o usuário pertence à loja; `is_ativa` indica apenas a empresa selecionada na sessão daquele usuário.