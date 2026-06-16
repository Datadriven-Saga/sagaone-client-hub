import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cron tick → reivindica batches scheduled prontos (scheduled_at <= now())
// e dispara process-campaign-job para cada um, em fire-and-forget.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Idempotente e seguro: apenas reivindica batches já agendados (scheduled_at <= now()).
  // Não requer auth pública adicional — a invocação ao process-campaign-job usa SERVICE_ROLE interna.

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const limit = 10;
    const workerId = `cron-${new Date().toISOString()}`;

    const { data: claimed, error } = await supabase.rpc('claim_due_campaign_batches', {
      p_limit: limit,
      p_worker_id: workerId,
    });

    if (error) {
      console.error('❌ Erro ao reivindicar batches:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const batches = (claimed || []) as Array<{ id: string; job_id: string; lot_index: number | null }>;
    console.log(`🕒 [DISPATCHER] Reivindicados ${batches.length} batches`);

    // Dispara em fire-and-forget. process-campaign-job responde HTTP 202.
    const invokeUrl = `${supabaseUrl}/functions/v1/process-campaign-job`;
    const dispatched: string[] = [];
    for (const b of batches) {
      try {
        // Não usamos invoke para evitar await — usamos fetch sem aguardar a resposta longa.
        fetch(invokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ job_id: b.job_id, batch_id: b.id }),
        }).then(async (r) => {
          await r.text().catch(() => '');
        }).catch((e) => {
          console.warn(`⚠️ Invocação falhou batch=${b.id}:`, e?.message);
        });
        dispatched.push(b.id);
      } catch (e: any) {
        console.warn(`⚠️ Erro ao invocar batch=${b.id}:`, e?.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, claimed: batches.length, dispatched: dispatched.length, batch_ids: dispatched }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('❌ Erro crítico no dispatcher:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});