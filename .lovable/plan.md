## Diagnóstico

O fluxo está chamando `signInWithOtp` sem informar que o email deve ser do tipo OTP. Por padrão, o Supabase envia o template de **Magic Link**, por isso você recebeu um link e, ao clicar, caiu no erro de link expirado/inválido. A tela atual espera um código de 6 dígitos, então o envio precisa usar o template/fluxo de OTP.

## Plano

1. Ajustar a Edge Function `send-login-otp`
   - Alterar a chamada de `supabase.auth.signInWithOtp` para solicitar explicitamente OTP por email, mantendo `shouldCreateUser: false`.
   - Manter as validações existentes: usuário cadastrado, domínio permitido, rate limit por email/IP e retorno genérico.

2. Ajustar o fallback antigo de magic link, se ainda existir
   - Revisar `signInWithMagicLink` para não conflitar com o novo fluxo de código, ou deixá-lo isolado caso ainda seja usado em outra tela.

3. Melhorar a UX da tela `/login/otp`
   - Evitar sugerir que o usuário clique em link.
   - Tratar erro `otp_expired`/link inválido mostrando uma mensagem clara: peça um novo código e use o campo de 6 dígitos.

4. Validar
   - Testar a página `/login/otp`.
   - Testar a Edge Function com um email inválido/autorizado sem expor detalhes de cadastro.
   - Confirmar que o retorno continua 200/429 conforme rate limit e que a tela segue para etapa de código.

## Observação

O email ainda pode aparecer com assunto/corpo padrão do Supabase até customizarmos os templates, mas o conteúdo precisa passar a incluir o **código numérico**, não apenas “Log In”.