## Problema

O navegador bloqueia (CSP `connect-src`) chamadas diretas do frontend para `https://automatemaiawh.sagadatadriven.com.br`. Por isso o toggle de ativar/desativar pós-vendas falha, e os 3 outros webhooks (`busca_config_pos`, `config_gerais`, `upsert_ranges`) só funcionam por acidente/cache — todos violam a CSP igual.

Regra do projeto: chamadas externas devem passar pelo edge function proxy `external-webhook-proxy` (padrão já usado no restante do sistema, ex.: `CadenciaLigacaoConfig`, `EnvioMensagemConfig`).

## Correção

Arquivo único: `src/components/pos-vendas/ConfiguracoesPosVendasTab.tsx`.

Substituir os 4 `fetch(...)` diretos por chamadas ao proxy no modo genérico (`webhook_url`), via `supabase.functions.invoke('external-webhook-proxy', { body: { webhook_url, webhook_method, ...payload } })`. O proxy já:
- valida o domínio (`automatemaiawh.sagadatadriven.com.br` está no allowlist),
- injeta o header `saga_one_supabase` (SAGA_ONE) automaticamente — logo o código deixa de manipular token manualmente,
- retorna JSON parseado.

Mapeamento:

| Ação | URL atual (mantida) | Método |
|---|---|---|
| Buscar config | `.../webhook/busca_config_pos` | POST |
| Salvar config geral | `.../webhook/config_gerais` | POST |
| Salvar faixas de KM | `.../webhook/upsert_ranges` | POST |
| Alterar status pós-vendas | `.../webhook/altera_status_pos_vendas` | POST |

Comportamento visível para o usuário permanece igual: mesmos payloads, mesmos toasts, mesmo optimistic update do toggle com rollback em erro. Só muda o transporte (proxy em vez de fetch direto), o que remove o erro de CSP e destrava o toggle.

## Validação

1. Recarregar a tela `/pos-vendas/configuracoes` — buscar config deve popular sem erro de CSP no console.
2. Alternar o Switch "Pós-vendas ativo/inativo" — sem erro de CSP; toast de sucesso ou rollback com toast de erro se o n8n devolver falha (esperado enquanto os workflows n8n ainda estiverem quebrados, como diagnosticado antes).
3. Botões "Salvar configurações" e "Salvar faixas de KM" — mesmo comportamento via proxy.
4. Conferir no console que não há mais `Refused to connect ... automatemaiawh`.

Observação: se algum webhook continuar respondendo `Error in workflow`, isso é problema do n8n (já documentado em testes anteriores), não deste fix. O objetivo aqui é apenas remover o bloqueio de CSP e uniformizar o transporte.
