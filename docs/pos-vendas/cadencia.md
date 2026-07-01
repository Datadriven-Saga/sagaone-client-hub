# Pós-Vendas — Cadência conversacional Paty

**Área:** Pós-Vendas
**Público-alvo:** ambos
**Última revisão:** 2026-07-01

## O que é

Rota `/pos-vendas/paty/cadencia` — define a **cadência conversacional** da Paty: sequência de mensagens de continuidade enviadas ao lead após um gatilho inicial (ex.: "cliente não respondeu em 24h → segundo toque; ainda sem resposta em 48h → terceiro toque").

Diferente de Peças/Entregas (que reagem a eventos externos), a Cadência é uma **timeline própria** dentro da Paty, controlada por `paty_cadencia_config` + `paty_cadencia_steps`.

## Fluxo funcional (para usuário)

1. Selecionar agente Paty.
2. Definir **configuração base** da cadência: template inicial, canal, opção de encerrar ao receber resposta.
3. Adicionar **passos** (steps) — cada passo tem:
   - Ordem (1, 2, 3…).
   - Delay em horas/dias desde o passo anterior.
   - Template Paty aprovado.
   - Condição de parada (opcional: só envia se lead ainda em determinado status).
4. Salvar — persistência é otimista, envia upsert para a stack Paty externa.

## Detalhes técnicos

- **Página:** `src/pages/pos-vendas/PatyCadencia.tsx`.
- **Componente:** `src/components/pos-vendas/CadenciaConversacionalTab.tsx`.
- **Hook:** `usePosVendasData` (`upsert-paty-cadencia-config-template`, `upsert-paty-cadencia-steps`).
- **Edge Function:** `external-webhook-proxy` — endpoints:
  - `get-paty-cadencia-config`
  - `upsert-paty-cadencia-config-template`
  - `get-paty-cadencia-steps`
  - `upsert-paty-cadencia-steps`
- **Agente:** `AgenteSelector` filtra `agentes_ia` vinculados à empresa.
- **Cache local:** hook mantém steps em memória; commit em batch ao clicar Salvar.

## Regras de negócio

- Cadência **por agente** (não por gatilho). Alterar afeta todos os leads em conversa com aquela Paty.
- Delay mínimo entre passos = 1h (limite Meta / anti-spam).
- Passo com template pausado é **pulado** pela Paty (não bloqueia o próximo).
- Reordenação renumera todos os passos.

## Erros comuns

| Sintoma | Causa | Ação |
|---------|-------|------|
| Salvar retorna erro | n8n / banco Paty fora | Retentar; se persistir, alertar infra. |
| Passo não dispara | Template pausado ou condição de parada satisfeita | Trocar template; revisar regra de parada. |
| Duplicidade de mensagem | Cadência ligada + gatilho de Entrega ativo | Coordenar — Paty não deduplica automaticamente entre módulos. |

## Relacionado

- [Paty Templates](./paty-templates.md)
- [Entregas](./entregas.md) — cadeia de templates (não confundir com Cadência).
- [Visão geral](./visao-geral.md)