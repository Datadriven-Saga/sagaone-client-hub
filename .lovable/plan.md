# Apagar 7 templates sincronizados para re-sync com o fix

Estado atual em `whatsapp_templates`:

| id_pri | nome | formato | imagemUrl |
|--------|------|---------|-----------|
| 1685 | entrega_agendada_test | imagem | `"h"` ❌ |
| 1684 | teste2 | imagem | URL válida ✅ |
| 1683 | agendamento_confirmado_v2 | botao | — |
| 1679 | aviso_24h_v2 | imagem | `"4"` ❌ |
| 1677 | boas_vindas_v3 | texto | — |
| 1676 | vamos_agendar_test | texto | — |
| 1675 | prep_veiculo_test_v2 | texto | — |

Conforme pedido ("pode fazer isso para todos esses... vou rodar todos novamente"), excluir os 7 registros para que reapareçam na lista "Templates só na Meta" e sejam re-sincronizados pelo UI já corrigido (merge com `meta.components` quando o webhook devolve URL inválida).

## Ação

`DELETE FROM public.whatsapp_templates WHERE id IN (<7 ids>)` via insert tool.

## Validação

Após o delete:
- Os 7 templates voltam a aparecer no card "Sincronizar templates da Meta".
- Re-sincronizar cada um pelo botão do UI.
- Conferir no banco que `card_data.imagemUrl` (quando formato=imagem) é URL `https://...` completa.
