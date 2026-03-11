import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Webhooks externos para sincronização
const WEBHOOK_CRIA_EVENTO = 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-evento-ligacao';
const WEBHOOK_CRIA_BASE = 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-base-ligacao';

interface ContatoInput {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
}

interface RequestBody {
  contatos: ContatoInput[];
  id_evento: number;
  telefone_pri: string;
  empresa_id: string;
  prospeccao_id: string;
  loja?: string;
  sync_external?: boolean;
}

// Normaliza telefone para exatamente 10 dígitos (DDD + 8 dígitos, sem o 9 inicial)
const normalizePhoneTo10Digits = (phone: string | null): { valid: boolean; normalized: string; original: string } => {
  const original = phone || '';
  if (!phone) return { valid: false, normalized: '', original };
  
  let digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith('0055')) digits = digits.slice(4);
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
  if (digits.length === 11 && digits[2] === '9') digits = digits.slice(0, 2) + digits.slice(3);
  
  if (digits.length !== 10) return { valid: false, normalized: '', original };
  if (!/^[1-9]\d$/.test(digits.slice(0, 2))) return { valid: false, normalized: '', original };
  
  return { valid: true, normalized: digits, original };
};

// Normaliza telefone mantendo formato original (apenas dígitos)
const normalizePhone = (phone: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith('0055')) digits = digits.slice(4);
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
  return digits;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 [${requestId}] CREATE-BASE-LIGACAO - Iniciando`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const body: RequestBody = await req.json();
    const { 
      contatos, 
      id_evento, 
      telefone_pri, 
      empresa_id, 
      prospeccao_id,
      loja,
      sync_external = true 
    } = body;

    if (!contatos || contatos.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum contato fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!id_evento) {
      return new Response(
        JSON.stringify({ success: false, error: 'id_evento é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const skipLocalSave = !empresa_id;

    console.log(`📥 [${requestId}] Dados recebidos:`);
    console.log(`   ├─ Total contatos: ${contatos.length}`);
    console.log(`   ├─ ID Evento: ${id_evento}`);
    console.log(`   ├─ Telefone Pri: ${telefone_pri}`);
    console.log(`   ├─ Empresa ID: ${empresa_id}`);
    console.log(`   ├─ Prospecção ID: ${prospeccao_id}`);
    console.log(`   ├─ Loja (param): ${loja || 'N/A'}`);
    console.log(`   └─ Sync External: ${sync_external}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =====================================================
    // BUSCAR NOME DA EMPRESA (SEMPRE do banco, nunca do agente)
    // =====================================================
    let nomeEmpresa = '';
    if (empresa_id) {
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nome_empresa')
        .eq('id', empresa_id)
        .single();
      nomeEmpresa = empresaData?.nome_empresa || '';
    }
    if (!nomeEmpresa) {
      nomeEmpresa = loja || '';
    }

    console.log(`🏪 [${requestId}] Nome da loja (empresa): "${nomeEmpresa}"`);

    const telefonePriResult = normalizePhoneTo10Digits(telefone_pri);
    const telefonePriNormalizado = telefonePriResult.normalized || telefone_pri.replace(/\D/g, '');
    const now = new Date().toISOString();

    // Validar e normalizar telefones
    const contatosValidados = contatos.map(contato => {
      const result = normalizePhoneTo10Digits(contato.telefone);
      return { ...contato, phoneResult: result };
    });
    
    const contatosValidos = contatosValidados.filter(c => c.phoneResult.valid);
    const contatosInvalidos = contatosValidados.filter(c => !c.phoneResult.valid);
    
    console.log(`📊 [${requestId}] Validação: ${contatosValidos.length} válidos, ${contatosInvalidos.length} inválidos`);

    // =====================================================
    // ETAPA 1: BUSCAR TODOS OS CONTATOS DA EMPRESA EM BULK
    // e mapear lead_id por telefone normalizado
    // =====================================================
    const leadIdMap = new Map<string, { contato_id: string; lead_id: number | null }>();
    let contatosCriados = 0;
    let contatosVinculados = 0;

    if (!skipLocalSave && prospeccao_id) {
      console.log(`\n📌 [${requestId}] ETAPA 1: Buscando contatos existentes em BULK...`);

      // 1a) Buscar TODOS os contatos da empresa de uma vez (em batches de 1000)
      const existingMap = new Map<string, { id: string; lead_id: number | null }>();
      let offset = 0;
      const BULK_LIMIT = 1000;
      
      while (true) {
        const { data: rows, error: fetchErr } = await supabase
          .from('contatos')
          .select('id, telefone, lead_id')
          .eq('empresa_id', empresa_id)
          .not('telefone', 'is', null)
          .range(offset, offset + BULK_LIMIT - 1);
        
        if (fetchErr) {
          console.error(`⚠️ [${requestId}] Erro ao buscar contatos bulk offset ${offset}:`, fetchErr);
          break;
        }
        
        if (!rows || rows.length === 0) break;
        
        for (const row of rows) {
          if (row.telefone) {
            const phone10 = normalizePhoneTo10Digits(row.telefone);
            if (phone10.valid) {
              existingMap.set(phone10.normalized, { id: row.id, lead_id: row.lead_id });
            }
            // Also map by raw normalized digits
            const norm = normalizePhone(row.telefone);
            if (norm) {
              existingMap.set(norm, { id: row.id, lead_id: row.lead_id });
            }
          }
        }
        
        if (rows.length < BULK_LIMIT) break;
        offset += BULK_LIMIT;
      }

      console.log(`📊 [${requestId}] Contatos existentes na empresa: ${existingMap.size} mapeamentos`);

      // 1b) Separar novos vs existentes
      const contatosParaCriar: ContatoInput[] = [];
      const contatosExistentes: { input: ContatoInput; contato_id: string; lead_id: number | null }[] = [];

      for (const contato of contatos) {
        const telefoneNormalizado = normalizePhone(contato.telefone);
        if (!telefoneNormalizado) continue;

        const phone10 = normalizePhoneTo10Digits(contato.telefone);
        const lookupKey = phone10.valid ? phone10.normalized : telefoneNormalizado;
        const existing = existingMap.get(lookupKey);

        if (existing) {
          contatosExistentes.push({ input: contato, contato_id: existing.id, lead_id: existing.lead_id });
          if (phone10.valid) {
            leadIdMap.set(phone10.normalized, { contato_id: existing.id, lead_id: existing.lead_id });
          }
        } else {
          contatosParaCriar.push(contato);
        }
      }

      console.log(`📊 [${requestId}] Para criar: ${contatosParaCriar.length}, Existentes: ${contatosExistentes.length}`);

      // 1c) Criar novos contatos em lotes de 500 (telefone normalizado sem o 9)
      const INSERT_BATCH = 500;
      for (let i = 0; i < contatosParaCriar.length; i += INSERT_BATCH) {
        const batch = contatosParaCriar.slice(i, i + INSERT_BATCH).map(c => {
          const phone10 = normalizePhoneTo10Digits(c.telefone);
          return {
            nome: c.nome || `Contato ${normalizePhone(c.telefone)}`,
            telefone: phone10.valid ? phone10.normalized : normalizePhone(c.telefone),
            email: c.email || null,
            status: 'Novo',
            origem: 'ligacao',
            empresa_id: empresa_id,
          };
        });

        const { data: created, error: createError } = await supabase
          .from('contatos')
          .insert(batch)
          .select('id, telefone, lead_id');

        if (createError) {
          console.error(`⚠️ [${requestId}] Erro ao criar lote ${Math.floor(i / INSERT_BATCH) + 1}:`, createError);
          continue;
        }

        if (created) {
          contatosCriados += created.length;
          for (const row of created) {
            if (row.telefone) {
              const phone10 = normalizePhoneTo10Digits(row.telefone);
              if (phone10.valid) {
                leadIdMap.set(phone10.normalized, { contato_id: row.id, lead_id: row.lead_id });
              }
            }
          }
        }
      }

      // 1d) Atualizar telefones existentes que ainda têm o 9º dígito
      const telefonesParaAtualizar: { id: string; telefone: string }[] = [];
      for (const c of contatosExistentes) {
        const currentPhone = normalizePhone(c.input.telefone);
        const phone10 = normalizePhoneTo10Digits(c.input.telefone);
        if (phone10.valid && currentPhone.length === 11 && currentPhone[2] === '9') {
          telefonesParaAtualizar.push({ id: c.contato_id, telefone: phone10.normalized });
        }
      }

      if (telefonesParaAtualizar.length > 0) {
        console.log(`📞 [${requestId}] Atualizando ${telefonesParaAtualizar.length} telefones para formato 10 dígitos (sem 9)...`);
        for (let i = 0; i < telefonesParaAtualizar.length; i += INSERT_BATCH) {
          const batch = telefonesParaAtualizar.slice(i, i + INSERT_BATCH);
          for (const item of batch) {
            await supabase
              .from('contatos')
              .update({ telefone: item.telefone, updated_at: now })
              .eq('id', item.id);
          }
        }
        console.log(`✅ [${requestId}] Telefones atualizados`);
      }

      // 1d) Vincular todos ao evento em lotes de 500
      const allContatoIds = [
        ...contatosExistentes.map(c => c.contato_id),
        ...[...leadIdMap.values()].map(v => v.contato_id),
      ];
      const uniqueContatoIds = [...new Set(allContatoIds)];

      // Buscar vínculos existentes em lote
      const existingVinculos = new Set<string>();
      for (let i = 0; i < uniqueContatoIds.length; i += 1000) {
        const idBatch = uniqueContatoIds.slice(i, i + 1000);
        const { data: vinculos } = await supabase
          .from('eventos_prospeccao')
          .select('contato_id')
          .eq('prospeccao_id', prospeccao_id)
          .in('contato_id', idBatch);
        
        if (vinculos) {
          vinculos.forEach(v => existingVinculos.add(v.contato_id));
        }
      }

      // Inserir vínculos faltantes em lotes
      const vinculosParaCriar = uniqueContatoIds
        .filter(id => !existingVinculos.has(id))
        .map(id => ({
          contato_id: id,
          prospeccao_id: prospeccao_id,
          tipo_evento: 'Contato Inicial',
        }));

      for (let i = 0; i < vinculosParaCriar.length; i += INSERT_BATCH) {
        const batch = vinculosParaCriar.slice(i, i + INSERT_BATCH);
        const { error: linkError } = await supabase
          .from('eventos_prospeccao')
          .insert(batch);

        if (!linkError) {
          contatosVinculados += batch.length;
        } else {
          console.error(`⚠️ [${requestId}] Erro ao vincular lote:`, linkError);
        }
      }

      console.log(`✅ [${requestId}] Contatos criados: ${contatosCriados}, Vínculos: ${contatosVinculados}, lead_ids mapeados: ${leadIdMap.size}`);
    }

    // =====================================================
    // ETAPA 2: SALVAR EM prospect_pri_voz (com lead_id)
    // =====================================================
    let totalUpserted = 0;
    let upsertErrors: string[] = [];

    if (!skipLocalSave) {
      console.log(`\n💾 [${requestId}] ETAPA 2: Salvando em prospect_pri_voz (com lead_id)...`);

      const prospectsToUpsert = contatosValidos.map(contato => {
        const phoneNorm = contato.phoneResult.normalized;
        const mapping = leadIdMap.get(phoneNorm);
        
        return {
          telefone_lead: phoneNorm,
          id_evento: id_evento,
          nome: contato.nome || null,
          telefone_pri: telefonePriNormalizado,
          loja: nomeEmpresa,
          empresa_id: empresa_id,
          lead_id: mapping?.lead_id || null,
          ligacao_atendida: false,
          status_agendado: false,
          enviado_whatsapp: false,
          ligacao_erro: false,
          criado_em: now,
          atualizado_em: now,
        };
      });

      const batchSize = 500;
      for (let i = 0; i < prospectsToUpsert.length; i += batchSize) {
        const batch = prospectsToUpsert.slice(i, i + batchSize);
        const { error: upsertError } = await supabase
          .from('prospect_pri_voz')
          .upsert(batch, { onConflict: 'telefone_lead,id_evento' });

        if (upsertError) {
          console.error(`❌ [${requestId}] Erro no batch ${Math.floor(i / batchSize) + 1}:`, upsertError);
          upsertErrors.push(upsertError.message);
        } else {
          totalUpserted += batch.length;
        }
      }

      console.log(`✅ [${requestId}] ${totalUpserted}/${contatosValidos.length} salvos em prospect_pri_voz`);
    }

    // =====================================================
    // ETAPA 2.5: CHAMAR cria-evento-ligacao ANTES de cria-base-ligacao
    // Garante que o evento exista no sistema externo antes de enviar contatos
    // =====================================================
    if (sync_external && id_evento && empresa_id) {
      console.log(`\n📞 [${requestId}] ETAPA 2.5: Chamando cria-evento-ligacao para garantir evento externo...`);
      
      try {
        const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
        
        // Buscar dados do evento em eventos_pri_voz
        const { data: evtData } = await supabase
          .from('eventos_pri_voz')
          .select('*')
          .eq('id_evento', id_evento)
          .eq('empresa_id', empresa_id)
          .maybeSingle();
        
        // Buscar dados completos da empresa
        const { data: empresaCompleta } = await supabase
          .from('empresas')
          .select('id, nome_empresa, cnpj, crm_id, uf, marca, cidade, endereco')
          .eq('id', empresa_id)
          .single();
        
        const dealerId = (empresaCompleta?.crm_id || '').trim();
        
        // Buscar telefone Pri WhatsApp
        let telefonePriWhatsapp = '';
        const { data: agentesVinculados } = await supabase
          .from('agente_empresas')
          .select('agente_id, agentes_ia(id, nome, telefone, ativo)')
          .eq('empresa_id', empresa_id);
        
        const agentes = (agentesVinculados || [])
          .map((ae: any) => ae.agentes_ia)
          .filter((a: any) => a && a.ativo);
        
        const searchPatternsWhatsapp = ['pri - whatsapp', 'pri whatsapp', 'pri-whatsapp'];
        const agentePriWhatsapp = agentes.find((a: any) => {
          const nome = String(a?.nome || '').toLowerCase();
          return searchPatternsWhatsapp.some(pattern => nome.includes(pattern)) && a?.telefone;
        });
        if (agentePriWhatsapp?.telefone) {
          telefonePriWhatsapp = agentePriWhatsapp.telefone.replace(/\D/g, '');
        }
        
        // Buscar prospecção para dados extras
        const { data: prospData } = await supabase
          .from('prospeccoes')
          .select('titulo, descricao, data_inicio, data_fim, uf, cidade, endereco')
          .eq('event_id_pri', String(id_evento))
          .eq('empresa_id', empresa_id)
          .eq('canal', 'Ligação')
          .maybeSingle();
        
        const eventoPayload = {
          id_evento: id_evento,
          nome: evtData?.nome || prospData?.titulo || `Evento Ligação ${id_evento}`,
          descricao: evtData?.descricao || prospData?.descricao || '',
          categoria: 'evento',
          marca: empresaCompleta?.marca || empresaCompleta?.nome_empresa || '',
          dealerid: dealerId,
          telefone_pri: telefonePriNormalizado,
          telefone_pri_whatsapp: telefonePriWhatsapp || evtData?.telefone_pri_whatsapp || '',
          pri_dealer_id: dealerId,
          uf: evtData?.uf || prospData?.uf || empresaCompleta?.uf || '',
          cidade: evtData?.cidade || prospData?.cidade || empresaCompleta?.cidade || '',
          endereco: evtData?.endereco || prospData?.endereco || empresaCompleta?.endereco || '',
          data_inicio: evtData?.data_inicio || prospData?.data_inicio || '',
          data_fim: evtData?.data_fim || prospData?.data_fim || '',
          evt_status: evtData?.evt_status || 'ativo',
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        };
        
        console.log(`📤 [${requestId}] Payload cria-evento-ligacao: id_evento=${id_evento}, nome="${eventoPayload.nome}", dealer="${dealerId}"`);
        
        const evtResponse = await fetch(WEBHOOK_CRIA_EVENTO, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
          },
          body: JSON.stringify({ evento: eventoPayload }),
        });
        
        const evtResponseText = await evtResponse.text();
        
        if (evtResponse.ok) {
          console.log(`✅ [${requestId}] cria-evento-ligacao OK (status ${evtResponse.status})`);
        } else {
          console.warn(`⚠️ [${requestId}] cria-evento-ligacao falhou (status ${evtResponse.status}): ${evtResponseText.substring(0, 300)}`);
        }
      } catch (evtError) {
        console.error(`⚠️ [${requestId}] Erro ao chamar cria-evento-ligacao (não crítico):`, evtError);
      }
    }

    // =====================================================
    // ETAPA 3: SINCRONIZAR COM WEBHOOK EXTERNO (com lead_id e loja correta)
    // =====================================================
    let externalSyncResult: { success: boolean; status?: number; message?: string } = { success: false };

    if (sync_external) {
      console.log(`\n🌐 [${requestId}] ETAPA 3: Sincronizando com sistema externo...`);

      const externalContatos = contatosValidos.map(c => {
        const mapping = leadIdMap.get(c.phoneResult.normalized);
        return {
          nome: c.nome || '',
          telefone: c.phoneResult.normalized,
          lead_id: mapping?.lead_id || null,
        };
      });

      const contatosComLeadId = externalContatos.filter(c => c.lead_id !== null).length;
      const contatosSemLeadId = externalContatos.filter(c => c.lead_id === null).length;
      console.log(`📤 [${requestId}] Total contatos para webhook externo: ${externalContatos.length} (com lead_id: ${contatosComLeadId}, sem lead_id: ${contatosSemLeadId})`);

      try {
        const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
        const EXTERNAL_BATCH = 500;
        let externalSuccessCount = 0;
        let externalErrorCount = 0;

        for (let i = 0; i < externalContatos.length; i += EXTERNAL_BATCH) {
          const batch = externalContatos.slice(i, i + EXTERNAL_BATCH);
          const batchNum = Math.floor(i / EXTERNAL_BATCH) + 1;
          const totalBatches = Math.ceil(externalContatos.length / EXTERNAL_BATCH);

          const externalPayload = {
            id_evento: id_evento,
            telefone_pri: telefonePriNormalizado,
            loja: nomeEmpresa,
            total_contatos: batch.length,
            contatos: batch,
          };

          console.log(`📤 [${requestId}] Webhook externo lote ${batchNum}/${totalBatches} (${batch.length} contatos)`);

          const response = await fetch(WEBHOOK_CRIA_BASE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
            },
            body: JSON.stringify(externalPayload),
          });

          const responseText = await response.text();

          if (response.ok) {
            externalSuccessCount += batch.length;
            console.log(`✅ [${requestId}] Lote externo ${batchNum} OK (status ${response.status})`);
          } else {
            externalErrorCount += batch.length;
            console.warn(`⚠️ [${requestId}] Lote externo ${batchNum} falhou (status ${response.status}): ${responseText.substring(0, 200)}`);
          }
        }

        externalSyncResult = {
          success: externalErrorCount === 0,
          message: `${externalSuccessCount} enviados, ${externalErrorCount} falhas`,
        };

        console.log(`✅ [${requestId}] Sincronização externa: ${externalSuccessCount} OK, ${externalErrorCount} erros`);
      } catch (externalError) {
        console.error(`❌ [${requestId}] Erro na sincronização externa (não crítico):`, externalError);
        externalSyncResult = {
          success: false,
          message: String(externalError),
        };
      }
    }

    // =====================================================
    // RESULTADO FINAL
    // =====================================================
    const resultado = {
      success: true,
      summary: {
        total_contatos: contatos.length,
        validos: contatosValidos.length,
        invalidos: contatosInvalidos.length,
        supabase_salvos: totalUpserted,
        contatos_criados: contatosCriados,
        vinculos_criados: contatosVinculados,
        lead_ids_mapeados: leadIdMap.size,
        erros_supabase: upsertErrors.length,
      },
      external_sync: externalSyncResult,
      id_evento: id_evento,
      empresa_id: empresa_id,
      prospeccao_id: prospeccao_id,
    };

    console.log(`\n✅ [${requestId}] CREATE-BASE-LIGACAO concluído:`, JSON.stringify(resultado.summary));

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`❌ [${requestId}] Erro:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
