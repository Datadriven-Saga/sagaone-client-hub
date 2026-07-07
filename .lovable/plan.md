## Atualizar documentação com as últimas mudanças

Atualizar os docs de arquitetura e prospecção para refletir o que foi corrigido/registrado nesta thread sobre `user_can_access_empresa`, `user_empresas` como fonte de verdade e a nova tabela `prospeccao_cadencias`.

### Arquivos a atualizar

1. **`docs/arquitetura/multi-tenant.md`**
   - Reforçar bloco "⚠️ Overload intencional" adicionando a regra da **ordem dos argumentos**: `user_can_access_empresa(empresa_id, auth.uid())` — inverter faz RLS bloquear silenciosamente.
   - Citar o incidente real em `prospeccao_cadencias` (policies com args invertidos → tabela ficou 0 linhas globalmente) como exemplo.
   - Adicionar link para as memories `user-can-access-empresa-signature` e `vendor-company-link-source`.

2. **`docs/arquitetura/permissoes-e-rbac.md`**
   - Na seção "RLS Security Definer", incluir o padrão canônico para tabelas filhas (EXISTS + join no pai + `user_can_access_empresa(p.empresa_id, auth.uid())`).

3. **`docs/prospeccao/visao-geral.md`** (ler antes)
   - Registrar que cadências extras (ordens 2 e 3) vivem em `prospeccao_cadencias` e são somadas ao payload do webhook em `cadencias: []`, mantendo os campos legacy da cadência #1 nas colunas de `prospeccoes`.
   - Nota sobre RLS: acesso via join com `prospeccoes` usando `user_can_access_empresa(empresa_id, auth.uid())`.

4. **`docs/prospeccao/dispatch-whatsapp.md`** (ler antes)
   - Complementar payload do webhook com o novo campo `cadencias[]` e a ordem 1..3.

5. **`docs/historico/breaking-changes.md`** (ler antes)
   - Nova entrada datada 2026-07-07:
     - Fix RLS `prospeccao_cadencias` (args de `user_can_access_empresa` corrigidos).
     - Introdução da tabela `prospeccao_cadencias` para cadências 2 e 3.

### Fora de escopo

- Não mexer em código (FE/BE/edge functions/migrations).
- Não recriar as memories já salvas — apenas referenciá-las nos docs.
- Não tocar em docs não relacionados a esses temas.
