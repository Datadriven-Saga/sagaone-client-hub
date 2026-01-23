// Sync PRI Dashboard - Sincroniza dados de leads do webhook dash-pri para tabela cadencia_pri_voz
// Permite que o Dashboard consulte dados localmente do Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DASH_PRI_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/dash-pri';
const SAGA_ONE = Deno.env.get('SAGA_ONE') ?? '';

interface LeadWebhook {
  id?: string;
  nome?: string;
  telefone_lead?: string;
  telefone?: string;
  celular?: string;
  phone?: string;
  telefone_pri?: string;
  loja?: string;
  proposal_id?: string;
  num_tentativas?: number;
  ligacao_atendida?: boolean;
  status_agendado?: boolean;
  ligacao_erro?: boolean;
  enviado_whatsapp?: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

interface SyncResult {
  total_webhook: number;
  upserted: number;
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

    console.log(`🔄 Sincronizando dados do dash-pri para evento ${id_evento}, telefone_pri: ${telefone_pri}`);

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar dados do webhook dash-pri
    console.log(`📡 Buscando leads do webhook: ${DASH_PRI_URL}`);

    const webhookResponse = await fetch(DASH_PRI_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(SAGA_ONE ? { 'saga_one_supabase': SAGA_ONE } : {}),
      },
      body: JSON.stringify({
        telefone_pri: String(telefone_pri).replace(/\D/g, ''),
        id_evento: String(id_evento),
      }),
    });

    const webhookText = await webhookResponse.text();
    console.log(`📥 Resposta do dash-pri (status ${webhookResponse.status}):`, webhookText.substring(0, 500));

    if (!webhookResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Webhook retornou erro', status: webhookResponse.status, raw: webhookText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let leadsWebhook: LeadWebhook[] = [];
    try {
      const parsed = JSON.parse(webhookText);
      
      // Se resposta é agregada (tem total_registros), retornar info que não há lista
      if (parsed && !Array.isArray(parsed) && parsed.total_registros !== undefined) {
        console.log('📊 Webhook retornou dados agregados, não há lista de leads para sincronizar');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Dados agregados recebidos, sync não necessário',
            aggregated: parsed,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Se é array de dados agregados (como o retorno atual)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].total_registros !== undefined) {
        console.log('📊 Webhook retornou array com dados agregados');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Dados agregados recebidos, sync não necessário',
            aggregated: parsed[0],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      leadsWebhook = Array.isArray(parsed) ? parsed : (parsed?.contatos || parsed?.leads || parsed?.data || []);
    } catch (e) {
      console.error('❌ Erro ao parsear resposta:', e);
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do webhook', raw: webhookText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Leads encontrados no webhook: ${leadsWebhook.length}`);

    if (leadsWebhook.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum lead para sincronizar', result: { total_webhook: 0, upserted: 0, errors: [] } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: SyncResult = {
      total_webhook: leadsWebhook.length,
      upserted: 0,
      errors: [],
    };

    // 2. Preparar dados para upsert na tabela cadencia_pri_voz
    const cadenciaRecords = leadsWebhook.map((lead) => {
      const telefoneLeadRaw = lead.telefone_lead || lead.telefone || lead.celular || lead.phone || '';
      const telefoneLead = String(telefoneLeadRaw).replace(/\D/g, '');
      
      return {
        telefone_lead: telefoneLead,
        telefone_pri: String(telefone_pri).replace(/\D/g, ''),
        id_evento: parseInt(String(id_evento), 10),
        num_tentativas: lead.num_tentativas ?? 0,
        hora_primeira_tentativa: lead.criado_em || null,
        hora_ultima_tentativa: lead.atualizado_em || null,
        empresa_id: empresa_id,
        atualizado_em: new Date().toISOString(),
      };
    }).filter(r => r.telefone_lead); // Filtrar registros sem telefone

    console.log(`📝 Preparados ${cadenciaRecords.length} registros para cadencia_pri_voz`);

    // 3. Upsert em lotes
    const batchSize = 100;
    for (let i = 0; i < cadenciaRecords.length; i += batchSize) {
      const batch = cadenciaRecords.slice(i, i + batchSize);
      
      const { error: upsertError } = await supabase
        .from('cadencia_pri_voz')
        .upsert(batch, { 
          onConflict: 'telefone_lead,id_evento',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`⚠️ Erro no batch ${i / batchSize + 1}:`, upsertError);
        result.errors.push(`Batch ${i / batchSize + 1}: ${upsertError.message}`);
      } else {
        result.upserted += batch.length;
      }
    }

    console.log(`✅ Sync concluído: ${result.upserted} registros salvos em cadencia_pri_voz`);

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
