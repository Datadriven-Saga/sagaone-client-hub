import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Janela de operação (Brasília). Reforço server-side: ProgramarDisparoModal
// já valida no client, mas qualquer batch inserido fora desse intervalo
// (manual, bug, drift) é silenciosamente reagendado para o próximo slot válido.
const WINDOW_START_H = 7;
const WINDOW_END_H = 20; // último slot permitido 20:00 (inclusivo)
const SP_TZ = 'America/Sao_Paulo';

/** Retorna { hour, minute } locais em São Paulo a partir de um Date UTC. */
function spLocal(d: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SP_TZ, hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(d);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return { hour: hour === 24 ? 0 : hour, minute };
}

function isInsideWindow(d: Date): boolean {
  const { hour } = spLocal(d);
  // 07:00 .. 22:00 inclusivo na hora final
  return hour >= WINDOW_START_H && hour <= WINDOW_END_H;
}

/** Próximo 07:00 (Brasília) >= d. Se já passou das 22h, vai para 07:00 do dia seguinte. */
function nextWindowStart(d: Date): Date {
  // Iteramos no máximo ~48h em passos de 30min — suficiente e barato.
  const step = new Date(d.getTime());
  for (let i = 0; i < 200; i++) {
    const { hour, minute } = spLocal(step);
    if (hour === WINDOW_START_H && minute === 0) return step;
    // Avança para o próximo múltiplo de 30 min
    const addMin = minute < 30 ? 30 - minute : 60 - minute;
    step.setTime(step.getTime() + addMin * 60_000);
    // Quando chega na janela, ajusta para o próprio 07:00 mais próximo desse dia.
    const after = spLocal(step);
    if (after.hour < WINDOW_START_H) {
      // ainda antes das 7 — pula direto pro 07:00 do mesmo dia local
      step.setTime(step.getTime() + (WINDOW_START_H - after.hour) * 3600_000 - after.minute * 60_000);
      return step;
    }
    if (after.hour > WINDOW_END_H) {
      // depois das 22 — pula para a próxima manhã (loop continua)
      continue;
    }
  }
  return step;
}

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

    // Proteção de janela: se o tick caiu fora de 07:00–22:00 (Brasília),
    // devolve TODOS os batches reivindicados para 'scheduled' com novo
    // scheduled_at no próximo 07:00 e não dispara nada.
    const now = new Date();
    if (!isInsideWindow(now)) {
      const next = nextWindowStart(now).toISOString();
      const ids = batches.map(b => b.id);
      if (ids.length > 0) {
        await supabase
          .from('campaign_batches')
          .update({ status: 'scheduled', scheduled_at: next, locked_at: null, locked_by: null })
          .in('id', ids);
      }
      console.log(`🌙 [DISPATCHER] Fora da janela ${WINDOW_START_H}h–${WINDOW_END_H}h — ${ids.length} batches reagendados para ${next}`);
      return new Response(
        JSON.stringify({ success: true, skipped: ids.length, rescheduled_to: next, reason: 'outside_window' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
          const body = await r.text().catch(() => '');
          if (!r.ok) {
            await handleDispatchFailure(supabase, b, `HTTP ${r.status}: ${body.substring(0, 200)}`);
          }
        }).catch(async (e) => {
          console.warn(`⚠️ Invocação falhou batch=${b.id}:`, e?.message);
          await handleDispatchFailure(supabase, b, e?.message || 'fetch error');
        });
        dispatched.push(b.id);
      } catch (e: any) {
        console.warn(`⚠️ Erro ao invocar batch=${b.id}:`, e?.message);
        await handleDispatchFailure(supabase, b, e?.message || 'invoke error');
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

async function handleDispatchFailure(
  supabase: any,
  batch: { id: string; job_id: string },
  reason: string,
) {
  try {
    await supabase
      .from('campaign_batches')
      .update({ status: 'failed', error_log: `Dispatcher: ${reason}`.substring(0, 500) })
      .eq('id', batch.id);

    const { data: job } = await supabase
      .from('campaign_jobs')
      .select('id, user_id, empresa_id, prospeccao_id')
      .eq('id', batch.job_id)
      .single();
    if (!job?.user_id) return;

    const link = `/prospeccao/${job.prospeccao_id || ''}?job=${job.id}`;
    const { data: existing } = await supabase
      .from('notificacoes')
      .select('id')
      .eq('user_id', job.user_id)
      .eq('tipo', 'disparo_falhou')
      .eq('link', link)
      .limit(1);
    if (existing && existing.length > 0) return;

    await supabase.from('notificacoes').insert({
      user_id: job.user_id,
      empresa_id: job.empresa_id,
      tipo: 'disparo_falhou',
      titulo: 'Falha ao iniciar lote programado',
      mensagem: `Não foi possível iniciar o lote: ${reason}`.substring(0, 240),
      link,
      lida: false,
    });
  } catch (e: any) {
    console.warn('⚠️ [DISPATCHER] Erro ao notificar falha:', e?.message);
  }
}