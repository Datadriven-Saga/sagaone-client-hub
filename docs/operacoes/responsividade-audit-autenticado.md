# Responsividade — Audit Autenticado (Runbook)

> Como rodar o audit de responsividade em rotas internas do SagaOne em ambiente com sessão válida (pré-prod ou prod).
>
> Última revisão: 2026-07-20

---

## 1. Objetivo

O script `bun run responsivo:audit` cobre **rotas públicas** automaticamente. Para rotas que exigem login (`/prospeccao`, `/recepcao`, `/resultados`, `/administracao/*`, etc.), é preciso fornecer uma sessão Supabase válida ao Playwright.

Este runbook descreve duas formas de fazer isso:

- **Forma A — manual (recomendada para primeira vez):** login no navegador, copia o token do `localStorage` e exporta como variáveis de ambiente.
- **Forma B — automática (para CI/rotina):** usar um script que reutiliza credenciais de serviço ou um token de refresh previamente obtido.

---

## 2. Pré-requisitos

- App rodando em uma URL acessível (ex.: `https://one.sagadatadriven.com.br` ou `https://sagaone-client-hub.lovable.app`).
- Bun instalado na máquina que vai rodar o audit (`bun --version`).
- Playwright já instalado no projeto (`bun install` executado).
- Um usuário de teste com acesso SSO válido e permissões para as rotas que serão auditadas.

---

## 3. Forma A — execução manual

### 3.1. Faça login no navegador

1. Abra o Chrome/Edge em uma janela anônima.
2. Acesse a URL do ambiente (ex.: `https://one.sagadatadriven.com.br/login`).
3. Complete o login com Azure AD (`@gruposaga.com.br`).
4. Após o redirect para `/`, abra o DevTools (F12) → **Console**.

### 3.2. Extraia a sessão do localStorage

Cole no console e copie o JSON retornado:

```js
const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
const session = JSON.parse(localStorage.getItem(key));
console.log(JSON.stringify({ storageKey: key, session }, null, 2));
```

O resultado terá esta estrutura:

```json
{
  "storageKey": "sb-<projeto>-auth-token",
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "<refresh>",
    "expires_at": 1234567890,
    "user": { "id": "...", "email": "..." }
  }
}
```

> **Segurança:** esse token é equivalente a uma senha. Não committe, não cole em chat público e descarte assim que o audit terminar.

### 3.3. Exporte as variáveis de ambiente

No terminal onde o audit será executado:

```bash
export LOVABLE_BROWSER_AUTH_STATUS="injected"
export LOVABLE_BROWSER_SUPABASE_STORAGE_KEY="sb-<projeto>-auth-token"
export LOVABLE_BROWSER_SUPABASE_SESSION_JSON='{"access_token":"eyJ...","refresh_token":"...","expires_at":1234567890,"user":{"id":"...","email":"..."}}'

# Opcional: se usar cookies SSR (não é o caso do SagaOne SPA, mas pode ser útil em testes híbridos)
# export LOVABLE_BROWSER_SUPABASE_COOKIES_JSON='[...]'

export RESPONSIVO_BASE_URL="https://one.sagadatadriven.com.br"
```

### 3.4. Execute o audit

Rodada completa (15 rotas padrão):

```bash
bun run responsivo:audit
```

Rodada parcial, apenas rotas críticas:

```bash
bun run responsivo:audit -- --routes=/,/prospeccao,/recepcao,/resultados,/pos-vendas/agendamentos,/administracao
```

O script gera:

```text
/tmp/browser/responsivo/<timestamp>/
  report.md
  report.json
  screenshots/
```

### 3.5. Arquive o relatório

Copie o `report.md` gerado para o projeto:

```bash
DATE=$(date +%Y-%m-%d)
cp /tmp/browser/responsivo/<timestamp>/report.md docs/historico/responsividade-${DATE}-autenticado.md
```

Edite o arquivo e adicione no topo:

- Ambiente auditado (URL)
- Usuário/perfil utilizado (ex.: "SDR", "Admin", "Gerente de Leads")
- Observações sobre rotas que falharam ou apresentaram overflow

---

## 4. Forma B — automação (CI ou rotina)

Se o ambiente permitir, o ideal é gerar o token via um usuário de serviço ou Edge Function interna. **Não** armazene senhas em repositório. Opções seguras:

1. **GitHub Actions / CI:** usar secrets do repositório para injetar `LOVABLE_BROWSER_SUPABASE_SESSION_JSON` gerado por um step anterior de autenticação.
2. **Token de refresh:** manter um `refresh_token` em um secret manager e trocar por `access_token` antes de rodar o audit.
3. **Edge Function interna:** criar uma função `generate-test-session` (autenticada por service_role) que retorna um token de um usuário de teste fixo. **Só em ambientes não-prod.**

Exemplo mínimo de step no GitHub Actions:

```yaml
- name: Responsividade audit
  env:
    LOVABLE_BROWSER_AUTH_STATUS: injected
    LOVABLE_BROWSER_SUPABASE_STORAGE_KEY: ${{ secrets.SUPABASE_STORAGE_KEY }}
    LOVABLE_BROWSER_SUPABASE_SESSION_JSON: ${{ secrets.SUPABASE_TEST_SESSION_JSON }}
    RESPONSIVO_BASE_URL: ${{ vars.PREVIEW_URL }}
  run: bun run responsivo:audit -- --routes=/,/prospepcao,/recepcao
```

---

## 5. Rotas recomendadas por perfil

Para ter cobertura real, rode o audit com ao menos 3 perfis diferentes:

| Perfil | Rotas obrigatórias |
|---|---|
| **SDR / Vendedor** | `/prospeccao`, `/recepcao`, `/minha-conta` |
| **Gerente de Leads / Admin de loja** | `/prospeccao`, `/resultados`, `/administracao/acessos`, `/administracao/cadeiras` |
| **Master / TI** | `/administracao`, `/administracao/agentes`, `/administracao/empresas`, `/administracao/quarentena`, `/administracao/logs-disparos`, `/administracao/webhooks`, `/administracao/feature-flags` |

> O script usa a **mesma sessão** do início ao fim. Se for necessário alternar perfis, rode em lotes separadas e renomeie os relatórios.

---

## 6. Como interpretar o relatório

O `report.md` contém uma tabela com estas colunas:

| Coluna | Significado | Ação quando falha |
|---|---|---|
| Overflow-X | `scrollWidth > innerWidth` | Reproduzir no DevTools, encontrar o elemento que estoura e corrigir (`w-full`, `min-w-0`, `overflow-x:auto` na tabela) |
| Hitbox<44 | elementos interativos < 44×44 px | Aumentar padding, usar `size="touch"` ou `.touch-target` |
| Erro | falha de navegação/timeout | Verificar se a rota existe e se a sessão não expirou durante o teste |

### Critério de aprovação

- **0 overflow horizontal** em 360px e 390px.
- **≤ 5 hitboxes < 44px por rota** (apenas ícones decorativos/justificados).
- **0 erros de navegação**.

Se algum item falhar, abra um ticket ou uma nova onda de ajuste. Não arquive como "concluído" enquanto houver overflow em rotas críticas.

---

## 7. Dicas práticas

- **Evite tokens que expirem durante o teste.** A sessão dura 8h; o audit completo demora < 10 minutos.
- **Rode em uma máquina com tela suficiente.** Playwright precisa criar viewports de até 1920×1080; o host deve ter resolução maior que isso.
- **Screenshots não são versionados.** Eles ficam em `/tmp/browser/responsivo/`. Se quiser anexá-los a um ticket, copie a pasta inteira.
- **Se o token vazar:** revogue a sessão no Supabase Dashboard → Auth → Sessions e gere um novo.

---

## 8. Checklist de fechamento

Quando o audit autenticado estiver concluído, atualize:

- [ ] `docs/responsividade-diagnostico.md` → marcar a pendência de audit autenticado como resolvida.
- [ ] `docs/historico/responsividade-<data>-autenticado.md` → arquivar o relatório.
- [ ] Se houver bugs, abrir tickets e referenciar o relatório arquivado.
- [ ] Se estiver 100% verde, remover a seção "Pendências rastreadas" do plano ou marcar como concluída.
