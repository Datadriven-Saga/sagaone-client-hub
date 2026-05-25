# Documento: Níveis do menu Entra Dados

Vou gerar **um único arquivo markdown** em `/mnt/documents/entra-dados-niveis.md` (mais um diagrama Mermaid embutido), explicando em detalhe o menu Entra Dados e, de forma genérica, como os demais menus se comportam. Nada de código de aplicação é alterado.

## Estrutura do documento

### 1. Visão geral do menu Entra Dados
- O que é hoje (rota `/entra-dados` + sub-rota `/de-para`, sidebar agrupada com ícone `Database`).
- O que está mockado (lista de bases/tabelas) vs. o que é real (De-Para S3).

### 2. Nível de ACESSO (quem pode entrar na rota)
- Hoje: `PermissionProtectedRoute permissionKey="canAccessPosVendas"` — herda do mesmo flag de Pós-Vendas.
- Default no `PermissionRegistry`: `canAccessPosVendas = isAdmin` (Admin, TI, Master).
- Como mudar: criar flag dedicada `canAccessEntraDados` no `PermissionRegistry` + override por departamento em `departamento_permissoes`.
- Tabela de papéis × acesso atual (Master/Admin/TI = sim; demais = não).

### 3. Nível de VISUALIZAÇÃO (o que cada papel vê dentro do menu)
- Sidebar: item só renderiza se `canSeePosVendas` for true (já é o caso).
- Página Visão Geral: KPIs, cards de bases/tabelas/de-paras — hoje todos veem o mesmo mock.
- De-Para: lista lida do S3 via edge `de-para-s3` — independente de empresa (global no bucket).
- Recomendações de granularidade futura: visualizar vs. criar vs. editar vs. excluir vs. administrar (mesma matriz já usada no Registry).

### 4. Nível de EXISTÊNCIA por empresa (multi-tenant / "spaces")
Aqui está a decisão de arquitetura. Apresento três modelos com trade-offs, sem implementar nada:

**A. Global (compartilhado entre todas as empresas)**
- Tabelas `enda_*` sem `empresa_id`. De-paras no S3 sob `de-para/*.json` (modelo atual).
- Prós: simples, uma única fonte de verdade, fácil de manter governança central.
- Contras: qualquer empresa enxerga tudo; não permite customização por loja/marca; risco se uma empresa precisar de regras próprias.

**B. Por empresa (isolado, padrão multi-tenant do projeto)**
- Tabelas `enda_bases`, `enda_tabelas`, `enda_de_paras` com coluna `empresa_id uuid not null` + RLS via `user_can_access_empresa(empresa_id)` (já existe no projeto).
- S3 com prefixo por empresa: `de-para/<empresa_id>/<nome>.json`.
- Contexto ativo vem de `CompanyContext` (`activeCompany.id`) — mesmo padrão de Prospecção/Pós-Vendas.
- Prós: alinhado ao restante do sistema, isolamento estrito, evita vazamento entre lojas.
- Contras: duplicação de de-paras comuns; precisa de UI de "copiar de outra empresa"; EMPRESA ADMIN sandbox precisa ser tratada.

**C. Híbrido (recomendado para discutir)**
- Itens marcados como `escopo = 'global'` ficam visíveis a todas as empresas (read-only para não-Admin).
- Itens `escopo = 'empresa'` ficam isolados por `empresa_id`.
- Prós: de-paras "de referência" (ex.: marca → grupo) ficam globais; tabelas operacionais ficam por empresa.
- Contras: regra de RLS mais complexa; UI precisa deixar o escopo claro; risco de Admin global sobrescrever sem querer.

Para cada modelo, o doc traz: schema sugerido, RLS sugerida, impacto no S3, e como Master/Admin/EMPRESA ADMIN se comportam.

### 5. Mapa visual (Mermaid embutido no .md)
Diagrama mostrando:
- Usuário → `useUserAccessType` → flag → `PermissionProtectedRoute` → rota.
- `CompanyContext.activeCompany` → filtro de dados.
- Tabelas `enda_*` (futuras) e bucket S3 → relação com `empresa_id`.
- Como os 3 modelos (Global / Por empresa / Híbrido) mudam o fluxo.

### 6. Como os outros menus se comportam (genérico, 1 parágrafo cada)
- **Prospecção / Kanban / Eventos**: existência **por empresa** via `empresa_id` + `prospeccao_equipe_membros` para visibilidade fina (SDR/Vendedor).
- **Pós-Vendas (Paty)**: existência **por empresa**, mesma flag `canAccessPosVendas`.
- **Administração / MFA**: acesso **global restrito** (Master/Admin/TI), dados sensíveis com RLS estrita.
- **Resultados / Relatórios**: leitura agregada cross-empresa para perfis gerenciais; demais filtrados por `user_empresas`.
- **Quarentena / Opt-Out Global**: existência **global** intencional (bloqueio cross-marca por telefone).
- **Configurações / Feature Flags**: flags globais com override `per_empresa` quando aplicável.

### 7. Próximos passos sugeridos
- Decidir o modelo (A/B/C) antes de criar qualquer tabela `enda_*`.
- Criar flag dedicada `canAccessEntraDados` para desacoplar de Pós-Vendas.
- Definir se EMPRESA ADMIN sandbox participa ou é excluída (padrão do projeto: excluída).

## Entregável
- `/mnt/documents/entra-dados-niveis.md` — documento completo com Mermaid embutido.
- Tag `<presentation-artifact>` no chat para download.

Nenhum arquivo do código do app é tocado.
