// Sync PRI Dashboard - Sincroniza dados do webhook dash-pri para Supabase
// Atualiza tabelas prospect_pri_voz e cadencia_pri_voz
// Dashboard consulta dados localmente do Supabase após sincronização

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Usar o endpoint dash-pri que retorna todos os contatos do evento
const DASH_PRI_WEBHOOK_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/dash-pri';
const SAGA_ONE = Deno.env.get('SAGA_ONE') ?? '';

// Interface baseada no formato exato enviado pelo webhook dash-pri
interface LeadSync {
  telefone_lead: string;
  id_evento: number;
  nome?: string;
  telefone_pri?: string;
  proposal_id?: string | null;
  loja?: string;
  ligacao_atendida?: boolean;
  status_agendado?: boolean;
  enviado_whatsapp?: boolean;
  ligacao_erro?: boolean;
  criado_em?: string;
  atualizado_em?: string;
  lead_id?: string;
  num_tentativas?: number;
  tentativas?: number; // Alias usado em alguns payloads
  hora_primeira_tentativa?: string | null;
  hora_ultima_tentativa?: string | null;
  evt_status?: string;
}

interface SyncResult {
  total_webhook: number;
  prospect_upserted: number;
  cadencia_upserted: number;
  errors: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone_pri, id_evento, empresa_id } = await req.json();

    if (!telefone_pri) {
      return new Response(
        JSON.stringify({ error: 'telefone_pri é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!id_evento) {
      return new Response(
        JSON.stringify({ error: 'id_evento é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: 'empresa_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const telefonePriClean = String(telefone_pri).replace(/\D/g, '');
    const idEventoNum = Number(id_evento);

    console.log(`🔄 Sincronizando dados do dash-pri para evento ${idEventoNum}, telefone_pri: ${telefonePriClean}`);

    // Inicializar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar TODOS os dados do webhook dash-pri (sem paginação - retorna tudo)
    console.log(`📡 Chamando webhook dash-pri: ${DASH_PRI_WEBHOOK_URL}`);

    const webhookResponse = await fetch(DASH_PRI_WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
      },
      body: JSON.stringify({
        telefone_pri: telefonePriClean,
        id_evento: idEventoNum,
      }),
    });

    const webhookText = await webhookResponse.text();
    console.log(`📥 Resposta do dash-pri (status ${webhookResponse.status}): ${webhookText.length} caracteres`);
    console.log(`📥 Preview: ${webhookText.substring(0, 500)}...`);

    if (!webhookResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Webhook dash-pri retornou erro', status: webhookResponse.status, raw: webhookText.substring(0, 1000) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parsear resposta do webhook
    let leadsSync: LeadSync[] = [];
    try {
      const parsed = JSON.parse(webhookText);
      
      // dash-pri pode retornar array direto ou dentro de propriedade
      if (Array.isArray(parsed)) {
        leadsSync = parsed;
      } else if (parsed?.leads || parsed?.data || parsed?.contatos || parsed?.dados_contatos) {
        leadsSync = parsed.leads || parsed.data || parsed.contatos || parsed.dados_contatos;
      } else if (parsed && typeof parsed === 'object' && parsed.telefone_lead) {
        // Objeto único
        leadsSync = [parsed];
      }
    } catch (e) {
      console.error('❌ Erro ao parsear resposta:', e);
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do webhook', raw: webhookText.substring(0, 500) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Total de leads recebidos do webhook: ${leadsSync.length}`);

    if (leadsSync.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum lead retornado pelo webhook dash-pri', 
          result: { total_webhook: 0, prospect_upserted: 0, cadencia_upserted: 0, errors: [] } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: SyncResult = {
      total_webhook: leadsSync.length,
      prospect_upserted: 0,
      cadencia_upserted: 0,
      errors: [],
    };

    // 3. Preparar dados para prospect_pri_voz (filtrar registros válidos)
    const prospectRecords = leadsSync
      .map((lead) => {
        const telefoneLead = String(lead.telefone_lead || '').replace(/\D/g, '');
        const telefonePri = String(lead.telefone_pri || telefone_pri || '').replace(/\D/g, '');
        
        // Ignorar registros sem telefone_lead válido (mínimo 10 dígitos)
        if (!telefoneLead || telefoneLead.length < 10) {
          return null;
        }
        
        return {
          telefone_lead: telefoneLead,
          id_evento: Number(lead.id_evento || idEventoNum),
          nome: lead.nome || null,
          telefone_pri: telefonePri,
          proposal_id: lead.proposal_id || null,
          loja: lead.loja || null,
          ligacao_atendida: lead.ligacao_atendida ?? false,
          status_agendado: lead.status_agendado ?? false,
          enviado_whatsapp: lead.enviado_whatsapp ?? false,
          ligacao_erro: lead.ligacao_erro ?? false,
          lead_id: lead.lead_id || null,
          empresa_id: empresa_id,
          criado_em: lead.criado_em || new Date().toISOString(),
          atualizado_em: lead.atualizado_em || new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // 4. Preparar dados para cadencia_pri_voz
    const cadenciaRecords = leadsSync
      .map((lead) => {
        const telefoneLead = String(lead.telefone_lead || '').replace(/\D/g, '');
        const telefonePri = String(lead.telefone_pri || telefone_pri || '').replace(/\D/g, '');
        
        // Ignorar registros sem telefone_lead válido
        if (!telefoneLead || telefoneLead.length < 10) {
          return null;
        }
        
        return {
          telefone_lead: telefoneLead,
          telefone_pri: telefonePri,
          id_evento: Number(lead.id_evento || idEventoNum),
          num_tentativas: lead.num_tentativas ?? lead.tentativas ?? 0,
          hora_primeira_tentativa: lead.hora_primeira_tentativa || null,
          hora_ultima_tentativa: lead.hora_ultima_tentativa || null,
          empresa_id: empresa_id,
          atualizado_em: new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const invalidCount = leadsSync.length - prospectRecords.length;
    if (invalidCount > 0) {
      console.log(`⚠️ ${invalidCount} registros ignorados (telefone_lead inválido ou ausente)`);
    }

    console.log(`📝 Preparados ${prospectRecords.length} para prospect_pri_voz, ${cadenciaRecords.length} para cadencia_pri_voz`);

    // 5. Upsert em lotes para prospect_pri_voz (lotes menores para maior confiabilidade)
    const batchSize = 500;
    
    for (let i = 0; i < prospectRecords.length; i += batchSize) {
      const batch = prospectRecords.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(prospectRecords.length / batchSize);
      
      console.log(`📤 Upsert prospect_pri_voz batch ${batchNum}/${totalBatches} (${batch.length} registros)`);
      
      const { error: upsertError } = await supabase
        .from('prospect_pri_voz')
        .upsert(batch, { 
          onConflict: 'telefone_lead,id_evento',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`⚠️ Erro prospect_pri_voz batch ${batchNum}:`, upsertError);
        result.errors.push(`prospect batch ${batchNum}: ${upsertError.message}`);
      } else {
        result.prospect_upserted += batch.length;
      }
    }

    // 6. Upsert em lotes para cadencia_pri_voz
    for (let i = 0; i < cadenciaRecords.length; i += batchSize) {
      const batch = cadenciaRecords.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(cadenciaRecords.length / batchSize);
      
      console.log(`📤 Upsert cadencia_pri_voz batch ${batchNum}/${totalBatches} (${batch.length} registros)`);
      
      const { error: upsertError } = await supabase
        .from('cadencia_pri_voz')
        .upsert(batch, { 
          onConflict: 'telefone_lead,id_evento',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`⚠️ Erro cadencia_pri_voz batch ${batchNum}:`, upsertError);
        result.errors.push(`cadencia batch ${batchNum}: ${upsertError.message}`);
      } else {
        result.cadencia_upserted += batch.length;
      }
    }

    console.log(`✅ Sync concluído: ${result.prospect_upserted} prospects, ${result.cadencia_upserted} cadencias salvos (de ${result.total_webhook} do webhook)`);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});