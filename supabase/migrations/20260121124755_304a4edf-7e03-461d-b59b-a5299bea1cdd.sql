
DO $$
DECLARE
  v_empresa_id UUID := '8a7de62b-2cd1-4a77-9e29-c6721d94a065';
  v_prospeccao_id UUID := 'be1c4e7d-803b-4e99-b45e-848902eb0364';
  v_contato_id UUID;
  v_telefone TEXT;
  v_nome TEXT;
BEGIN

  FOR v_nome, v_telefone IN 
    VALUES 
      ('Douglas', '62832129944'),
      ('Luiz', '62917752522'),
      ('Johnattan', '62988641122'),
      ('Fernanda', '62930893644'),
      ('Tiago', '62930810066'),
      ('Juliana', '62983399962'),
      ('Paohola', '62996739662'),
      ('Aline (Gerente RH)', '62982891616'),
      ('Grazzi', '51996407077'),
      ('Pollyana', '62986061265'),
      ('Denyse', '62981337151'),
      ('Lucivania', '62992582771'),
      ('Thatianny Arantes', '62981498733'),
      ('Daniela', '62981484743'),
      ('Bianca', '62968178033'),
      ('Alex Maia', '62998009377'),
      ('John', '62926605000'),
      ('Renata', '62924747922'),
      ('Maylon', '67840140099'),
      ('Fernando Peres', '62816297211'),
      ('Gil', '62996484477'),
      ('Wender', '62912478600'),
      ('Francine', '62995890066'),
      ('Daniel', '62829810377'),
      ('Araújo', '62996484199'),
      ('Ana Paula', '62850441977'),
      ('Delan', '62857741511'),
      ('Leticia', '62822650199'),
      ('Estevão', '62843715499'),
      ('Luzilene', '62965380677'),
      ('Ellen', '62818658866'),
      ('Aline (Gerente Leads Toyota)', '62849189577'),
      ('Aila', '62980025944'),
      ('Carina', '62998233933'),
      ('Monica', '62996004800'),
      ('Augusto (Gerente Leads Nissan)', '62991682756'),
      ('Jordana', '62982792972'),
      ('Priscila', '62967113177'),
      ('Thiago (Leads Primeira Mão)', '62819793522'),
      ('Fernando Moura', '62923510077'),
      ('Allan (MT)', '65999485458'),
      ('Alex Minas (MT)', '65999621043'),
      ('Edson Maia (MT)', '65981332755'),
      ('Jonilson (MT)', '65981332729'),
      ('Jane Maria (MT)', '65999725586'),
      ('Jeovane Dias (MT)', '65984035001'),
      ('Julio Cesar (MT)', '65996223267'),
      ('Gian (Brasília)', '62999640701'),
      ('Caio (Brasília)', '61999427145'),
      ('Claudio (Brasília)', '61984128882'),
      ('Luciana (Brasília)', '64999011309'),
      ('Rafael (Brasília)', '65999220165'),
      ('Geise (Brasília)', '61992791248'),
      ('Saulo (Brasília)', '61999024150')
  LOOP
    -- Buscar contato existente pelo telefone
    SELECT c.id INTO v_contato_id
    FROM contatos c
    JOIN eventos_prospeccao ep ON ep.contato_id = c.id
    WHERE ep.prospeccao_id = v_prospeccao_id
    AND (
      REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g') = v_telefone
      OR REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g') = SUBSTRING(v_telefone FROM 3)
      OR REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g') LIKE '%' || SUBSTRING(v_telefone FROM 3 FOR 8) || '%'
    )
    LIMIT 1;

    -- Se não encontrou no evento, criar novo contato
    IF v_contato_id IS NULL THEN
      INSERT INTO contatos (nome, telefone, empresa_id, status, origem)
      VALUES (v_nome, v_telefone, v_empresa_id, 'Check-in', 'grande_evento')
      RETURNING id INTO v_contato_id;

      -- Vincular ao evento
      INSERT INTO eventos_prospeccao (contato_id, prospeccao_id)
      VALUES (v_contato_id, v_prospeccao_id);
    ELSE
      -- Atualizar status para Check-in
      UPDATE contatos SET status = 'Check-in', updated_at = NOW()
      WHERE id = v_contato_id;
    END IF;

    -- Registrar visita na recepção (se não existir)
    INSERT INTO recepcao_visitas (nome_cliente, telefone_cliente, prospeccao_id, empresa_id, nome_campanha)
    SELECT v_nome, v_telefone, v_prospeccao_id, v_empresa_id, 'Mktour 2'
    WHERE NOT EXISTS (
      SELECT 1 FROM recepcao_visitas rv
      WHERE rv.prospeccao_id = v_prospeccao_id
      AND (
        REGEXP_REPLACE(rv.telefone_cliente, '[^0-9]', '', 'g') = v_telefone
        OR REGEXP_REPLACE(rv.telefone_cliente, '[^0-9]', '', 'g') = SUBSTRING(v_telefone FROM 3)
      )
    );

    -- Log de movimentação
    INSERT INTO logs_movimentacao_contatos (contato_id, status_anterior, status_novo, observacoes, prospeccao_id)
    VALUES (v_contato_id, 'Importado', 'Check-in', 'Check-in em lote via administração', v_prospeccao_id);

  END LOOP;
END $$;
