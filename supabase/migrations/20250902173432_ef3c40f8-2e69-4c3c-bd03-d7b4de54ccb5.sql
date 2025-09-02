-- Verificar se o valor 'novo_contato_prospeccao' existe no enum tipo_gatilho
-- Se não existir, adicionar ao enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'tipo_gatilho'::regtype 
        AND enumlabel = 'novo_contato_prospeccao'
    ) THEN
        ALTER TYPE tipo_gatilho ADD VALUE 'novo_contato_prospeccao';
    END IF;
END$$;