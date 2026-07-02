## Ajustes no Cap. 3 — Prospecção e Kanban

Reescrever `docs/operacoes/manual-do-usuario/03-prospeccao-kanban.md` corrigindo as imprecisões e adicionando seções pedidas. Sem mudanças em outros arquivos.

### Correções

**1. Colunas reais do Kanban** (substituir a tabela atual pelo que existe em `Prospeccao.tsx` linhas 1942-1952):

| Coluna | Status | Significado |
|---|---|---|
| Novos | `Novo` | Recém-importado, sem tratamento. |
| Atribuídos | `Atribuído` | Vinculado a um SDR/vendedor, ainda sem contato. |
| Em Espera | `Em Espera` | Contato realizado, cliente ainda não decidiu. |
| Convidados | `Convidado` | Confirmou interesse — vai ao evento. |
| Confirmados | `Confirmado` | Confirmação registrada (fluxo de confirmação de presença). |
| Check-ins | `Check-in` | Presente na loja (vem da Recepção). |
| Vendas | `Venda` | Fechou negócio. |
| Descartados | `Descartado` | Sem interesse / não vai. |
| Opt Out | `Opt Out` | Pediu para não receber mais contato. |

**2. Botão "Contato Realizado" — o que cada opção faz** (do `ContatoRealizadoDialog.tsx`):

| Opção | Novo status | Efeito |
|---|---|---|
| ✅ Cliente VAI PARTICIPAR | `Convidado` | Move para Convidados; dispara webhook de movimentação (Mobi). |
| 📞 Registrar apenas contato | `Em Espera` | Só marca que houve contato, sem decisão. |
| 📵 Tentativa sem sucesso | `Em Espera` | Registra tentativa (não atendeu, caixa postal), fica em espera. |
| ❌ Cliente NÃO VAI PARTICIPAR | `Descartado` | Sai do funil ativo, libera slot dos 30 do SDR. |
| 🔕 Cliente pediu Opt Out | `Opt Out` | Abre modal regulatório (marca+UF+canal), grava em `contato_quarentena` global daquela marca/canal. |

Todas gravam anotação com prefixo padronizado (`✅ CLIENTE VAI PARTICIPAR`, `📞 CONTATO REALIZADO`, etc.) na timeline do contato.

**3. SDR vs Vendedor — corrigir**

Reescrever a seção: hoje, **por regra de negócio**, SDR e Vendedor só devem ver leads atribuídos a eles. O que existe hoje é um **gap de controle de acesso**: eles conseguem enxergar abas/telas que não deveriam (ex.: eventos não atribuídos aparecem nos filtros). Está mapeado para ajuste nas Permission Flags. Combinado operacional enquanto não é ajustado: **não mexer no que não é seu**.

### Novas seções

**4. Histórico de atendimento do lead** — como funciona hoje
- Aba/painel no modal do contato usa `ContatoTimeline` → RPC `get_contato_timeline`.
- Agrega em ordem cronológica: mudanças de status (`logs_movimentacao_contatos`), anotações (`contato_anotacoes`), disparos de WhatsApp, atribuição de responsável, propostas, entrada/saída de quarentena, venda.
- Cada item mostra: ícone por tipo, descrição, autor, "há X tempo" (tooltip com data/hora exata).
- Paginação de 20 em 20 ("Carregar mais").
- Ponto importante para o usuário: **anotação pertence ao lead**, não ao evento — se o mesmo cliente aparece em 3 eventos, a mesma timeline segue ele.

**5. Pri no Kanban** — como aparece
- A Pri (IA) é um usuário de sistema (`PRI_IA_USER_ID`) que pode mover leads no Kanban como qualquer atendente.
- Quando ela move: aparece na timeline como autor "Pri IA" (avatar próprio), com ícone de mudança de status.
- **Silenciada no webhook do Mobi** — movimentações da Pri não disparam webhook de movimentação para o Mobi (evita eco), mas ficam registradas em `logs_movimentacao_contatos` normalmente.
- Só atua em leads onde `responsavel_email IS NULL` e status `Novo` (via `create-lead-pri`); depois de assumir, ela pode movimentar conforme a conversa evolui.
- Na prática o usuário vê: card mudou de coluna sozinho, timeline mostra "Pri IA moveu de X para Y".

**6. Manter/atualizar**
- Preservar bloco de "Bolinha de responsável / temperatura", "Filtros", "Regras práticas" e "Se algo der errado" — apenas ajustar entradas que mencionavam SDR/vendedor incorretamente.
- Placeholder `> 🎥 Vídeo sugerido` ao final permanece.

### Fora de escopo
- Não alterar código de permissões nem outros capítulos do manual. O ajuste de acessos SDR/Vendedor entra em outro plano quando o usuário pedir.
