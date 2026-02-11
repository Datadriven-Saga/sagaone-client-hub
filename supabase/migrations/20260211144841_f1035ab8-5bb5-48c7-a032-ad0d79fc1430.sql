-- Add 'Master' to tipo_acesso enum
ALTER TYPE public.tipo_acesso ADD VALUE IF NOT EXISTS 'Master';
