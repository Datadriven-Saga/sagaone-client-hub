import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Webhook externo para sincronização
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
    // Fallback: usar parâmetro loja apenas se não encontrou no banco
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
    // ETAPA 1: CRIAR/BUSCAR CONTATOS EM LOTE (contatos table)
    // Gerar lead_id ANTES de enviar ao webhook externo
    // =====================================================
    const leadIdMap = new Map<string, { contato_id: string; lead_id: number | null }>();
    let contatosCriados = 0;
    let contatosVinculados = 0;

    if (!skipLocalSave && prospeccao_id) {
      console.log(`\n📌 [${requestId}] ETAPA 1: Criando/buscando contatos em LOTE...`);

      // 1a) Buscar todos os contatos existentes da empresa de uma vez
      const allPhones = contatos
        .map(c => normalizePhone(c.telefone))
        .filter(Boolean);

      // Buscar contatos existentes em lotes de 500
      const existingMap = new Map<string, { id: string; lead_id: number | null }>();
      const FETCH_BATCH = 500;
      
      for (let i = 0; i < allPhones.length; i += FETCH_BATCH) {
        const phoneBatch = allPhones.slice(i, i + FETCH_BATCH);
        // Build OR filter for phone suffix matching
        const suffixes = [...new Set(phoneBatch.map(p => p.slice(-9)))];
        
        for (const suffix of suffixes) {
          const { data: existing } = await supabase
            .from('contatos')
            .select('id, telefone, lead_id')
            .eq('empresa_id', empresa_id)
            .ilike('telefone', `%${suffix}`)
            .limit(100);
          
          if (existing) {
            for (const row of existing) {
              if (row.telefone) {
                const norm = normalizePhone(row.telefone);
                const phone10 = normalizePhoneTo10Digits(row.telefone);
                if (phone10.valid) {
                  existingMap.set(phone10.normalized, { id: row.id, lead_id: row.lead_id });
                }
                if (norm) {
                  existingMap.set(norm, { id: row.id, lead_id: row.lead_id });
                }
              }
            }
          }
        }
      }

      console.log(`📊 [${requestId}] Contatos existentes encontrados: ${existingMap.size}`);

      // 1b) Separar novos vs existentes
      const contatosParaCriar: ContatoInput[] = [];
      const contatosExistentes: { input: ContatoInput; contato_id: string; lead_id: number | null }[] = [];

      for (const contato of contatos) {
        const telefoneNormalizado = normalizePhone(contato.telefone);
        if (!telefoneNormalizado) continue;

        const phone10 = normalizePhoneTo10Digits(contato.telefone);
        const existing = existingMap.get(phone10.valid ? phone10.normalized : telefoneNormalizado);

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

      // 1c) Criar novos contatos em lotes de 500
      const INSERT_BATCH = 500;
      for (let i = 0; i < contatosParaCriar.length; i += INSERT_BATCH) {
        const batch = contatosParaCriar.slice(i, i + INSERT_BATCH).map(c => ({
          nome: c.nome || `Contato ${normalizePhone(c.telefone)}`,
          telefone: c.telefone,
          email: c.email || null,
          status: 'Novo',
          origem: 'Ligação',
          empresa_id: empresa_id,
        }));

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
