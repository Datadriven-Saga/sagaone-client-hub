## Objetivo

1. Documentar como o check-in funciona hoje no SagaOne (QR, busca por telefone, Kanban, webhooks).
2. Permitir que a Recepção busque um contato pelos **últimos 4 dígitos do telefone** (além do telefone completo já suportado).

---

## Parte 1 — Documentação

Criar `docs/fluxo-checkin-recepcao.md` cobrindo todos os pontos de entrada e efeitos colaterais. Estrutura:

### 1. Pontos de entrada
- **FAB global** (`DashboardLayout` → `RecepcaoModal`): busca por telefone completo, fluxo multi-prospecção.
- **QR Code** (`QRCodeScanner` na página `/recepcao`): scan → `registrarCheckin` single-event.
- **Kanban** (`Prospeccao.tsx`): drag-and-drop do card para a coluna Check-in.
- **Recepção página `/recepcao`**: lista paginada de visitas + filtros por evento/status.

### 2. Fluxo "Buscar por telefone" (multi-prospecção)
Sequência atual em `useRecepcaoData.buscarContatoMultiAtivo`:
1. Lista prospecções da empresa com `data_inicio <= now()` e `data_fim >= now()-3d` (tolerância de 3 dias).
2. Gera variações do telefone (9º dígito, DDI 55) via `phoneUtils.generatePhoneVariations` + variantes com prefixo `55`.
3. Faz `SELECT contatos WHERE empresa_id=? AND telefone IN (variações)` e refina por `phonesMatch` (formato).
4. Busca vínculos em `eventos_prospeccao` para essas prospecções.
5. Conta `totalLeads` por prospecção e monta `MultiCheckinData`.

### 3. Fluxo de confirmação (`CheckinConfirmModal` → `registrarCheckinMulti`)
- Pré-seleciona a prospecção com **maior base** entre as que já têm o contato (fallback: maior base geral).
- Para cada prospecção selecionada:
  - Se novo: cria `contatos` (status Check-in) + insere `eventos_prospeccao (tipo=Contato Inicial)`.
  - Se existente: `UPDATE contatos.status='Check-in'`.
  - Idempotência: se já existe `recepcao_visitas` desse telefone+evento no dia → pula.
  - Insere `logs_movimentacao_contatos` e `recepcao_visitas`.
  - Dispara webhook `movimentacao_lead_kanban` (fire-and-forget no FE + trigger SQL `trg_dispatch_movimentacao_lead_webhook` server-side, gated por feature flag `webhook_movimentacao_lead`).

### 4. Fluxo QR Code (`registrarCheckin`)
- Single-event: `verificarCheckinExistente` no evento → cria/atualiza contato → log → visita → webhook.

### 5. Efeitos colaterais
- `logs_movimentacao_contatos` aciona trigger PG → `pg_net` → `trigger-webhook` (header `saga_one_supabase`) → Lambda MobiGestor (sync de lead para a loja, somente eventos **Mensal/Grande Evento** com flag ativa).
- `contatos.status` é global (débito conhecido); atualizar para Check-in afeta visualização em todas as prospecções.
- `eventos_prospeccao` aceita múltiplas linhas por par (contato, prospecção) — sempre dedupe na leitura.

### 6. Permissões
- Acesso à Recepção restrito a Admin/Recepcionista (ver memory `recepcao-access-roles`).
- RLS de `recepcao_visitas` por `empresa_id`.

### 7. Diagrama (ASCII)
```text
[FAB] -> RecepcaoModal -> buscarContatoMultiAtivo
                              |
                              v
                    CheckinConfirmModal
                              |
                              v
                    registrarCheckinMulti
                       |     |     |
                contatos  logs_mov  recepcao_visitas
                              |
                              v (trigger PG, flag check)
                       trigger-webhook -> Lambda MobiGestor
```

### 8. Atualizar `mem://index.md`
- Adicionar referência: `[Fluxo Check-in](mem://features/recepcao/fluxo-checkin) — pontos de entrada (FAB/QR/Kanban), multi-prospecção, idempotência por dia, webhook MobiGestor`.
- Criar arquivo `mem://features/recepcao/fluxo-checkin.md` resumido apontando para o doc.

---

## Parte 2 — Busca por 4 últimos dígitos

### UX em `RecepcaoModal`
- Trocar input "Telefone" por um único campo "Telefone ou 4 últimos dígitos" com placeholder `(00) 00000-0000 ou 1234`.
- Manter máscara `formatPhone` apenas quando o usuário digitar **5+ dígitos**. Com 4 dígitos puros, exibir sem máscara.
- Habilitar botão "Buscar" quando `digits.length === 4` **ou** `digits.length >= 10`.
- Adicionar legenda: "Use o telefone completo ou apenas os 4 últimos dígitos do celular".

### Hook `buscarContatoMultiAtivo`
Adicionar parâmetro `modo: 'full' | 'last4'` (ou detectar pelo tamanho).

- **Caminho `full` (atual):** inalterado.
- **Caminho `last4`:**
  1. Listar prospecções ativas (mesma janela de 3 dias).
  2. `SELECT id, nome, telefone FROM contatos WHERE empresa_id=? AND right(regexp_replace(telefone,'\D','','g'), 4) = <last4>` — implementar via RPC nova `buscar_contatos_por_sufixo_telefone(empresa_id, sufixo)` para evitar carregar tudo no cliente e usar índice funcional.
  3. Se 0 resultados → toast "Nenhum contato encontrado com final 1234".
  4. Se **>1 contato** → abrir um seletor (novo passo no `CheckinConfirmModal` ou modal intermediário) listando: nome, telefone mascarado `(**) ****-1234`, total de prospecções ativas vinculadas. Após escolher 1, segue o fluxo normal com o telefone completo desse contato.
  5. Se 1 contato → usa o telefone real desse contato e segue o fluxo multi-prospecção normal.

### Migration
```sql
-- Índice funcional para acelerar a busca por sufixo
CREATE INDEX IF NOT EXISTS idx_contatos_tel_last4
  ON public.contatos (empresa_id, right(regexp_replace(telefone,'\D','','g'), 4));

-- RPC SECURITY DEFINER respeitando RLS via empresa_id explícito
CREATE OR REPLACE FUNCTION public.buscar_contatos_por_sufixo_telefone(
  p_empresa_id uuid,
  p_sufixo text
) RETURNS TABLE(id uuid, nome text, telefone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT c.id, c.nome, c.telefone
  FROM public.contatos c
  WHERE c.empresa_id = p_empresa_id
    AND right(regexp_replace(coalesce(c.telefone,''),'\D','','g'), 4) = p_sufixo
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_contatos_por_sufixo_telefone(uuid, text) TO authenticated;
```

(Aplica check de acesso à empresa via `user_can_access_empresa(p_empresa_id, auth.uid())` dentro da função — alinhado ao padrão registrado em memory.)

### Componente novo — `RecepcaoMultiContatoPicker`
- Renderizado pelo `DashboardLayout` quando o resultado do `last4` traz >1 contato.
- Cards com nome + telefone mascarado + botão "Selecionar".
- Botão "Cancelar" volta para o modal de busca.

### Arquivos afetados
- `src/components/RecepcaoModal.tsx` — input flexível + validação.
- `src/hooks/useRecepcaoData.ts` — novo método `buscarContatosPorSufixo` + ajuste de `buscarContatoMultiAtivo` para aceitar contato já resolvido.
- `src/components/DashboardLayout.tsx` — estado intermediário para escolha do contato.
- Nova migration (índice + RPC).
- `docs/fluxo-checkin-recepcao.md` — documentar também o caminho por sufixo.

### Validação
- Buscar por 4 dígitos retornando 0 / 1 / N contatos.
- Buscar por telefone completo continua igual.
- Telefones armazenados com e sem DDI / com e sem 9º dígito — todos batem porque o índice normaliza.
- Check-in subsequente registra `recepcao_visitas` e dispara webhook.

---

## Fora de escopo

- Não tocar em `bulk_upsert_contatos`, quarentena, ou nas estruturas de `contatos.status` / `eventos_prospeccao`.
- Sem mudança no fluxo do QR Code ou Kanban.