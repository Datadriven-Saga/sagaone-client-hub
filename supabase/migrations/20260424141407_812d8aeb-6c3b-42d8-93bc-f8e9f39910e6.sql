-- 1. Novos campos em contatos para fluxo de confirmação de presença
ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS confirmation_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmation_expires_at timestamptz;

-- 2. Backfill: garantir token para registros pré-existentes
UPDATE public.contatos
SET confirmation_token = gen_random_uuid()
WHERE confirmation_token IS NULL;

-- 3. Índice único para lookup rápido pela landing page (filtered: ignora NULLs futuros)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contatos_confirmation_token
  ON public.contatos(confirmation_token)
  WHERE confirmation_token IS NOT NULL;

-- 4. Texto configurável do convite por evento (com placeholders)
ALTER TABLE public.prospeccoes
  ADD COLUMN IF NOT EXISTS texto_convite_template text DEFAULT
'*Olá {{nome}}!* 👋

*Aqui está o seu convite para o {{evento}}!* ✨

*Para confirmar sua presença:*
_Se o link não ficar azul é porque ainda não estou na sua lista de contatos, basta responder essa mensagem que o link ficará acessível._ 👇
{{link}}

*Tenho certeza que faremos um ótimo negócio.* 🤝

Qualquer dúvida, é só chamar! 😊';