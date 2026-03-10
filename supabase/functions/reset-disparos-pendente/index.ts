// Reset Disparos Pendente - Resets individual lead dispatch status
// Input: { lead_id: number, prospeccao_id: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { lead_id, prospeccao_id } = await req.json();

    if (!lead_id || !prospeccao_id) {
      return new Response(
        JSON.stringify({ error: 'lead_id e prospeccao_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leadIdNum = parseInt(String(lead_id), 10);
    if (isNaN(leadIdNum)) {
      return new Response(
        JSON.stringify({ error: 'lead_id deve ser um número válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Resetando lead_id=${leadIdNum} para prospeccao_id=${prospeccao_id}`);

    // 1. Find contato by lead_id (serial)
    const { data: contato, error: contatoErr } = await supabase
      .from('contatos')
      .select('id, lead_id, nome, telefone')
      .eq('lead_id', leadIdNum)
      .maybeSingle();

    if (contatoErr) throw contatoErr;

    if (!contato) {
      return new Response(
        JSON.stringify({ success: false, error: `Lead ${leadIdNum} não encontrado` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Reset data_disparo_ia on contatos
    const { error: updateContatoErr } = await supabase
      .from('contatos')
      .update({ data_disparo_ia: null, updated_at: new Date().toISOString() })
      .eq('lead_id', leadIdNum);

    if (updateContatoErr) {
      console.error('Erro ao resetar contato:', updateContatoErr);
      throw updateContatoErr;
    }

    // 3. Reset data_disparo_ia on eventos_prospeccao
    const { error: updateEventoErr } = await supabase
      .from('eventos_prospeccao')
      .update({ data_disparo_ia: null })
      .eq('contato_id', contato.id)
      .eq('prospeccao_id', prospeccao_id);

    if (updateEventoErr) {
      console.error('Erro ao resetar eventos_prospeccao:', updateEventoErr);
      throw updateEventoErr;
    }

    console.log(`✅ Lead ${leadIdNum} (contato ${contato.id}) resetado com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadIdNum,
        contato_id: contato.id,
        reset: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no reset-disparos-pendente:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
