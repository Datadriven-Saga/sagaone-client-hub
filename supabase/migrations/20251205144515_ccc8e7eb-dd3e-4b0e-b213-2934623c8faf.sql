-- Adicionar novos valores ao enum status_lead: 'Em Espera' e 'Opt Out'
ALTER TYPE status_lead ADD VALUE IF NOT EXISTS 'Em Espera';
ALTER TYPE status_lead ADD VALUE IF NOT EXISTS 'Opt Out';