// Sync PRI Dashboard - Sincroniza dados do webhook sincroniza_sagaone para Supabase
// Atualiza tabelas prospect_pri_voz e cadencia_pri_voz
// Dashboard consulta dados localmente do Supabase após sincronização

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYNC_WEBHOOK_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/sincroniza_sagaone';
const SAGA_ONE = Deno.env.get('SAGA_ONE') ?? '';

// Interface baseada no formato exato enviado pelo webhook
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

    console.log(`🔄 Sincronizando dados do sincroniza_sagaone para evento ${id_evento}, telefone_pri: ${telefone_pri}`);

    // Inicializar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar dados do webhook sincroniza_sagaone
    console.log(`📡 Chamando webhook de sincronização: ${SYNC_WEBHOOK_URL}`);

    const webhookResponse = await fetch(SYNC_WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
      },
      body: JSON.stringify({
        telefone_pri: String(telefone_pri).replace(/\D/g, ''),
        id_evento: Number(id_evento),
      }),
    });

    const webhookText = await webhookResponse.text();
    console.log(`📥 Resposta do sincroniza_sagaone (status ${webhookResponse.status}): ${webhookText.substring(0, 1000)}...`);

    if (!webhookResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Webhook de sincronização retornou erro', status: webhookResponse.status, raw: webhookText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parsear resposta do webhook
    let leadsSync: LeadSync[] = [];
    try {
      const parsed = JSON.parse(webhookText);
      
      // Webhook retorna array de leads diretamente ou dentro de propriedade
      if (Array.isArray(parsed)) {
        leadsSync = parsed;
      } else if (parsed?.leads || parsed?.data || parsed?.contatos) {
        leadsSync = parsed.leads || parsed.data || parsed.contatos;
      } else if (parsed && typeof parsed === 'object' && parsed.telefone_lead) {
        // Objeto único
        leadsSync = [parsed];
      }
    } catch (e) {
      console.error('❌ Erro ao parsear resposta:', e);
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do webhook', raw: webhookText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Leads recebidos do webhook: ${leadsSync.length}`);

    if (leadsSync.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum lead retornado pelo webhook', 
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

    // 3. Preparar dados para prospect_pri_voz
    const prospectRecords = leadsSync.map((lead) => {
      const telefoneLead = String(lead.telefone_lead || '').replace(/\D/g, '');
      const telefonePri = String(lead.telefone_pri || telefone_pri || '').replace(/\D/g, '');
      
      return {
        telefone_lead: telefoneLead,
        id_evento: Number(lead.id_evento || id_evento),
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
    }).filter(r => r.telefone_lead); // Filtrar registros sem telefone

    // 4. Preparar dados para cadencia_pri_voz
    const cadenciaRecords = leadsSync.map((lead) => {
      const telefoneLead = String(lead.telefone_lead || '').replace(/\D/g, '');
      const telefonePri = String(lead.telefone_pri || telefone_pri || '').replace(/\D/g, '');
      
      return {
        telefone_lead: telefoneLead,
        telefone_pri: telefonePri,
        id_evento: Number(lead.id_evento || id_evento),
        num_tentativas: lead.num_tentativas ?? 0,
        hora_primeira_tentativa: lead.hora_primeira_tentativa || null,
        hora_ultima_tentativa: lead.hora_ultima_tentativa || null,
        empresa_id: empresa_id,
        atualizado_em: new Date().toISOString(),
      };
    }).filter(r => r.telefone_lead);

    console.log(`📝 Preparados ${prospectRecords.length} para prospect_pri_voz, ${cadenciaRecords.length} para cadencia_pri_voz`);

    // 5. Upsert em lotes para prospect_pri_voz
    const batchSize = 100;
    
    for (let i = 0; i < prospectRecords.length; i += batchSize) {
      const batch = prospectRecords.slice(i, i + batchSize);
      
      const { error: upsertError } = await supabase
        .from('prospect_pri_voz')
        .upsert(batch, { 
          onConflict: 'telefone_lead,id_evento',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`⚠️ Erro prospect_pri_voz batch ${i / batchSize + 1}:`, upsertError);
        result.errors.push(`prospect batch ${i / batchSize + 1}: ${upsertError.message}`);
      } else {
        result.prospect_upserted += batch.length;
      }
    }

    // 6. Upsert em lotes para cadencia_pri_voz
    for (let i = 0; i < cadenciaRecords.length; i += batchSize) {
      const batch = cadenciaRecords.slice(i, i + batchSize);
      
      const { error: upsertError } = await supabase
        .from('cadencia_pri_voz')
        .upsert(batch, { 
          onConflict: 'telefone_lead,id_evento',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`⚠️ Erro cadencia_pri_voz batch ${i / batchSize + 1}:`, upsertError);
        result.errors.push(`cadencia batch ${i / batchSize + 1}: ${upsertError.message}`);
      } else {
        result.cadencia_upserted += batch.length;
      }
    }

    console.log(`✅ Sync concluído: ${result.prospect_upserted} prospects, ${result.cadencia_upserted} cadencias salvos`);

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
