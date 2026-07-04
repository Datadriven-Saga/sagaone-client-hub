# Multi-tenant e Empresa Ativa

**Área:** Arquitetura
**Público-alvo:** dev
**Última revisão:** 2026-07-01

## Modelo

- `empresas` — cadastro mestre (CNPJ, marca, `crm_id`, `dealer_id`, `bypass_compliance`, `is_ativa`).
- `user_empresas` — vínculo N:N usuário↔empresa (`is_ativa` marca qual está selecionada na sessão).
- `proprietario_empresas` — dono da empresa (não escala perfis; usar `user_empresas`).

## Vínculo real usuário↔empresa

Para regras de acesso, atribuição operacional e listagens por loja, a fonte correta é sempre `user_empresas`.

`profiles.empresa_id` é apenas uma referência/default do perfil e **não** deve ser usada para decidir se um vendedor, SDR, CRM ou recepcionista pertence a uma loja.

Exemplo: a lista **"Vendedor que irá atender"** no check-in usa `get_vendedores_atendimento(p_empresa_id)`, que deve consultar vendedores vinculados pela `user_empresas`, não por `profiles.empresa_id`.

## Empresa ativa

No FE, `CompanyContext` (`src/contexts/CompanyContext.tsx`) mantém a empresa selecionada. Toda consulta filtrada por `empresa_id` usa esse contexto (memory `logica-contexto-empresa-ativa`).

No BE, RLS valida acesso via:

```sql
public.user_can_access_empresa(p_empresa_id uuid, p_user_id uuid DEFAULT auth.uid())
```

### ⚠️ Overload intencional

A função tem duas assinaturas (1-arg e 2-arg). Callers SQL/RPC **devem passar `(empresa_id, auth.uid())`** — chamada com 1 arg explode `42725 is not unique` (memory `user-can-access-empresa-overload-call`).

## Isolamento estrito

- **Store isolation:** `dealer_id` deve bater com `crm_id` para filtrar eventos externos (regra core).
- **Empresa sandbox** (`b32ae8c9-34f6-4646-946e-2a05ff07b02b`) — só Admin/TI/Master; CNPJ `00000000000000`.
- **Master** ignora filtros e vê tudo.

## Sync externo

`sync-empresas` adiciona/atualiza empresas via mapping por `crm_id`/CNPJ, nunca deleta (memory `sync-empresas-strategy`).

## Relacionado

- [Autenticação e sessão](./autenticacao-e-sessao.md)
- [Permissões e RBAC](./permissoes-e-rbac.md)
- [Empresas e Cadeiras](../administracao/empresas-e-cadeiras.md)