## Landing Page de Confirmação de Presença

Página pública acessada via `sagaone.com.br/confirmar/{token}` que o cliente recebe por WhatsApp. Reproduz o layout da referência (dark, 2 colunas, KV à esquerda, QR à direita).

---

### 1. Rota e estrutura

**Nova rota pública** (sem auth) em `src/App.tsx`:
```
/confirmar/:token  →  src/pages/public/ConfirmarPresenca.tsx
```

A rota fica fora de `<ProtectedRoute>`. Usa `supabase` com anon key (RLS permite leitura via Edge Function, não direto na tabela).

---

### 2. Edge Function `confirm-presence-info`

**GET** `?token={qr_token}` — retorna dados da landing.
**POST** `{ token }` — registra confirmação (`confirmed_at = now()`).

**Payload de retorno (GET):**
```json
{
  "nome": "Telma",
  "convidado_por": "Weslielma Jacinta da hora",
  "evento": {
    "titulo": "Super Ação de Vendas Saga Toyota",
    "data_inicio": "2026-03-28T10:00:00Z",
    "data_fim": "2026-03-28T22:00:00Z",
    "imagem_divulgacao_url": "https://..."
  },
  "empresa": {
    "nome": "Saga Toyota T7",
    "endereco": "Av. T7, 563 - Setor Bueno",
    "cidade": "Goiânia",
    "uf": "GO"
  },
  "qr_token": "abc123...",
  "confirmed_at": null,
  "evento_finalizado": false,
  "link_expirado": false
}
```

**Lógica:**
- Busca `contatos` por `qr_token`
- Joins: `prospeccoes` (título, datas, imagem_divulgacao_url) + `empresas` (nome, endereço)
- `convidado_por` = nome do vendedor que enviou (campo já existente em `contatos.vendedor_nome` ou via join — confirmar no momento da implementação)
- `evento_finalizado` = `prospeccao.data_fim < now()`
- `link_expirado` = `qr_token_expires_at < now()` (se houver)
- Se token inválido → 404

---

### 3. Componente `ConfirmarPresenca.tsx`

**Estados de tela** (mutuamente exclusivos):

| Estado | O que renderiza |
|---|---|
| Loading | Skeleton |
| Token inválido | Mensagem "Link inválido" |
| `evento_finalizado === true` | **Tela simples**: logo Saga + "Este evento já foi realizado. Agradecemos seu interesse!" |
| Normal | Layout 2 colunas da referência |

**Layout normal (desktop ≥ 768px):**
```
┌──── Container max-w-5xl, bg #0B0F1E ────┐
│ Grid 2 colunas, gap-6                    │
├─────────────────────┬────────────────────┤
│ COLUNA ESQUERDA     │ COLUNA DIREITA     │
│                     │                    │
│ "SEU CONVITE        │ "APRESENTE NA      │
│  DIGITAL" (roxo)    │  ENTRADA" (roxo)   │
│ "Olá, {nome}" h1    │                    │
│                     │ [QR Code ~200px]   │
│ [BOTÃO CTA]         │ (branco, padding)  │
│                     │                    │
│ ┌─ KV imagem ─┐     │ Convidado por:     │
│ │             │     │ {convidado_por}    │
│ └─────────────┘     │                    │
│ {evento.titulo}     │ ┌─ Card ─┐         │
│ {empresa.nome}      │ │ 📅 Data│         │
│                     │ └────────┘         │
│                     │ ┌─ Card ─┐         │
│                     │ │ 📍 End │         │
│                     │ │ [Maps] │         │
│                     │ │ [Waze] │         │
│                     │ └────────┘         │
└─────────────────────┴────────────────────┘
```

**Mobile (< 768px):** stack vertical, mesma ordem do conteúdo da esquerda + direita intercalados naturalmente.

**Estados do CTA "Confirmar":**
| Condição | Botão |
|---|---|
| `confirmed_at == null` | `CONFIRMAR PRESENÇA` (gradiente lima `#D9F77E → #A3E635`, ativo) |
| `confirmed_at != null` | `PRESENÇA CONFIRMADA ✓` (verde, desabilitado) |

**QR Code:**
- Sempre renderizado (`qrcode.react` ou `qrcode` lib que já existe no projeto)
- Conteúdo do QR = mesmo JSON usado hoje na recepção (`{ token, contato_id, ... }`)
- Quando `confirmed_at == null` → wrapper com `blur-md` + overlay "Confirme para liberar"
- Quando confirmado → nítido

---

### 4. Confirmação (POST)

Ao clicar no CTA:
1. `POST /confirm-presence-info` com `{ token }`
2. Edge Function valida e faz `UPDATE contatos SET confirmed_at = now() WHERE qr_token = ? AND confirmed_at IS NULL`
3. Cria evento na timeline: `INSERT INTO eventos_prospeccao (tipo='confirmacao_presenca', ...)` — alinhado com `mem://features/prospeccao/unified-contact-timeline`
4. Move o lead no Kanban: `UPDATE prospeccao_status` de `Convidado` → `Confirmado` (se status atual for Convidado)
5. Resposta: `{ ok: true, confirmed_at: "..." }`
6. Frontend atualiza estado, botão vira "PRESENÇA CONFIRMADA ✓", QR desbloqueia, toast de sucesso

---

### 5. Botões Maps / Waze

```tsx
const endereco = `${empresa.endereco}, ${empresa.cidade}, ${empresa.uf}`
const q = encodeURIComponent(endereco)

<a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank">
  Google Maps
</a>
<a href={`https://waze.com/ul?q=${q}&navigate=yes`} target="_blank">
  Abrir Waze
</a>
```

---

### 6. Design tokens (dark fixo)

A landing **ignora o tema do app** (sempre dark). Aplicado via classes Tailwind diretas no wrapper:

| Token | Valor |
|---|---|
| Background página | `bg-[#0B0F1E]` |
| Cards | `bg-[#161B2E]` + `border border-white/5` |
| Títulos seção (uppercase pequeno) | `text-purple-400 text-xs tracking-wider` |
| Texto principal | `text-white` |
| Texto secundário | `text-gray-400` |
| CTA confirmar | `bg-gradient-to-r from-[#D9F77E] to-[#A3E635] text-black font-bold` |
| Ícones cards | `text-purple-400` |

Fonte: usar a do projeto (Inter / system).

---

### 7. Detalhes técnicos

**Arquivos novos:**
- `src/pages/public/ConfirmarPresenca.tsx`
- `supabase/functions/confirm-presence-info/index.ts`

**Arquivos modificados:**
- `src/App.tsx` — adicionar rota `/confirmar/:token` fora de `ProtectedRoute`
- `supabase/config.toml` — adicionar `[functions.confirm-presence-info]` com `verify_jwt = false`

**Migrations necessárias** (a confirmar lendo `contatos` no momento da implementação):
- Adicionar `qr_token uuid unique`, `confirmed_at timestamptz`, `qr_token_expires_at timestamptz` se ainda não existirem
- Adicionar índice em `qr_token`

**Bibliotecas:**
- QR Code: usar a lib que já está no projeto (provavelmente `qrcode` — verificar `ConviteTab.tsx` na implementação)
- Sem `html2canvas` (botão Salvar não entra agora)

---

### 8. Validação

```text
1. Edge Function GET com token válido → retorna dados completos          → curl_edge_functions
2. Edge Function GET com token inválido → 404                            → curl_edge_functions
3. Página renderiza layout 2 colunas em desktop                          → preview manual
4. Página colapsa em mobile (375px)                                      → preview manual
5. QR aparece blur antes de confirmar, nítido depois                     → preview manual
6. Clique em Confirmar → botão muda + UPDATE em contatos.confirmed_at   → SQL check
7. Lead move de Convidado → Confirmado no Kanban                         → SQL check
8. Evento com data_fim < hoje → tela simples "evento já realizado"       → preview manual
9. Botões Maps/Waze abrem em nova aba com endereço correto               → preview manual
```

---

### 9. Fora do escopo (próximas iterações)

- Botão "Salvar" (download PNG da página)
- Campos "Equipe" e "Vendedor indicado" na coluna direita
- Notificação ao vendedor quando cliente confirma
- Template WhatsApp HSM aprovado pela Meta
- Customização do KV de fundo da página inteira
