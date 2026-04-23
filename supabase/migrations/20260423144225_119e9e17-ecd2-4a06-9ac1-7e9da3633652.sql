-- 1. Migrar os 3 leads em "Agendado" para "Convidado"
UPDATE public.contatos SET status = 'Convidado'::status_lead WHERE status = 'Agendado'::status_lead;

-- 2. Recriar o enum status_lead apenas com os 9 valores reais
ALTER TYPE public.status_lead RENAME TO status_lead_old;

CREATE TYPE public.status_lead AS ENUM (
  'Novo',
  'Atribuído',
  'Em Espera',
  'Convidado',
  'Confirmado',
  'Check-in',
  'Venda',
  'Descartado',
  'Opt Out'
);

-- 3. Converter a coluna contatos.status para o novo enum
ALTER TABLE public.contatos
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.status_lead USING status::text::public.status_lead,
  ALTER COLUMN status SET DEFAULT 'Novo'::public.status_lead;

-- 4. Remover o enum antigo
DROP TYPE public.status_lead_old;