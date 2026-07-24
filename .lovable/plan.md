# Plano — Erro 500 ao mover lead no Kanban (usuário CRM)

## Contexto do incidente

- Usuária: `thais.bsouza@gruposaga.com.br` (tipo de acesso **CRM**, `user_id = a2f11ac8-f920-44fb-a8a6-b4ef14bb48e0`).
- Evento: `* SUPERAÇÃO DE VENDAS - SAGA TOYOTA COLORADO` (`prospeccao_id = 74ef55cf-c595-42ac-9ad3-2555e17170b2`, empresa `424f681c-f1b3-4b16-b311-a57f699d915a`).
- Lead usado no log: contato `119ad40d-eb95-48f5-8e33-759be331b0b2` (PANTANAL VEICULOS LTDA), `status = Em Espera`, `responsavel_email = NULL`, vinculado a 4 eventos (multi-evento).
- Requisição: `PUT /functions/v1/prospeccao-status?lead_id=119ad40d-...` → `500 Internal Server Error`.

## Diagnóstico (confirmado via leitura)

Confirmado pela definição atual de `public.mutate_contato_status_atomic` (SECURITY DEFINER):

1. Se a sessão **não** é `service_role`, exige `auth.uid()`.
2. Bypass total só para `Administrador`, `Master`, `TI`.
3. Caso contrário: valida `user_can_access_empresa(empresa_do_contato)` e depois exige **uma** das condições:
   - ser membro de `prospeccao_equipes` / `prospeccao_equipe_membros` do evento; **ou**
   - `responsavel_email` do contato = e-mail do caller.
4. Se nenhuma bater: `RAISE EXCEPTION 'sem permissão para movimentar este lead' (42501)`.

Para a Thais:
- Tipo de acesso **CRM** → não entra no bypass admin.
- Tem `user_empresas` para a empresa do contato → passa em `user_can_access_empresa`.
- Não pertence à equipe do evento e o contato tem `responsavel_email = NULL` → cai no `RAISE EXCEPTION`.
- O edge function captura o erro da RPC e devolve HTTP 500 com `{ error: "Erro ao atualizar status", detalhes: "sem permissão para movimentar este lead" }` (ver `supabase/functions/prospeccao-status/index.ts:424-437`).

Confirmado:
- CRM (e outros papéis de gestão) hoje só conseguem mover leads se caírem por acaso em uma equipe do evento ou forem o responsável do lead — que é o oposto do papel esperado de CRM/Gerência.
- É uma **regressão de permissão** na RPC, não um bug de RLS de tabela.

## Correção proposta

Ampliar o bypass da RPC `mutate_contato_status_atomic` para incluir papéis de gestão que hoje já enxergam todos os leads da empresa (ref: memórias `lead-ownership-access-control`, `access-hierarchy-levels`), mantendo a barreira de empresa via `user_can_access_empresa`.

Papéis a adicionar ao bypass (após validar acesso à empresa do contato):
- `CRM`
- `Gerente de Leads`
- `Gerente de Loja`
- `Coordenadora de Leads`
- `Diretor`
- `Proprietário`

Comportamento resultante:
- Admin/Master/TI: bypass total (inalterado).
- Papéis de gestão acima: precisam ter acesso à empresa do contato; não precisam ser responsáveis nem membros de equipe.
- SDR / Vendedor / Recepcionista / Outros: regra atual mantida (equipe do evento OU responsável do lead).
- Chamadas com service role (edge functions internas / admin token via Pri IA): bypass total mantido.

## Entregas

1. Documento `docs/diagnostico-500-prospeccao-status-crm.md` com:
   - Sintoma, requisição, usuário e lead envolvidos.
   - Trecho da RPC responsável e caminho exato do `RAISE`.
   - Evidências consultadas no banco (perfis, `user_empresas`, `eventos_prospeccao`, `contatos`).
   - Correção proposta e o que **não** muda (SDR/Vendedor, RLS de tabela, edge function).
   - Riscos + testes obrigatórios.

2. Migração alterando `public.mutate_contato_status_atomic` para incluir o novo bypass de gestão. Sem tocar em RLS, grants, edge functions ou outras RPCs.

## O que NÃO alterar

- RLS de `contatos`, `logs_movimentacao_contatos`, `prospeccao_equipes`, `prospeccao_equipe_membros`.
- Edge function `prospeccao-status` (o mapeamento de erro já é adequado).
- Regras de visibilidade de SDR/Vendedor no Kanban.
- Fluxo de admin token / Pri IA.

## Testes obrigatórios após a correção

- Thais (CRM) move o lead `119ad40d-...` no evento `74ef55cf-...` → deve retornar 200 e gerar log em `logs_movimentacao_contatos` com o `prospeccao_id` correto.
- Usuário Gerente de Loja move lead da sua loja → 200.
- Usuário SDR sem equipe e sem ser responsável → continua bloqueado (comportamento atual).
- Usuário de outra empresa → continua bloqueado por `user_can_access_empresa`.
- Chamada via admin token (Pri IA) → continua funcionando.

## Passo imediato após aprovação

Criar o `.md` de diagnóstico e enviar a migração da RPC para aprovação.
