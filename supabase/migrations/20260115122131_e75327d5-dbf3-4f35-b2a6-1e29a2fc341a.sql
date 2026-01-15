-- Adicionar novos valores ao enum origem_lead para classificar origem dos contatos
ALTER TYPE origem_lead ADD VALUE IF NOT EXISTS 'ligacao';
ALTER TYPE origem_lead ADD VALUE IF NOT EXISTS 'grande_evento';
ALTER TYPE origem_lead ADD VALUE IF NOT EXISTS 'prospeccao_mensal';