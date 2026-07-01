# 7. Administração

**Perfis:** Admin, TI, Master, CRM (só quarentena e planilha).

O módulo `/administracao` reúne configurações sensíveis do sistema. **Não é local para operação diária** — é para configurar, auditar e resolver incidentes.

## Feature Flags — Admin / TI

- Menu **Administração → Feature Flags**.
- Liga/desliga funcionalidades globalmente (ex.: cadência WPP obrigatória, novo Kanban, etc.).
- **Comunique antes de mexer.** Mudar flag no meio do expediente pode surpreender usuários — combinar em canal interno primeiro.
- Cada mudança fica logada (quem, quando, valor antigo/novo).

## MFA / Vault — Admin / TI

- Vault guarda segredos criptografados (AES-256) — API keys, senhas de integração etc.
- Só quem tem MFA ativo e está no `mfa_account_access` da conta enxerga.
- Se você é Admin/TI e precisa de acesso a um segredo, Master libera pontualmente.
- **Nunca compartilhe segredo em chat ou e-mail.** Sempre pegar do Vault na hora.

## Quarentena manual — CRM

- Menu **Administração → Quarentena**.
- Mostra telefones bloqueados por marca/canal (quem reclamou, quem deu opt-out, quem excedeu tentativas).
- **Liberar manualmente:** botão "Liberar" faz soft-delete do bloqueio. Usar com critério — cliente reclamou uma vez, provavelmente não quer ser contatado de novo.
- Bloqueio é por **telefone + marca + canal**. Liberar Hyundai não libera Nissan.

## Logs de Disparos — Admin / TI

- Auditoria completa de tudo que saiu por WhatsApp/Ligação: quem disparou, quando, qual template, quanto custou, retorno da Meta.
- Filtros por período, empresa, template, status.
- Exporta em XLSX para auditoria mensal.

## Monitor Nacional de Disparos — Master

- Menu **Administração → Monitor de Disparos**.
- Visão **agregada de todas as empresas** por hora. Mostra:
  - Quantos disparos irão sair na próxima hora, no dia, na semana.
  - Status geral (running / scheduled / failed).
- Uso: planejamento de infra e resposta a incidente em produção.

## Criação de usuário / SSO

- Novo usuário é criado no **Azure AD** (fora do SagaOne) pelo Master/TI.
- No primeiro login, o SagaOne provisiona automaticamente com base nos grupos Azure.
- Ajustes finos de permissão são feitos em **Administração → Controle de Acessos** por Admin/TI.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Novo usuário loga mas não vê nada | Grupo Azure errado — TI ajusta e usuário desloga/loga de novo. |
| Segredo do Vault não aparece | Sem MFA ou sem acesso concedido — Master libera. |
| Cliente pediu para ser desbloqueado | Confirmar que ele realmente quer, então liberar em Quarentena. |
| Flag ligada por engano causou bug | Desligar imediatamente; log guarda o histórico. |

> 🎥 Vídeo sugerido: *"Administração — feature flags, quarentena manual e Vault"* (P2 — pendente de gravação).