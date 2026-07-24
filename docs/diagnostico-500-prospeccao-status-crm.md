# Diagnóstico — 500 em `prospeccao-status` (usuário CRM)

## Sintoma

`PUT /functions/v1/prospeccao-status?lead_id=119ad40d-eb95-48f5-8e33-759be331b0b2` → **500 Internal Server Error** ao mover lead no Kanban.

```
handleStatusChange { itemId: '119ad40d-...', fromStatus: 'novos', toStatus: 'atribuidos',
                     prospeccaoIdAlvo: '74ef55cf-c595-42ac-9ad3-2555e17170b2' }
```

## Escopo

- Usuária: `thais.bsouza@gruposaga.com.br` (`user_id = a2f11ac8-f920-44fb-a8a6-b4ef14bb48e0`, tipo de acesso **CRM**).
- Evento: `* SUPERAÇÃO DE VENDAS - SAGA TOYOTA COLORADO` (`prospeccao_id = 74ef55cf-c595-42ac-9ad3-2555e17170b2`, empresa `424f681c-f1b3-4b16-b311-a57f699d915a`).
- Contato: `119ad40d-eb95-48f5-8e33-759be331b0b2` — `status = Em Espera`, `responsavel_email = NULL`, vinculado a 4 eventos.
- Vínculo `user_empresas` da Thais com a empresa do contato: existe (`is_ativa = false`, mas o vínculo basta para `user_can_access_empresa`).

## Caminho da falha

O edge `supabase/functions/prospeccao-status/index.ts` chama a RPC `public.mutate_contato_status_atomic`. Quando a RPC retorna erro, o handler devolve HTTP 500 (linhas 424-437).

A RPC atual (`SECURITY DEFINER`) autoriza assim:

1. Se a sessão não é `service_role`, exige `auth.uid()`.
2. Bypass total para `Administrador`, `Master`, `TI`.
3. Caso contrário: valida `user_can_access_empresa(empresa_do_contato)` e depois exige uma destas condições, senão levanta `RAISE EXCEPTION 'sem permissão para movimentar este lead' (42501)`:
   - ser membro de `prospeccao_equipes` / `prospeccao_equipe_membros` do evento; ou
   - `responsavel_email` do contato = e-mail do caller.

Para a Thais:

- Tipo **CRM** → não entra no bypass admin.
- Tem `user_empresas` → passa em `user_can_access_empresa`.
- Não é membro da equipe do evento e o contato tem `responsavel_email = NULL` → cai no `RAISE`.
- O edge devolve 500 com `detalhes: "sem permissão para movimentar este lead"`.

## Confirmado / Descartado

**Confirmado**
- O 500 é gerado pela RPC ao levantar `sem permissão para movimentar este lead`.
- A regra atual só libera Admin/Master/TI + responsável do lead + membro de equipe.
- CRM não se encaixa em nenhuma dessas categorias por definição do papel.

**Descartado**
- RLS de `contatos`, `logs_movimentacao_contatos` ou `prospeccao_equipes` — falha ocorre antes do `UPDATE`.
- CORS ou autenticação do edge — o log chega até a chamada da RPC.
- Multi-evento sem `prospeccao_id` — o frontend envia `prospeccaoIdAlvo` e o contato tem vínculo com aquele evento.

## Correção

Ampliar o bypass da RPC `mutate_contato_status_atomic` para papéis de gestão que já enxergam todos os leads da empresa, mantendo a barreira `user_can_access_empresa`.

Novos papéis com bypass (após validar acesso à empresa do contato):

- CRM
- Gerente de Leads
- Gerente de Loja
- Coordenadora de Leads
- Diretor
- Proprietário

Comportamento resultante:

| Papel | Comportamento |
| --- | --- |
| Administrador / Master / TI | Bypass total (inalterado). |
| CRM / Gerência / Diretor / Proprietário | Precisam ter acesso à empresa do contato. |
| SDR / Vendedor / Recepcionista / Outros | Precisam ser responsável do lead ou membro da equipe do evento. |
| service_role / admin token (Pri IA) | Bypass total (inalterado). |

## O que NÃO alterar

- RLS de `contatos`, `logs_movimentacao_contatos`, `prospeccao_equipes`, `prospeccao_equipe_membros`.
- Edge function `prospeccao-status`.
- Regras de visibilidade de SDR/Vendedor no Kanban.
- Fluxo de admin token / Pri IA.

## Testes obrigatórios

- Thais (CRM) move o lead `119ad40d-...` em `74ef55cf-...` → 200 e log em `logs_movimentacao_contatos`.
- Gerente de Loja movendo lead da sua loja → 200.
- SDR sem equipe e sem ser responsável → continua bloqueado.
- Usuário de outra empresa → continua bloqueado por `user_can_access_empresa`.
- Chamada com admin token (Pri IA) → continua funcionando.

## Riscos

- Baixo: a mudança amplia bypass apenas para papéis com visibilidade ampla; a checagem de empresa continua ativa.
