# Plano — Manual do Usuário (Fase 3 expandida)

Só documentação. Nenhuma alteração de código/DB.

## Estrutura final (`docs/operacoes/manual-do-usuario/`)

Reescrevo os esqueletos existentes e crio o que falta. Tom: direto, chão-de-loja, markdown puro. Cada capítulo termina com bloco `> 🎥 Vídeo sugerido: ...` (placeholder — não há vídeo ainda, só a marcação).

```text
README.md                     (índice + matriz perfil × capítulo — atualizar)
01-primeiros-passos.md        (SSO, empresa ativa, timeout — expandir)
02-recepcao.md                (check-in QR/FAB, 4 dígitos, vendedor opcional)
03-prospeccao-kanban.md       (Kanban, status, temperatura, filtros, anotações)
04-disparo-whatsapp.md        (evento base, planilha vs pool, template, cadência, agendamento, template pausado, job órfão)
05-pos-vendas.md              (agente compartilhado por marca+UF, gatilhos, entregas multi-template, template pausado)
06-relatorios.md              (dashboards WPP/Ligação, relatório convidados, exportação)
07-administracao.md           (feature flags, MFA, quarentena, monitor nacional, usuários/SSO)
08-perfis-e-responsabilidades.md  (NOVO — matriz "quem faz o quê")
09-glossario-rapido.md        (NOVO — termos do chão-de-loja: SDR, cadência, gatilho, template pausado)
```

Também crio na raiz do manual:

- `CHECKLIST-VIDEOS.md` — lista priorizada de vídeos a gravar (ver seção abaixo).

## Conteúdo-chave por capítulo (com as decisões que você deu)

**Cap. 5 — Pós-Vendas**
- Templates Paty são **compartilhados por marca+UF quando o agente é o mesmo** (igual à Pri). Configurar em uma loja replica para as outras da mesma marca/UF.
- Entregas: **gatilhos do Saga Conecta já chegam automaticamente** — a Paty só dispara se o gatilho estiver com template vinculado e ativo.
- Responsável pela configuração: **CRM** (a definir formalmente — marcar como `TBD` no doc).
- Template pausado: comportamento operacional **ainda não definido** — registrar como "pendente de definição" com link para a doc técnica.

**Cap. 3 — Prospecção**
- Documentar diferença de acesso **SDR vs Vendedor** e o fato de que hoje **vendedor enxerga eventos não atribuídos** (ponto marcado como *"comportamento atual — em revisão, futuro: vendedor só vê Kanban"*).
- Regra dos 30 leads do SDR: "vai liberando à medida que trata".

**Cap. 4 — Disparo WhatsApp**
- Qualquer gestor dispara direto (sem aprovação) — documentar como está e marcar como decisão de negócio.
- Template pausado / job órfão: usuário **aguarda auto-recovery**; só escalar se ficar >15 min pendente.

**Cap. 2 — Recepção**
- Vendedor de atendimento é **opcional** — usar só quando quiser adiantar; padrão é deixar em branco porque o lead já cai no MobiGestor no vendedor correto.

**Cap. 7 — Administração**
- Feature flags e MFA/Vault: **Admin e TI**.
- Quarentena manual e planilha CRM: **CRM**.
- Cria evento base: **gestores de leads e CRM**.
- SSO: só cita fluxo `@gruposaga.com.br` — sem passo a passo de criação (Master faz via Azure, fora do escopo do usuário final).

**Cap. 8 — Perfis (novo)**
Matriz consolidada:

| Configuração | Responsável |
|---|---|
| Feature flags | Admin, TI |
| MFA / Vault | Admin, TI |
| Quarentena manual | CRM |
| Importação planilha | CRM |
| Import pool | CRM |
| Criação de evento base | Gestor de leads, CRM |
| Templates Paty / Meta | *TBD (provável CRM)* |
| Gatilho→template por loja (Peças/Entregas) | *TBD (provável CRM)* |
| Cadência WPP | Gestor de leads |
| Disparo WPP | Qualquer gestor (sem aprovação) |
| Vendedor de atendimento | Recepcionista (opcional) |

## Checklist de vídeos (`CHECKLIST-VIDEOS.md`)

Priorização por impacto × frequência de dúvida:

1. **P0 — Recepção check-in** (QR + FAB + busca 4 dígitos) — maior volume operacional.
2. **P0 — Criação de evento base + upload de planilha** — onde CRM mais erra.
3. **P0 — Kanban do SDR** (mover lead, temperatura, filtros) — uso diário.
4. **P1 — Disparo WPP: escolher template + cadência + agendamento** — inclui o que fazer se template pausar.
5. **P1 — Pós-Vendas: vincular gatilho a template Paty** (Peças e Entregas multi-template).
6. **P1 — Relatório de convidados + dashboards** — dúvida recorrente de gestor.
7. **P2 — Import pool vs planilha** (quando usar cada um).
8. **P2 — Administração: feature flags e quarentena manual.**
9. **P2 — MFA/Vault** (uso e recuperação).
10. **P3 — Monitor Nacional de Disparos** (só Master).

## Pontos que fico marcando como TBD no manual (para você fechar depois)

- Responsável formal pela configuração de Pós-Vendas (Paty/gatilhos).
- Ação do usuário quando template é pausado (hoje: aguardar; futuro: definir SLA).
- Ajuste de acesso do vendedor (só Kanban) — hoje documentado como está + nota "em revisão".

## Execução

Faço em **um único lote** (reescrever 7 esqueletos + criar 3 novos arquivos + checklist de vídeos), sem tocar em código. Ao final, atualizo `docs/README.md` marcando esta fase como concluída.

Confirma que executo assim, ou quer ajustar algo antes?
