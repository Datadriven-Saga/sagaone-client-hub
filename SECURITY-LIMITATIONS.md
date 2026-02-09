# Relatório de Segurança — Saga One CRM

## Status: Hardening aplicado (plataforma Lovable)

Data: 2026-02-09

---

## ✅ Proteções Implementadas

| Proteção | Método | Status |
|----------|--------|--------|
| **Content-Security-Policy** | Meta tag `http-equiv` | ✅ Implementado |
| **Referrer-Policy** | Meta tag `name="referrer"` | ✅ Implementado |
| **frame-ancestors 'self'** | Via CSP | ✅ Implementado (mitigação parcial de clickjacking) |
| **form-action 'self'** | Via CSP | ✅ Implementado |
| **object-src 'none'** | Via CSP | ✅ Implementado |
| **base-uri 'self'** | Via CSP | ✅ Implementado |
| **upgrade-insecure-requests** | Via CSP | ✅ Implementado |
| **Validação de URLs (SSRF)** | `src/lib/security.ts` | ✅ Implementado |
| **crossorigin="anonymous"** | Em recursos externos | ✅ Implementado |
| **HTTPS enforced** | Todos os recursos externos | ✅ Verificado |

---

## ⚠️ Limitações da Plataforma Lovable

As seguintes proteções **NÃO podem ser implementadas** na plataforma Lovable porque exigem headers HTTP configurados no servidor/CDN:

| Header | Finalidade | Alternativa |
|--------|-----------|-------------|
| **Strict-Transport-Security (HSTS)** | Forçar HTTPS e prevenir downgrade attacks | `upgrade-insecure-requests` via CSP (parcial) |
| **X-Content-Type-Options: nosniff** | Prevenir MIME sniffing | Nenhuma via meta tag |
| **X-Frame-Options: SAMEORIGIN** | Clickjacking | `frame-ancestors 'self'` via CSP (parcial) |
| **Permissions-Policy** | Restringir APIs do navegador (câmera, mic, etc.) | Nenhuma via meta tag |
| **SRI em assets Vite** | Integridade de bundles JS/CSS | Vite gera hashes dinâmicos a cada build; SRI manual quebraria |
| **SRI em Google Fonts** | Integridade de fontes | CSS gerado dinamicamente pelo Google; SRI impossível |

### Recomendação para migração futura

Ao migrar para infraestrutura própria, configurar no proxy reverso (Cloudflare/Nginx):

```nginx
# Nginx example
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;
```

---

## 🔒 Política CSP Aplicada

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-ancestors 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

### Justificativas

| Diretiva | Motivo |
|----------|--------|
| `'unsafe-inline'` em style-src | Necessário para shadcn/Radix UI (injetam estilos inline) |
| `blob:` em img-src | Necessário para geração de QR codes via canvas |
| `https://*.supabase.co` | Backend da aplicação |
| `wss://*.supabase.co` | Realtime/WebSocket do Supabase |

---

## 📋 Checklist de Validação

- [x] Aplicação carrega sem erros no console
- [x] Sem violações de CSP
- [x] Google Fonts carregam corretamente
- [x] Conexão com Supabase funcional
- [x] Imagens e assets locais carregam
- [x] Nenhuma funcionalidade impactada
