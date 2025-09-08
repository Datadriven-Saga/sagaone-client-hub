-- Replicar os 4 agentes de IA da Saga Toyota T7 para todas as empresas
DO $$
DECLARE
    source_empresa_id uuid;
    target_empresa_id uuid;
    agente_record record;
    new_agente_id uuid;
    cadencia_record record;
    integracao_record record;
    followup_record record;
BEGIN
    -- Buscar o ID da empresa Saga Toyota T7
    SELECT id INTO source_empresa_id 
    FROM empresas 
    WHERE nome_empresa = 'Saga Toyota T7';
    
    -- Se não encontrar a empresa fonte, sair
    IF source_empresa_id IS NULL THEN
        RAISE NOTICE 'Empresa Saga Toyota T7 não encontrada';
        RETURN;
    END IF;
    
    -- Para cada empresa (exceto a Saga Toyota T7)
    FOR target_empresa_id IN 
        SELECT id FROM empresas WHERE id != source_empresa_id
    LOOP
        -- Para cada agente da empresa fonte
        FOR agente_record IN 
            SELECT * FROM agentes_ia WHERE empresa_id = source_empresa_id
        LOOP
            -- Criar novo agente
            new_agente_id := gen_random_uuid();
            
            INSERT INTO agentes_ia (
                id, nome, persona, cerebro, telefone, foto_url, 
                ativo, empresa_id, criado_por, created_at, updated_at
            ) VALUES (
                new_agente_id,
                agente_record.nome,
                agente_record.persona,
                agente_record.cerebro,
                agente_record.telefone,
                agente_record.foto_url,
                agente_record.ativo,
                target_empresa_id,
                agente_record.criado_por,
                now(),
                now()
            );
            
            -- Replicar cadência se existir
            SELECT * INTO cadencia_record 
            FROM agente_cadencias 
            WHERE agente_id = agente_record.id;
            
            IF FOUND THEN
                INSERT INTO agente_cadencias (
                    id, agente_id, quantidade_etapas, delay_inicial_minutos,
                    intervalo_etapas_minutos, horario_inicio, horario_fim,
                    dias_semana, timezone, ativo, gatilho_cadencia,
                    empresa_id, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(),
                    new_agente_id,
                    cadencia_record.quantidade_etapas,
                    cadencia_record.delay_inicial_minutos,
                    cadencia_record.intervalo_etapas_minutos,
                    cadencia_record.horario_inicio,
                    cadencia_record.horario_fim,
                    cadencia_record.dias_semana,
                    cadencia_record.timezone,
                    cadencia_record.ativo,
                    cadencia_record.gatilho_cadencia,
                    target_empresa_id,
                    now(),
                    now()
                );
            END IF;
            
            -- Replicar integração se existir
            SELECT * INTO integracao_record 
            FROM agente_integracoes 
            WHERE agente_id = agente_record.id;
            
            IF FOUND THEN
                INSERT INTO agente_integracoes (
                    id, agente_id, evolution_id, banco_dados_ia,
                    tabela_historico_ia, webhook_url, webhook_metodo,
                    ativo, empresa_id, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(),
                    new_agente_id,
                    integracao_record.evolution_id,
                    integracao_record.banco_dados_ia,
                    integracao_record.tabela_historico_ia,
                    integracao_record.webhook_url,
                    integracao_record.webhook_metodo,
                    integracao_record.ativo,
                    target_empresa_id,
                    now(),
                    now()
                );
            END IF;
            
            -- Replicar followups se existirem
            FOR followup_record IN 
                SELECT * FROM agente_followups WHERE agente_id = agente_record.id
            LOOP
                INSERT INTO agente_followups (
                    id, agente_id, nome, descricao, tipo, webhook_url,
                    ativo, acoes, condicoes, empresa_id, criado_por,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(),
                    new_agente_id,
                    followup_record.nome,
                    followup_record.descricao,
                    followup_record.tipo,
                    followup_record.webhook_url,
                    followup_record.ativo,
                    followup_record.acoes,
                    followup_record.condicoes,
                    target_empresa_id,
                    followup_record.criado_por,
                    now(),
                    now()
                );
            END LOOP;
            
        END LOOP;
        
    END LOOP;
    
    RAISE NOTICE 'Agentes replicados com sucesso para todas as empresas';
    
END $$;