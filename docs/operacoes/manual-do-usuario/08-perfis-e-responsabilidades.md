# 8. Perfis e responsabilidades

Quem faz o quê no SagaOne. Referência rápida para saber a quem recorrer quando algo precisa mudar.

## Matriz principal

| Configuração / ação | Responsável | Observação |
|---|---|---|
| Feature flags | Admin, TI | Comunicar time antes de ligar/desligar. |
| MFA / Vault | Admin, TI | Master concede acesso pontual. |
| Quarentena manual | CRM | Liberar só com confirmação do cliente. |
| Importação por planilha | CRM | Conferir empresa ativa antes. |
| Import do Pool / DataLake | CRM | Alternativa à planilha, para base interna. |
| Criação de evento base | Gestor de leads, CRM | — |
| Templates Paty / Meta | **TBD** (encaminhamento: CRM) | Aprovação Meta é externa. |
| Gatilho → template (Peças / Entregas) | **TBD** (encaminhamento: CRM) | Compartilhado por marca + UF. |
| Cadência WhatsApp | Gestor de leads | Requer 4 templates quando flag ativa. |
| Disparo WhatsApp | Qualquer gestor com acesso | **Sem aprovação prévia** hoje. |
| Vendedor de atendimento no check-in | Recepcionista | Opcional. |
| Cadastro de novo usuário | Master, TI (via Azure) | SagaOne provisiona no 1º login. |
| Cadastro de agente Paty | Admin, TI | Um agente por marca + UF. |
| Monitor Nacional de Disparos | Master | Só leitura. |

## Perfis de acesso (resumo)

- **Recepcionista** — check-in e busca de leads. Não vê Prospecção completa.
- **SDR** — Kanban dos leads atribuídos a ele. Limite de 30 leads em aberto.
- **Vendedor** — hoje enxerga Kanban como SDR e vê eventos não atribuídos (comportamento em revisão; combinado é **não mexer em evento alheio**).
- **Gestor de leads** — tudo da empresa ativa: dispara, agenda, reatribui.
- **CRM** — configura bases, quarentena e (encaminhamento) Paty.
- **Admin da empresa** — usuários e configurações da própria empresa.
- **TI** — infra, feature flags, MFA, integrações.
- **Master** — todas as empresas, todas as telas.

## Pontos em aberto

- **Pós-Vendas / Paty:** responsável formal a definir (TBD).
- **Template pausado:** SLA e responsável pela troca a definir (TBD).
- **Acesso do vendedor:** hoje excessivo; ajuste planejado para restringir ao Kanban próprio.

> Cada item TBD será atualizado aqui assim que decidido pelo time.