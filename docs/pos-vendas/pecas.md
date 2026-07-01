# Pós-Vendas — Peças

**Área:** Pós-Vendas
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Aba `/pos-vendas/pecas` — configura os templates Paty disparados quando o sistema de Peças aciona gatilhos (agendamento criado, peça entregue, follow-up pós-retirada, etc.). Diferente de Entregas, o mapeamento **slug ↔ template** é 1:1 (não suporta cadeia sequencial).

## Fluxo funcional (para usuário)

1. Selecionar o **agente Paty** no `AgenteSelector`.
2. Na tab **Lojas**, associar cada loja ao número WhatsApp responsável.
3. Na tab **Gatilhos**, para cada slug ver:
   - Template atual vinculado (Select limitado a templates aprovados da empresa).
   - Toggle **Ativo/Inativo**.
   - Prazo (dias) quando aplicável.
4. Trocar o template ou o toggle — a alteração é enviada imediatamente para a stack Paty externa. Toast confirma sucesso ou reporta erro do n8n.

## Detalhes técnicos

- **Páginas:** `src/pages/pos-vendas/PecasGatilhos.tsx`, `PecasLojas.tsx`.
- **Componentes:** `src/components/pos-vendas/PecasTab.tsx`, `PecasLojasSection.tsx`, `PecasTemplatesSection.tsx`, `TemplateSelectApproved.tsx`.
- **Hook:** `src/hooks/pos-vendas/usePecasData.ts` (`usePatyPecasTemplates`, `usePatyPecasPrazo`, mutations).
- **Slugs fixos:** definidos no hook (7 slugs; nomes variam entre `agendamento_*`, `entrega_pecas_*`, `retirada_pecas_*`).
- **Edge Function:** `external-webhook-proxy` com `endpoint`:
  - `upsert-paty-pecas-template` — mapeia template PRI ao slug.
  - `upsert-paty-pecas-prazo` — ajusta prazo em dias.
  - `get-paty-pecas-templates` — fetch inicial.
- **Payload padrão:** `{ endpoint, agente_telefone, empresa_id, gatilho, template_id, ativo }` + campo `gatilho` (redundante com `slug`) enviado explicitamente para o n8n rotear.
- **Templates aprovados:** `TemplateSelectApproved` filtra por `empresa_id` + `status = APPROVED` + share via `id_meta` (ver memory `whatsapp-template-sharing`).

## Regras de negócio

- Um slug **sempre** aponta para no máximo 1 template ativo. Trocar substitui — não versiona.
- Toggle desligado **não apaga** o mapeamento — mantém `template_id` mas com `ativo=false` (permite reativar sem reconfigurar).
- Prazo default varia por slug; alterar sem coordenação com Peças pode causar disparos inesperados.
- Se o template for pausado pela Meta, a Paty **não dispara** — mas o toggle no SagaOne continua "Ativo". Corrigir manualmente vinculando outro template aprovado.

## Erros comuns

| Sintoma | Causa | Ação |
|---------|-------|------|
| Toast "Erro ao atualizar template" | n8n retornou 500 (backend Paty fora) | Reportar ao time de infra Paty; tentar novamente em minutos. |
| "Template não vinculado" ao ativar toggle | `template_id` está nulo | Escolher um template antes de ativar. |
| Select vazio de templates | Empresa não tem templates aprovados para aquele agente/número | Aprovar template Meta antes; verificar `agente_empresas`. |
| Configuração some após F5 | Fetch inicial falhou silenciosamente | Ver console para erro do `get-paty-pecas-templates`. |

## Relacionado

- [Entregas](./entregas.md) — mesmo padrão + multi-template.
- [Paty Templates](./paty-templates.md)
- [Visão geral](./visao-geral.md)