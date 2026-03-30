

## Plano: Renomear card MFA, reposicionar e adicionar cópia de código MFA

### Mudança 1: Renomear e reposicionar card em Administração

**Arquivo: `src/pages/Administracao.tsx`**
- Renomear o card de "MFA" para **"MFA / Cofre de Senhas"**
- Atualizar descrição para: "Gerenciar autenticação multifator, códigos TOTP e cofre de senhas"
- Mover o card no array `allModules` para ficar logo **após "Agentes"** e **antes de "Gatilhos"** — na posição onde hoje está "Campos Obrigatórios" (ou seja, na 2ª linha do grid, 3ª coluna visual, como indicado na imagem)

Na prática, a ordem no array ficará:
1. Acessos
2. Empresas
3. Agentes
4. Gatilhos
5. **MFA / Cofre de Senhas** (movido para cá)
6. Campos Obrigatórios

Isso faz com que no grid de 3 colunas, o card MFA fique na posição indicada pela imagem (2ª linha, ao lado de Gatilhos e Campos Obrigatórios).

---

### Mudança 2: Botão de copiar código MFA na aba Senhas

**Arquivo: `src/components/admin/MFAPasswordVaultTab.tsx`**

O componente já recebe a lista de `accounts` (com `secret`). Para copiar o código TOTP:
- Importar e reutilizar a função `generateTOTP` de `MFAAgentesContent` (ou recriar localmente, já que é pequena e usa `otpauth`)
- Para cada entrada na lista de credenciais, adicionar um botão de copiar o **código MFA atual** (TOTP gerado em tempo real a partir do secret da conta MFA associada)
- Buscar o `secret` da conta MFA via `accounts.find(a => a.id === entry.account_id)?.secret`
- Gerar o TOTP com `generateTOTP(secret)` e copiar para clipboard
- Ícone: `ShieldCheck` com tooltip "Copiar código MFA"

O botão ficará ao lado dos botões existentes de copiar login e copiar senha na listagem de credenciais.

---

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/pages/Administracao.tsx` | Renomear card e reordenar posição no array |
| `src/components/admin/MFAPasswordVaultTab.tsx` | Adicionar botão copiar código MFA (TOTP) |

