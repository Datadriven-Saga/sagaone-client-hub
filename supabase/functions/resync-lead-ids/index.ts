import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_CRIA_BASE = 'https://automatemaiawh.sagadatadriven.com.br/webhook/cria-base-ligacao';

const normalizePhoneTo10Digits = (phone: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith('0055')) digits = digits.slice(4);
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
  if (digits.length === 11 && digits[2] === '9') digits = digits.slice(0, 2) + digits.slice(3);
  return digits.length === 10 ? digits : '';
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`🔄 [${requestId}] RESYNC-LEAD-IDS - Iniciando`);

  try {
    const body = await req.json();
    const { id_evento, empresa_id } = body;

    if (!id_evento || !empresa_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'id_evento e empresa_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Buscar todos os prospects do evento
    const allProspects: any[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('prospect_pri_voz')
        .select('id, telefone_lead, lead_id, nome, telefone_pri, loja')
        .eq('id_evento', id_evento)
        .eq('empresa_id', empresa_id)
        .range(offset, offset + 999);
      
      if (error) {
        console.error(`❌ [${requestId}] Erro ao buscar prospects:`, error);
        break;
      }
      if (!data || data.length === 0) break;
      allProspects.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    console.log(`📊 [${requestId}] Total prospects no evento ${id_evento}: ${allProspects.length}`);

    // 2) Buscar contatos existentes da empresa e mapear por telefone
    const phoneToLeadId = new Map<string, number>();
    const existingPhones = new Set<string>();
    offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('contatos')
        .select('telefone, lead_id')
        .eq('empresa_id', empresa_id)
        .not('telefone', 'is', null)
        .range(offset, offset + 999);
      
      if (error || !data || data.length === 0) break;
      
      for (const row of data) {
        const norm = normalizePhoneTo10Digits(row.telefone);
        if (norm) {
          existingPhones.add(norm);
          if (row.lead_id) {
            phoneToLeadId.set(norm, row.lead_id);
          }
        }
      }
      if (data.length < 1000) break;
      offset += 1000;
    }

    console.log(`📊 [${requestId}] Contatos existentes: ${existingPhones.size}, com lead_id: ${phoneToLeadId.size}`);

    // 3) Criar contatos faltantes na tabela contatos
    const prospectsWithoutContato = allProspects.filter(p => {
      const norm = normalizePhoneTo10Digits(p.telefone_lead);
      return norm && !existingPhones.has(norm);
    });

    console.log(`📊 [${requestId}] Prospects sem contato local: ${prospectsWithoutContato.length}`);

    let contatosCriados = 0;
    const BATCH = 500;
    const INSERT_BATCH = 50; // Smaller batches for insert to avoid 500 errors
    
    for (let i = 0; i < prospectsWithoutContato.length; i += INSERT_BATCH) {
      const batch = prospectsWithoutContato.slice(i, i + INSERT_BATCH).map(p => ({
        nome: p.nome || `Contato ${p.telefone_lead}`,
        telefone: p.telefone_lead,
        status: 'Novo',
        origem: 'ligacao',
        empresa_id: empresa_id,
      }));

      const { data: created, error: createError } = await supabase
        .from('contatos')
        .insert(batch)
        .select('telefone, lead_id');

      if (createError) {
        console.error(`⚠️ [${requestId}] Erro ao criar contatos batch ${Math.floor(i/INSERT_BATCH)+1}:`, JSON.stringify(createError));
        continue;
      }

      if (created) {
        contatosCriados += created.length;
        for (const row of created) {
          const norm = normalizePhoneTo10Digits(row.telefone);
          if (norm && row.lead_id) {
            phoneToLeadId.set(norm, row.lead_id);
          }
        }
      }
    }

    console.log(`✅ [${requestId}] Contatos criados: ${contatosCriados}, total lead_ids agora: ${phoneToLeadId.size}`);

    // 4) Atualizar prospect_pri_voz com lead_id
    let updatedCount = 0;
    for (const prospect of allProspects) {
      const norm = normalizePhoneTo10Digits(prospect.telefone_lead);
      const leadId = norm ? phoneToLeadId.get(norm) : null;
      
      if (leadId && prospect.lead_id !== leadId) {
        const { error: updateErr } = await supabase
          .from('prospect_pri_voz')
          .update({ lead_id: leadId, atualizado_em: new Date().toISOString() })
          .eq('id', prospect.id);
        
        if (!updateErr) {
          updatedCount++;
          prospect.lead_id = leadId;
        }
      }
    }

    console.log(`✅ [${requestId}] ${updatedCount} prospects atualizados com lead_id`);

    // 5) Reenviar TODOS para o webhook externo com lead_id
    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
    const telefonePri = allProspects[0]?.telefone_pri || '';
    const loja = allProspects[0]?.loja || '';

    const externalContatos = allProspects.map(p => {
      const norm = normalizePhoneTo10Digits(p.telefone_lead);
      return {
        nome: p.nome || '',
        telefone: p.telefone_lead,
        lead_id: p.lead_id || (norm ? phoneToLeadId.get(norm) : null) || null,
      };
    });

    const comLeadId = externalContatos.filter(c => c.lead_id !== null).length;
    const semLeadId = externalContatos.filter(c => c.lead_id === null).length;
    console.log(`📤 [${requestId}] Reenviando para webhook: ${externalContatos.length} contatos (com lead_id: ${comLeadId}, sem: ${semLeadId})`);

    let externalSuccess = 0;
    let externalFail = 0;

    for (let i = 0; i < externalContatos.length; i += BATCH) {
      const batch = externalContatos.slice(i, i + BATCH);
      const payload = {
        id_evento,
        telefone_pri: telefonePri,
        loja,
        total_contatos: batch.length,
        contatos: batch,
      };

      try {
        const resp = await fetch(WEBHOOK_CRIA_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (resp.ok) {
          externalSuccess += batch.length;
          console.log(`✅ [${requestId}] Batch ${Math.floor(i / BATCH) + 1} OK`);
        } else {
          externalFail += batch.length;
          const txt = await resp.text();
          console.warn(`⚠️ [${requestId}] Batch ${Math.floor(i / BATCH) + 1} falhou: ${txt.substring(0, 200)}`);
        }
      } catch (e) {
        externalFail += batch.length;
        console.error(`❌ [${requestId}] Batch error:`, e);
      }
    }

    const result = {
      success: true,
      id_evento,
      empresa_id,
      total_prospects: allProspects.length,
      contatos_criados: contatosCriados,
      lead_ids_atualizados: updatedCount,
      webhook_enviados: externalSuccess,
      webhook_falhas: externalFail,
      com_lead_id: comLeadId,
      sem_lead_id: semLeadId,
    };

    console.log(`✅ [${requestId}] RESYNC concluído:`, JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`❌ [${requestId}] Erro:`, error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
