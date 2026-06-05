# Vídeo + Solicitar acesso na tela "Recurso não habilitado"

## Onde

`src/pages/Cadeiras.tsx` — bloco renderizado quando `flagEnabled === false` (linhas 273-299). Apenas frontend, sem mudança de schema, RLS ou edge function.

## O que muda

Substituir o `Alert` atual por uma tela com:

1. **Título e descrição curta** explicando o que é "Login de Terceiros + Cadeiras".
2. **Vídeo embedado do SharePoint** (iframe responsivo 16:9, max-width 720px) usando a URL fornecida pelo usuário.
3. **Bloco de solicitação de acesso** abaixo do vídeo:
   - Texto: "Após assistir ao vídeo, solicite a liberação para o time de TI."
   - Botão **"Solicitar liberação"** que abre `mailto:` no cliente de email do usuário com:
     - **Para:** `luiz.candrade@gruposaga.com.br`
     - **Cópia:** `fabricio.pmoreira@gruposaga.com.br`, `douglas.rsouza@gruposaga.com.br`
     - **Assunto:** `Solicitação de liberação: Login de Terceiros + Cadeiras — {nome_empresa}`
     - **Corpo:** mensagem padrão informando que o solicitante assistiu ao vídeo, entende como funciona, e está pedindo a liberação da feature `login_terceiros_cadeiras` para a loja **{nome_empresa}** (incluindo `empresa_id` e o nome do usuário logado para rastreio).

## Detalhes técnicos

- Iframe com wrapper `position: relative; padding-bottom: 56.25%` para manter aspect ratio responsivo, como na tag fornecida.
- Atributos: `allowfullscreen`, `title="SagaOne - Login de Terceiros"`, `loading="lazy"`.
- `mailto` montado via `encodeURIComponent` para subject/body; CCs via `?cc=...`.
- Usar `activeCompany?.nome_empresa` e `user?.email` no corpo do email.
- Usar tokens semânticos (Card, Button, texto `text-muted-foreground`) — sem cores hardcoded.

## Fora de escopo

- Sidebar continua exibindo "Cadeiras" via permissão de usuário (comportamento atual mantido).
- Sem edge function de envio automático — usuário pediu para abrir o cliente de email.
- Sem mudança no fluxo de quem já tem a flag habilitada.