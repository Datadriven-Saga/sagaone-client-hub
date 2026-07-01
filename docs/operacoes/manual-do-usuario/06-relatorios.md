# 6. Relatórios

**Perfis:** Gestor de leads, CRM, Admin.

O módulo **Resultados** mostra o que aconteceu com as campanhas — quem foi convidado, quem respondeu, quem virou venda. Todo relatório respeita a **empresa ativa** no topo (troque antes de gerar).

## Dashboards

- **WhatsApp:** taxa de entrega, respostas, custo agregado, quebra por template.
- **Ligação (IA):** número de tentativas, contatos efetivos, custo por chamada.
- **Prospecção geral:** funil de status (Novo → Contato → Check-in → Venda).

Todos os cards são clicáveis: clicar num número abre o detalhamento com os leads que compõem aquela métrica.

## Relatório de Convidados

- Menu **Resultados → Relatórios → Convidados**.
- Mostra **quem foi convidado**, **por qual canal** e **qual foi o status final** dentro de um evento.
- Contagem é **distinta por contato** — se o mesmo cliente aparece em 3 mensagens, conta 1.
- Filtros: período, evento, canal (WhatsApp / Ligação / Manual), status final.
- Exportação em Excel disponível no botão superior direito.

## Regras importantes de leitura

- **Convidado ≠ Impactado.** Convidado é quem entrou na base; impactado é quem recebeu a mensagem.
- **Check-in** só entra nos relatórios de conversão quando registrado pela Recepção — não conta status manual arbitrário.
- Dashboards de WhatsApp usam contagem do **webhook oficial**, não da tabela local — pode divergir em ~1min do que a Meta reporta.

## Exportação

- Botão **"Exportar"** gera XLSX com as linhas atualmente filtradas na tela.
- Não exporte "tudo sem filtro" para evento grande — pode passar de 100k linhas e travar o Excel. Filtre por período primeiro.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Número diverge do que vejo no Kanban | Confirmar mesmo período e mesma empresa ativa nos dois lados. |
| Relatório vazio | Filtro muito estreito ou empresa errada. |
| Exportação demora ou trava | Reduzir período; exportar em pedaços. |
| Dashboard WPP diverge da Meta | Aguardar 1–2 min de defasagem do webhook. |

> 🎥 Vídeo sugerido: *"Relatório de Convidados + dashboards"* (P1 — pendente de gravação).