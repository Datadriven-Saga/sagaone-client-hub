# Fix: lead criado pelo "Criar Lead" não aparece para o vendedor

## Problema confirmado
- Lead `4C7FCFE2` foi gravado com `responsavel_email = "050b4cc0-...uuid..."` em vez de `gabriel.pvieira@gruposaga.com.br`.
- O Kanban filtra "Meus Leads / Atribuído" do vendedor por `responsavel_email === user.email` (`src/pages/Prospeccao.tsx:2285`), então o UUID nunca bate e o lead some para o vendedor.
- Admin enxerga porque não passa por esse filtro.

## Causa raiz
`src/components/NovoLeadModal.tsx` grava `user?.id` (UUID) onde a coluna espera email:
- Linha 309: `.update({ responsavel_email: user?.id })`
- Linha 398: payload da criação `responsavel_email: user?.id`
- Linhas 251-255, 320: lógica local comparando `responsavel_email` contra `user?.id` (compensando o bug, mas só localmente)

## Correção

### 1. NovoLeadModal — padronizar para email
- Substituir `user?.id` por `user?.email` nas duas gravações (linhas 309 e 398).
- Ajustar `existingContato.responsavel_email === user?.id || ... === user?.email` para comparar apenas por `user?.email` (linhas 251-255).
- Atualizar o estado local pós-update (linhas 320, 1196 em `useContatoData.ts` se aplicável ao mesmo fluxo) para refletir email.

### 2. Backfill do lead afetado (e quaisquer outros recentes com UUID em responsavel_email)
Migration que faz:
```sql
UPDATE public.contatos c
SET responsavel_email = u.email
FROM auth.users u
WHERE c.responsavel_email ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND u.id::text = c.responsavel_email;
```
Isso corrige `4C7FCFE2` e qualquer outro lead contaminado pelo mesmo bug.

### 3. Verificação
- Após o fix, logar como Gabriel (`gabriel.pvieira@gruposaga.com.br`) → o lead deve aparecer no Kanban dele em "Atribuído".
- Criar um novo lead pelo botão "Criar Lead" como vendedor → conferir no banco que `responsavel_email` salva email, não UUID.

## Fora do escopo (apenas registrar, não mexer agora)
- Há código defensivo espalhado (`p.id === responsavel_email || p.email === ... || p.celular === ...`) que existe justamente porque a coluna virou um campo polimórfico. Limpeza geral desse padrão é trabalho separado; aqui apenas garantimos que o **filtro principal de visibilidade do vendedor** volta a funcionar.

## Por que não mudar o filtro do Kanban em vez do modal
A coluna se chama `responsavel_email`, e o resto do sistema (importação, sync, webhooks) já trata como email. Mudar o filtro para aceitar UUID propagaria a inconsistência. O ponto de origem do bug é o modal.
