# 3. Prospecção e Kanban

**Perfis:** SDR, Vendedor, Gestor de leads.

O Kanban da Prospecção é onde a operação **trata** os leads que foram importados/convidados. Cada coluna é um status; mover o card para outra coluna é como "atualizar o status" do lead.

## Colunas / status principais

| Status | Significado |
|---|---|
| **Novo** | Lead recém-criado, ainda não trabalhado. |
| **Contato realizado** | SDR/vendedor já falou (ou tentou) com o cliente. |
| **Check-in** | Cliente chegou na loja (vem automaticamente da tela de Recepção). |
| **Venda** | Fechou. |
| **Descartado** | Não é oportunidade. |

> Regra prática: só marque "Contato realizado" depois de tentar falar com o lead. Isso alimenta os relatórios de conversão.

## SDR vs Vendedor — o que muda

**SDR:**
- Vê os leads **atribuídos a ele** dentro do evento.
- Tem limite de **30 leads em aberto**. À medida que trata (move para Contato realizado, Descartado etc.), o sistema libera espaço e ele recebe novos.
- É o dono do topo do funil.

**Vendedor:**
- Hoje o vendedor **também enxerga e mexe no Kanban** como se fosse SDR, inclusive vendo eventos onde ele não está atribuído.
- **Comportamento atual — em revisão.** No futuro o vendedor terá acesso restrito (só ao Kanban do que é dele). Enquanto isso, o combinado é: **vendedor não mexe em eventos onde não é responsável**.

**Gestor de leads:**
- Vê tudo dentro da empresa ativa.
- Consegue reatribuir leads, mudar SDR/vendedor responsável, e filtrar por qualquer critério.

## Bolinha de responsável e bolinha de temperatura

- **Bolinha do responsável** (avatar): mostra quem é o SDR/vendedor dono do lead.
- **Bolinha de temperatura** (colorida, ao lado do avatar): quente/morno/frio. Editável direto no card.
- Use temperatura para priorizar quando o volume estiver grande — o filtro do Kanban aceita buscar só por quentes.

## Filtros

- **Status:** múltipla seleção (Ctrl/⌘ + clique).
- **Responsável:** filtra por SDR/vendedor. "Sem responsável" também aparece.
- **Temperatura:** quente/morno/frio.
- **Evento:** múltipla seleção — combina eventos diferentes num mesmo Kanban.

Se o Kanban abrir vazio, quase sempre é filtro herdado da sessão anterior. Limpe tudo (botão "Limpar filtros") e recomece.

## Anotações

- Anotação é do **lead** (contato), não do evento. Se o cliente aparece em três eventos, a mesma anotação segue ele.
- Sempre datada e assinada. Use para deixar contexto para o próximo colega que pegar o lead.

## Regras práticas

- Mover um lead para **Check-in** manualmente **dispara integração com o MobiGestor** — só use quando o cliente realmente chegou.
- Mover para **Descartado** libera espaço no limite de 30 do SDR.
- Se o lead tem template de WhatsApp associado e você mudar o status, o webhook externo é chamado automaticamente (sincroniza com MobiGestor e outros sistemas).

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Não consigo mover para Contato realizado (botão travado) | Lead com mais de 24h e sem interação — regra de segurança. Fale com gestor. |
| Card sumiu do Kanban | Filtro ativo escondendo — limpar filtros. |
| SDR estourou 30 leads | Priorizar tratamento; sistema libera à medida que status muda. |
| Vejo evento que não é meu (vendedor) | Comportamento atual conhecido — não mexer, aguardar ajuste de acesso. |

> 🎥 Vídeo sugerido: *"Kanban do SDR — mover leads, temperatura, filtros"* (P0 — pendente de gravação).