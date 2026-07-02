# 3. Prospecção e Kanban

**Perfis:** SDR, Vendedor, Gestor de leads.

O Kanban da Prospecção é onde a operação **trata** os leads que foram importados/convidados. Cada coluna é um status; mover o card para outra coluna é como "atualizar o status" do lead.

## Colunas do Kanban (status reais)

Da esquerda para a direita, na ordem que aparece na tela:

| Coluna | Status interno | Significado |
|---|---|---|
| **Novos** | `Novo` | Recém-importado, ainda sem tratamento. |
| **Atribuídos** | `Atribuído` | Vinculado a um SDR/vendedor, ainda sem contato feito. |
| **Em Espera** | `Em Espera` | Contato realizado, cliente ainda não decidiu. |
| **Convidados** | `Convidado` | Confirmou interesse — vai ao evento. |
| **Confirmados** | `Confirmado` | Confirmação registrada (fluxo de confirmação de presença via link/WhatsApp). |
| **Check-ins** | `Check-in` | Presente na loja (cai aqui automático pela Recepção). |
| **Vendas** | `Venda` | Fechou negócio. |
| **Descartados** | `Descartado` | Sem interesse / não vai. |
| **Opt Out** | `Opt Out` | Pediu para não receber mais contato daquela marca/canal. |

> `contatos.status` é **global** — o mesmo lead em vários eventos aparece com o mesmo status em todos. Débito arquitetural conhecido, não é bug de tela.

## Botão "Contato Realizado" — o que cada opção faz

Ao clicar em **Contato Realizado** no card, abre um modal com 5 opções. Cada uma move o lead para um status e grava uma anotação padronizada na timeline:

| Opção | Move para | Efeito |
|---|---|---|
| ✅ **O cliente VAI PARTICIPAR** | `Convidado` | Card vai para a coluna Convidados; dispara webhook de movimentação para o Mobi. |
| 📞 **Registrar apenas contato** | `Em Espera` | Marca que houve contato, sem decisão do cliente ainda. |
| 📵 **Tentativa sem sucesso** | `Em Espera` | Registra tentativa (não atendeu, caixa postal, número errado). Lead continua ativo. |
| ❌ **O cliente NÃO VAI PARTICIPAR** | `Descartado` | Sai do funil ativo, libera slot do SDR (30 leads). |
| 🔕 **O cliente solicitou Opt Out** | `Opt Out` | Abre modal regulatório (marca + UF + canal) e grava em quarentena — o cliente **não recebe mais nada** daquela marca/canal, valendo para qualquer loja da mesma marca. |

Toda opção grava uma anotação prefixada (`✅ CLIENTE VAI PARTICIPAR`, `📞 CONTATO REALIZADO`, `📵 TENTATIVA SEM SUCESSO`, `❌ CLIENTE NÃO VAI PARTICIPAR`, `🔕 OPT OUT SOLICITADO`) + o texto livre que o SDR digitar. Isso vira histórico permanente do lead.

## SDR vs Vendedor — regra e realidade atual

**Regra de negócio (como deveria ser):** tanto SDR quanto Vendedor só devem enxergar e mexer nos **leads atribuídos a eles**. Nada de eventos de terceiros, nada de aba de configuração.

**Como está hoje:** existe um **gap de controle de acesso** — SDR e Vendedor conseguem ver abas e filtros do sistema que não deveriam aparecer para eles (por exemplo: eventos onde não são responsáveis aparecem no seletor de eventos do Kanban). Está mapeado para ajuste nas **Permission Flags** em breve.

**Combinado operacional enquanto o acesso não é ajustado:** se você não é o responsável, **não mexe**. Movimentações erradas ficam na timeline com seu nome.

**Limite do SDR:** 30 leads em aberto (Atribuído + Em Espera). Vai liberando à medida que trata (move para Convidado, Descartado, Opt Out etc.) — não precisa "zerar" nada manualmente.

**Gestor de leads / CRM / Admin / Master:** vê tudo da empresa ativa, reatribui, muda responsável e filtra por qualquer critério.

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

## Histórico de atendimento do lead

Abrindo o card do lead, na aba de **Histórico** (timeline), você vê toda a vida dele em ordem cronológica — do mais recente para o mais antigo.

O que entra na timeline:

- **Mudanças de status** (quem moveu, de onde para onde, quando).
- **Anotações** (as do "Contato Realizado" e as digitadas manualmente).
- **Disparos de WhatsApp** (template enviado, resposta recebida).
- **Atribuição de responsável** (quando o lead troca de dono).
- **Propostas** (quando o Mobi devolve código de proposta).
- **Entrada/saída de quarentena**.
- **Venda registrada**.

Cada item mostra ícone, descrição, **autor** e "há X tempo" (passando o mouse aparece a data/hora exata). A timeline carrega 20 por vez — botão **Carregar mais** no fim.

> Importante: **anotação e timeline pertencem ao lead**, não ao evento. Se o mesmo cliente aparece em três eventos diferentes, todos os três compartilham o mesmo histórico. Isso é bom (contexto sempre disponível) e exige cuidado (o próximo colega vai ler o que você escrever).

## Pri (IA) movimentando leads

A Pri é uma **usuária do sistema** — tem um ID próprio (`Pri IA`) e aparece no Kanban como qualquer atendente humano. Ela pode assumir e movimentar leads sozinha.

Quando ela atua:

- **Assume o lead** quando ele chega `Novo` e sem responsável (via integração `create-lead-pri`). Se já tem gente atribuída, ela **não mexe**.
- **Move o lead** conforme a conversa evolui (por exemplo: cliente respondeu no WhatsApp → move para Em Espera; confirmou presença → move para Convidado).
- Na timeline aparece como autora: *"Pri IA moveu de Novo para Em Espera"*, com avatar próprio.
- **Não dispara webhook do Mobi** nas movimentações dela — é intencional, evita eco duplo com o próprio Mobi/n8n que já alimenta o sistema. A movimentação fica registrada normalmente em `logs_movimentacao_contatos`.

**O que o usuário vê na prática:** um card mudou de coluna sem ninguém ter tocado, e na timeline aparece Pri IA como autora. Não é bug — é a IA trabalhando.

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
| Vejo evento/aba que não deveria ver (SDR/Vendedor) | Gap de controle de acesso conhecido — **não mexer**, aguardar ajuste nas Permission Flags. |
| Card mudou de coluna sozinho | Provavelmente foi a Pri — conferir na timeline. |

> 🎥 Vídeo sugerido: *"Kanban do SDR — mover leads, temperatura, filtros"* (P0 — pendente de gravação).