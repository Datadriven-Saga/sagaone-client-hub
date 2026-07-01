# 2. Recepção

**Perfil:** Recepcionista, Admin da loja.

A tela de Recepção existe para uma coisa só: **registrar que o cliente chegou na loja**. Isso marca o lead como "Check-in" e dispara automaticamente o fluxo de atendimento no MobiGestor.

## Três formas de fazer check-in

1. **QR Code** — o cliente escaneia o QR da recepção e confirma o próprio nome/telefone. Mais rápido, exige o cliente com celular na mão.
2. **Botão "+" (FAB)** — recepcionista digita nome e telefone manualmente. Use quando o cliente não quer escanear.
3. **Kanban de Recepção** — arrastar um lead que já estava agendado para a coluna "Check-in". Use para clientes esperados de evento.

Os três caminhos fazem exatamente a mesma coisa nos bastidores.

## Buscar cliente pelos 4 últimos dígitos

- No modal de check-in, você pode digitar só os **4 últimos números do telefone**. O sistema procura em todos os eventos ativos da loja.
- Se aparecer mais de um resultado, escolha o correto pelo nome. O telefone completo é mostrado para você conferir.
- Se estiver com o nome errado (ex.: cliente registrado como "Cliente"), dá para **editar o nome ali mesmo** antes de confirmar.
- **Se não achar ninguém:** cliente não está em nenhum evento ativo. Cadastre pelo botão "+" normalmente.

## Vendedor de atendimento (opcional)

- Ao confirmar o check-in, aparece um campo **"Vendedor que irá atender"**. Ele é **opcional**.
- Padrão: **deixar em branco**. O lead já cai automaticamente no vendedor certo dentro do MobiGestor.
- Preencha só quando você quer adiantar / passar o cliente para um vendedor específico. Nesse caso o nome vai junto para o MobiGestor.
- Dica de UX: digite parte do nome e navegue com as setas. Enter confirma a seleção sem abrir dropdown extra.

## O que acontece depois do check-in

- O lead muda para o status **Check-in** no Kanban de Prospecção.
- O MobiGestor recebe a notificação em ~10 segundos (integração externa).
- Se houver template de pós-venda ou boas-vindas configurado, ele é disparado automaticamente pela Paty.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Busca por 4 dígitos não acha um cliente que você sabe que está em evento | Confirmar a empresa ativa no topo — busca é escopada por loja. |
| Check-in não aparece no MobiGestor | Aguardar 30s. Se persistir, avisar TI (webhook externo). |
| Nome do cliente errado depois do check-in | Recepcionista edita direto no modal antes de confirmar; depois só ajuste no MobiGestor. |

> 🎥 Vídeo sugerido: *"Check-in na Recepção — QR, botão + e busca por telefone"* (P0 — pendente de gravação).