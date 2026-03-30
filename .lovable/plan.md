

## Plano: Separar MFA Geral de Agentes + Adicionar Cofre de Senhas

### Contexto

Existem **dois MFAs distintos**:
1. **MFA Geral** (`MFAAgentesContent`) -- hoje vive como aba "MFA" dentro de `/administracao/agentes`. Permite criar/ver/copiar códigos TOTP, scan QR, gerenciar acessos e logs. Acessível a quem tem `canAccessAgentesIA`.
2. **MFA Master** (`MFAMasterDashboard`) -- já existe em `/administracao/mfa-master`, com card próprio. Visível apenas para Masters. **Não será alterado.**

O objetivo é:
- Tirar o MFA Geral de dentro de Agentes e criar um **card e rota próprios**
- Adicionar a funcionalidade de **Cofre de Senhas** ao MFA Geral
- Quem já acessa o MFA (via Agentes) continua acessando

---

### Mudança 1: Remover aba MFA de Agentes

**Arquivo: `src/pages/admin/Agentes.tsx`**
- Remover `TabsTrigger value="mfa"` (linha 1662)
- Remover `TabsContent value="mfa"` com `<MFAAgentesContent />` (linhas 3156-3158)
- Alterar o grid de 4 colunas para 3: `grid-cols-4` → `grid-cols-3` (linha 1658)
- Remover import de `MFAAgentesContent` (linha 13)

---

### Mudança 2: Nova rota para MFA Geral

**Arquivo: `src/App.tsx`**
- Adicionar nova rota: `/administracao/mfa`
- Proteger com `PermissionProtectedRoute permissionKey="canAccessAgentesIA"` (mesma permissão que Agentes, mantendo acesso de quem já usava)
- Criar nova página wrapper `src/pages/admin/MFAGeral.tsx` que renderiza `<MFAAgentesContent />` dentro de `<DashboardLayout>`

---

### Mudança 3: Card MFA na página de Administração

**Arquivo: `src/pages/Administracao.tsx`**
- Adicionar card "MFA" no array `allModules`, logo **após o card "Agentes"** (após linha 101)
- Configuração:
  - Titulo: "MFA"
  - Descrição: "Gerenciar autenticação multifator e códigos TOTP"
  - Icone: `ShieldCheck`
  - Rota: `/administracao/mfa`
  - permissionKey: `canAccessAgentesIA` (mantém acesso para quem já tinha)

---

### Mudança 4: Nova tabela para Cofre de Senhas

**Migration SQL:**
- Tabela `mfa_password_vault` com campos: `id`, `account_id` (ref `mfa_accounts`), `login`, `password_encrypted`, `notes`, `created_by`, `created_at`, `updated_at`
- RLS: acesso controlado via `is_mfa_master(auth.uid())` (apenas Masters gerenciam cofre)
- Trigger de criptografia AES reutilizando a mesma chave existente dos MFA secrets
- View `mfa_password_vault_decrypted` para leitura descriptografada
- Indice em `account_id`

---

### Mudança 5: Aba "Senhas" no MFA Geral

**Arquivo: `src/components/admin/MFAAgentesContent.tsx`**
- Adicionar nova aba "Senhas" entre "Códigos" e "Acessos" (ordem: Authenticators → **Senhas** → Acessos → Logs)
- Conteudo da aba:
  - Lista de credenciais salvas (login, MFA associado/issuer, data de criacao)
  - Botoes de copiar login/senha e excluir
  - Botao "Nova Senha" que abre modal de criacao

**Modal de criacao de senha:**
- Campos: login, senha
- Opcao toggle: "Associar a MFA existente" vs "Criar novo MFA"
- Se existente: dropdown com lista de MFA accounts (issuer + label)
- Se novo: campos inline para issuer, label, secret (reutilizando fluxo existente de criacao de MFA)
- Ao salvar:
  - Se novo MFA: cria o MFA account primeiro, depois cria o vault entry
  - Se existente: cria apenas o vault entry
- Registra acao nos audit logs (`mfa_audit_logs`)

---

### Arquivos alterados/criados

| Arquivo | Acao |
|---------|------|
| `src/pages/admin/Agentes.tsx` | Remover aba MFA (tab trigger + content + import) |
| `src/pages/admin/MFAGeral.tsx` | **Novo** -- wrapper page para MFAAgentesContent |
| `src/App.tsx` | Adicionar rota `/administracao/mfa` |
| `src/pages/Administracao.tsx` | Adicionar card MFA apos Agentes |
| `src/components/admin/MFAAgentesContent.tsx` | Adicionar aba "Senhas" com CRUD + modal |
| Nova migration SQL | Tabela `mfa_password_vault`, trigger, view, RLS |

