# Plano — Botão "Criar Lead" no Kanban de Atendimento

Replicar a lógica oficial de criação de leads (edge `create-lead` + webhook `criacao_lead`) dentro do fluxo do Kanban, mantendo a UX em steps e adicionando proteção contra "roubo" de lead em evento ativo.

---

## 1. Edge `create-lead` — Normalização canônica de telefone

**Arquivo:** `supabase/functions/create-lead/index.ts`

Substituir o `telefone.replace(/\D/g, '')` pela mesma normalização do `process-import` / `bulk_upsert_contatos`:

- Remove tudo que não é dígito
- Remove DDI `55` quando o número começa com 55 e tem 12/13 dígitos
- Remove o 9º dígito de celular (quando DDD + 11 dígitos)
- Resultado canônico: **10 dígitos** (DDD + 8)

A query de duplicidade passa a usar esse valor normalizado, garantindo match independente de máscara.

> Reusar a função já existente em `src/lib/phoneUtils.ts` portada para a edge (cópia inline em Deno — sem import do `src/`).

---

## 2. Edge `create-lead` — Checagem de evento ativo no 409

Hoje o 409 só retorna `{ lead_id, contato_id, nome, status }`. Estender para incluir contexto de propriedade:

```text
409 {
  error: "Lead já existe...",
  lead_existente: {
    lead_id, contato_id, nome, status,
    responsavel_email,
    evento_ativo: {            // null se não houver
      prospeccao_id,
      prospeccao_nome,
      encerrada: boolean
    }
  }
}
```

Lógica server-side:
1. Buscar `eventos_prospeccao` do contato JOIN `prospeccoes`
2. Considerar "ativo" se `prospeccoes.encerrada = false` (ou regra equivalente já usada no projeto — verificar no schema antes de implementar)
3. Retornar o evento mais recente

Isso evita criar um RPC novo só para isso e mantém a checagem em um único lugar.

---

## 3. Frontend — `NovoLeadModal` adaptado

**Arquivo:** `src/components/NovoLeadModal.tsx` (refatorar o componente atual, mantendo a UX de steps)

### 3.1. Step `phone` (checagem)
- Continuar fazendo o pré-check client-side (para abrir step `form` direto quando não existe), **mas a fonte de verdade vira a edge**.
- Quando duplicado é encontrado:
  - Se responsável é o próprio usuário → abre contato (igual hoje).
  - Se responsável é outro **e há evento ativo não encerrado** → step `owner-message` com texto:
    > "Este lead já está sendo atendido por **{nome}** no evento **{evento}**. Solicite ao gerente a transferência."
    Sem botão de criar.
  - Se responsável é outro **mas o evento já encerrou** (ou não há evento vinculado) → segue para `form`, mostrando aviso suave: "Lead existia no evento encerrado X — será atribuído a você no evento atual."

### 3.2. Step `form` (submit)
- Trocar o `supabase.from('contatos').insert(...)` por `supabase.functions.invoke('create-lead', { body: {...} })`.
- Payload:
  ```text
  {
    nome, telefone, email, observacoes,
    origem,
    empresa_id: activeCompany.id,
    responsavel_email: user.id,
    status: 'Atribuído',
    prospeccao_id: <evento ativo do usuário no kanban> | undefined
  }
  ```
- Tratar resposta 409 como caso de "owner-message" (pode acontecer race condition entre check e submit).
- Tratar 201 → toast sucesso + `onLeadCreated()`.

### 3.3. `prospeccao_id` do evento ativo
- Passar como prop nova (`activeProspeccaoId?: string`) vinda do componente do Kanban que abre o modal.
- Se ausente → omite do payload (lead fica sem vínculo, comportamento graceful).

---

## 4. Pontos fora de escopo

- Não alterar `process-import` nem `bulk_upsert_contatos`.
- Não mexer em outros lugares que ainda fazem `insert` direto em `contatos` (fora do kanban).
- Sem migrations: toda lógica nova vive na edge + front.

---

## Detalhes técnicos

- **Normalização** (Deno, inline na edge):
  ```text
  function normalizePhone(raw: string): string {
    let d = (raw || '').replace(/\D/g, '');
    if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    if (d.length === 11) d = d.slice(0, 2) + d.slice(3); // remove 9º dígito
    return d;
  }
  ```
- **Query de evento ativo** na edge: usar `supabaseClient` com service role; selecionar `eventos_prospeccao` por `contato_id`, JOIN `prospeccoes(id, nome, encerrada)`, ordenar por `created_at desc`, limitar 1.
- **Verificar antes de codar**: o nome real da coluna que indica "evento encerrado" em `prospeccoes` (pode ser `encerrada`, `status`, `data_fim`...). Faço um `read_query` rápido no início da implementação.
- **Reaproveitar** o tratamento de auth do `create-lead` (JWT do usuário já funciona via `supabase.functions.invoke`, sem precisar de admin token).

---

## Verificação

1. Criar lead novo no kanban → confirma 201 + webhook `criacao_lead` disparado (checar logs `trigger-webhook`).
2. Criar com telefone duplicado, evento ativo, outro dono → modal bloqueia com mensagem do gerente.
3. Criar com telefone duplicado, evento encerrado, outro dono → permite criar/vincular.
4. Criar com telefone duplicado, mesmo dono → abre contato.
5. Variações de máscara do telefone (com/sem DDI, com/sem 9º dígito) caem no mesmo registro.
