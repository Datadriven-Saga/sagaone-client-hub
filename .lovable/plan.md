## Diagnóstico do SSO

O problema está claro nos logs do Supabase Auth:

```text
AADSTS7000222: The provided client secret keys for app 'e00d4b5a-ae41-426f-ada6-ad136b7bd835' are expired.
```

Isso significa que o **Client Secret do App Registration Azure AD** usado pelo provider Microsoft/Azure no Supabase **expirou**.

Por isso:
- Quem já está logado continua logado, porque a sessão local ainda é válida.
- Quem sai e tenta entrar de novo trava no login, porque o Supabase não consegue trocar o `code` retornado pela Microsoft por uma sessão.
- Os retornos aparecem como `302` e depois `200` porque o fluxo OAuth redireciona de volta para o app com erro na URL; o app carrega normalmente, mas sem sessão.
- O erro final `Unable to exchange external code: 1.AV` é só a mensagem genérica do Supabase Auth depois da falha no callback.

## Correção imediata do SSO

Essa correção é operacional, fora do código do frontend:

1. Entrar no Azure Portal.
2. Abrir o App Registration com client id:

```text
e00d4b5a-ae41-426f-ada6-ad136b7bd835
```

3. Ir em **Certificates & secrets**.
4. Criar um novo **Client Secret**.
5. Copiar o **Value** do segredo novo, não o Secret ID.
6. No Supabase Dashboard do projeto `karcxgnfiymlrkbzhewo`, ir em:

```text
Authentication > Providers > Azure
```

7. Substituir o client secret antigo pelo novo.
8. Salvar e testar login novamente.

Recomendação: criar o secret com validade longa e registrar a data de expiração. Melhor ainda: migrar depois para certificado, porque reduz esse tipo de parada.

## Plano de contingência: login por OTP via email

Como o SSO depende de segredo externo e pode expirar novamente, criar uma rota alternativa de login por código de email para usuários já cadastrados.

### Escopo

- Login OTP apenas para usuários já existentes.
- Sem cadastro público.
- Sem bypass das regras atuais de acesso.
- Manter SSO Microsoft como opção principal.
- Manter login de terceiros por senha como está.

### Backend

Criar uma Edge Function `send-login-otp` pública com validação interna:

1. Recebe `{ email }`.
2. Valida formato do email.
3. Verifica se o usuário existe e está ativo.
4. Verifica se o usuário pode logar pelo método `otp`, reaproveitando a lógica de domínio/allowlist.
5. Envia OTP via Supabase Auth usando `signInWithOtp` com `shouldCreateUser: false`.
6. Retorna sempre mensagem genérica para não revelar se o email existe.
7. Aplica rate limit por email/IP.

Criar tabela de auditoria/rate limit:

```text
otp_login_attempts
- id
- email
- ip
- outcome
- created_at
```

Com grants/RLS restritos para não expor tentativas de login.

### Banco

Ajustar a lógica de domínio permitida para aceitar método `otp`:

```text
sso | password | otp | ambos
```

Liberar `otp` para `gruposaga.com.br`.

### Frontend

Criar rota pública:

```text
/login/otp
```

Fluxo em duas etapas:

1. Usuário informa email e clica em **Enviar código**.
2. Usuário digita o código de 6 dígitos recebido por email e clica em **Entrar**.

Adicionar na tela `/login` um botão secundário:

```text
Entrar com código por email
```

Após confirmar o OTP, manter o redirecionamento atual do sistema, inclusive deep link salvo antes do login.

### Email

Usar o template padrão de OTP/Magic Link do Supabase Auth, configurando o conteúdo para destacar o código de 6 dígitos e validade curta.

### Segurança

- `shouldCreateUser: false` obrigatório.
- Mensagem genérica para emails inválidos/inexistentes.
- Rate limit por IP e email.
- Auditoria de tentativas.
- Sem service role no frontend.
- Sem armazenar código OTP em tabela própria.

## Plano de cadências

O plano anterior de cadências deve ser retomado depois:

- Etapa "Configuração IA" com tabela de até 3 cadências.
- Antiga tela de cadência completa deixa de existir.
- Payload ganha um item extra `cadencias` como lista.
- Restante do payload permanece igual.

## Ordem recomendada

1. Corrigir o client secret expirado no Azure/Supabase para restaurar o SSO imediatamente.
2. Implementar login OTP como contingência permanente.
3. Depois voltar ao plano de cadências.