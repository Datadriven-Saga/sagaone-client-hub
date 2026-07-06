## Diagnóstico — Entregas não carrega templates da Paty

### Sintoma (screenshot)
Na tela **Entregas — Gatilhos Saga Conecta** (agente `Paty · HYUNDAI/GO · 6230302248`, empresa ativa **HYUNDAI T9**), o dropdown de template do gatilho "Novo Lead" mostra **apenas 2 opções** (`agendamento_confirmado_v7` e `teste_paty`), e exibe o aviso:

> Template configurado (ID PRI 1695) não foi encontrado na lista local.

Já a tela **Paty Geral → Templates** (mesmo agente) mostra **dezenas de templates aprovados** (1720, 1721, 1722, 1729, 1748, 1693, 1700…).

### Causa raiz

A Paty é **agente compartilhado por marca+UF** (memory `WPP Template Share` + doc `05-pos-vendas.md`). Consequências que colidem com o filtro atual:

1. **`whatsapp_templates` armazena o template sob UMA empresa "dona"** (na prática, quase sempre a EMPRESA ADMIN sandbox `b32ae8c9-…` — memory `Core`). Não há uma linha por empresa que compartilha o agente.
2. **Configuração n8n do gatilho de Entrega é global por telefone do agente** — ela guarda um `template_id_pri` só, válido pra qualquer loja daquela marca+UF.
3. Cada tela usa um **filtro diferente** pra listar templates:

| Tela | Hook / query | Filtro |
|---|---|---|
| Paty Geral → Templates | `TemplatesPaty.tsx` L390-405 | `pri_telefone = <telefone do agente>` (global, sem empresa) |
| Entregas → dropdown | `usePatyTemplates` em `src/hooks/pos-vendas/usePosVendasData.ts` L64-90 | `empresa_id = activeCompany.id` **AND** `agente_id = X` **AND** `ativo = true` **AND** `status_meta = 'APPROVED'` |

Confirmado no banco: dos ~18 templates aprovados do agente `bf07a991-…` (Paty HY/GO):
- **16 estão sob `empresa_id = b32ae8c9…` (sandbox ADMIN)**
- **Apenas 2 estão sob `empresa_id = e2c4fdf8…` (HYUNDAI T9, empresa ativa do usuário)** → exatamente os 2 que aparecem no dropdown (PRI 2210 e 2209).

O `template_id_pri = 1695` salvo no n8n aponta pra um template registrado sob a empresa sandbox (ou outra loja), então o `idByPri` local não acha e mostra o aviso.

### Impacto

- Toda loja que compartilha Paty com outra da mesma marca+UF vê o dropdown quase vazio.
- Se o usuário trocar de template, o backend n8n vai salvar o PRI novo, mas outras lojas da mesma marca+UF podem passar a exibir o mesmo aviso "não encontrado".
- Peças, Cadência e Agendamentos usam o mesmo `usePatyTemplates(effectiveId, true)` → **mesmo bug provável nessas 3 abas** (`PecasTemplatesSection.tsx`, `AgendamentosTab.tsx` L111 e L300, `PatyCadencia`).

### Onde bater pra corrigir (proposta — sem código ainda)

O consumo do template em Pós-Vendas precisa refletir o **modelo real**: template pertence ao **agente (pri_telefone/id_meta)**, não à empresa ativa. Duas opções, ambas isoladas ao frontend:

**Opção A — mudar `usePatyTemplates` pra buscar por agente, não por empresa (recomendada)**

- Remover o `.eq("empresa_id", activeCompany.id)`.
- Filtrar por `agente_id = effectiveId` (ou `pri_telefone`, alinhando com `TemplatesPaty`).
- Manter `ativo = true` e (quando `approvedOnly`) `status_meta = 'APPROVED'`.
- Alinha Entregas/Peças/Cadência/Agendamentos com a tela de gestão de templates → mesma lista pra escolher e pra ver.
- **Risco:** se algum ponto do app depender do escopo por empresa em `usePatyTemplates`, muda comportamento. Auditar chamadas antes.

**Opção B — enriquecer a lista buscando também pelos templates da empresa "dona" do agente**

- Fazer 2 queries: uma pela empresa ativa + uma pela empresa do agente (via `agente_empresas` ou empresa da linha existente em `whatsapp_templates`) e mesclar.
- Mais defensivo mas mantém a inconsistência estrutural.

**Ação imediata sugerida (não incluída neste plano de análise):**
1. Confirmar com você qual opção seguir (A é mais limpa).
2. Aplicar a mudança em `usePatyTemplates` e validar nas 4 abas (Entregas, Peças, Cadência, Agendamentos).
3. Não mexer em RLS/DB — o problema é só de escopo de filtro no frontend.

### Detalhes técnicos (para referência)

- Hook consumido pela Entregas: `src/hooks/pos-vendas/usePosVendasData.ts` L64-90.
- Fonte dos gatilhos: `usePatyEntregasTemplates` em `src/hooks/pos-vendas/useEntregasData.ts` chama edge `external-webhook-proxy` endpoint `busca-paty-entrega-template` — retorna `template_id` (PRI) global por `agente_telefone`.
- Mapeamento PRI → local id: `EntregasTab.tsx` L28-37 (`priById` / `idByPri`).
- Tela de gestão que "vê tudo": `src/pages/pos-vendas/TemplatesPaty.tsx` L389-406 filtra por `pri_telefone` apenas.

### O que este plano NÃO faz
Não altera código. É só o diagnóstico pedido — aguardo aprovação (Opção A ou B) pra abrir um segundo plano de correção.