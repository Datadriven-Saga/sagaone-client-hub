import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const WEBHOOK_URL = 'https://automatemaiawh.sagadatadriven.com.br/webhook/verifica-contatos';

interface WebhookContato {
  id?: string;
  nome?: string;
  telefone?: string;
  email?: string;
  status?: string;
  data_disparo_ia?: string;
  responsavel_email?: string;
  vendedor_nome?: string;
  origem?: string;
  observacoes?: string;
}

interface SyncResult {
  total_webhook: number;
  total_local: number;
  criados: number;
  deletados: number;
  atualizados: number;
  mantidos: number;
  erros: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone_pri, id_evento, empresa_id, prospeccao_id, dry_run = false } = await req.json();

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

    if (!prospeccao_id) {
      return new Response(
        JSON.stringify({ error: 'prospeccao_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔄 Sincronizando contatos para evento ${id_evento}, telefone_pri: ${telefone_pri}, empresa: ${empresa_id}`);

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar contatos do webhook externo
    console.log(`📡 Buscando contatos do webhook: ${WEBHOOK_URL}`);
    
    const telefoneFormatado = String(telefone_pri).replace(/\D/g, '');
    
    // Fazer POST com os parâmetros
    let webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefone: telefoneFormatado,
        id_evento: String(id_evento),
      }),
    });

    let webhookText = await webhookResponse.text();

    // Se POST falhar com 404, tentar GET
    if (webhookResponse.status === 404 && webhookText.toLowerCase().includes('not registered for post')) {
      console.log('⚠️ Webhook exige GET, tentando novamente...');
      const url = new URL(WEBHOOK_URL);
      url.searchParams.set('telefone', telefoneFormatado);
      url.searchParams.set('id_evento', String(id_evento));
      
      webhookResponse = await fetch(url.toString(), { method: 'GET' });
      webhookText = await webhookResponse.text();
    }

    console.log(`📥 Resposta do webhook (status ${webhookResponse.status}):`, webhookText.substring(0, 1000));

    let contatosWebhook: WebhookContato[] = [];
    try {
      const parsed = JSON.parse(webhookText);
      contatosWebhook = Array.isArray(parsed) ? parsed : (parsed?.contatos || parsed?.leads || parsed?.data || []);
    } catch (e) {
      console.error('❌ Erro ao parsear resposta do webhook:', e);
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do webhook', raw: webhookText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Contatos encontrados no webhook: ${contatosWebhook.length}`);

    // Criar mapa de contatos do webhook por telefone (normalizado)
    const webhookContatosMap = new Map<string, WebhookContato>();
    contatosWebhook.forEach(c => {
      const telefone = String(c.telefone || '').replace(/\D/g, '');
      if (telefone) {
        webhookContatosMap.set(telefone, c);
      }
    });

    console.log(`🔑 Contatos únicos no webhook (por telefone): ${webhookContatosMap.size}`);

    // 2. Buscar contatos locais vinculados a este evento
    const { data: eventosProspeccao, error: epError } = await supabase
      .from('eventos_prospeccao')
      .select('contato_id')
      .eq('prospeccao_id', prospeccao_id);

    if (epError) {
      console.error('❌ Erro ao buscar eventos_prospeccao:', epError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar vínculos locais', details: epError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contatoIds = (eventosProspeccao || []).map(ep => ep.contato_id).filter(Boolean);
    console.log(`📂 Contatos locais vinculados ao evento: ${contatoIds.length}`);

    // Buscar dados dos contatos locais
    let contatosLocais: { id: string; telefone: string | null; nome: string }[] = [];
    if (contatoIds.length > 0) {
      const { data: contatos, error: cError } = await supabase
        .from('contatos')
        .select('id, telefone, nome')
        .eq('empresa_id', empresa_id)
        .in('id', contatoIds);

      if (cError) {
        console.error('❌ Erro ao buscar contatos locais:', cError);
      } else {
        contatosLocais = contatos || [];
      }
    }

    // Mapear contatos locais por telefone normalizado
    const locaisMap = new Map<string, typeof contatosLocais[0]>();
    contatosLocais.forEach(c => {
      const telefone = String(c.telefone || '').replace(/\D/g, '');
      if (telefone) {
        locaisMap.set(telefone, c);
      }
    });

    // 3. Sincronizar
    const result: SyncResult = {
      total_webhook: webhookContatosMap.size,
      total_local: contatosLocais.length,
      criados: 0,
      deletados: 0,
      atualizados: 0,
      mantidos: 0,
      erros: [],
    };

    // 3a. Contatos no webhook que NÃO existem localmente → CRIAR
    for (const [telefone, webhookContato] of webhookContatosMap) {
      if (!locaisMap.has(telefone)) {
        console.log(`➕ Criar contato: ${telefone} - ${webhookContato.nome || 'Sem nome'}`);
        
        if (!dry_run) {
          // Criar contato
          const { data: novoContato, error: createError } = await supabase
            .from('contatos')
            .insert({
              nome: webhookContato.nome || `Contato ${telefone}`,
              telefone: webhookContato.telefone || telefone,
              email: webhookContato.email || null,
              status: webhookContato.status || 'Novo',
              origem: webhookContato.origem || 'Ligação IA',
              empresa_id: empresa_id,
              data_disparo_ia: webhookContato.data_disparo_ia || null,
              responsavel_email: webhookContato.responsavel_email || null,
              vendedor_nome: webhookContato.vendedor_nome || null,
              observacoes: webhookContato.observacoes || null,
            })
            .select('id')
            .single();

          if (createError) {
            console.error(`❌ Erro ao criar contato ${telefone}:`, createError);
            result.erros.push(`Criar ${telefone}: ${createError.message}`);
          } else if (novoContato) {
            // Vincular ao evento
            const { error: linkError } = await supabase
              .from('eventos_prospeccao')
              .insert({
                contato_id: novoContato.id,
                prospeccao_id: prospeccao_id,
                tipo_evento: 'ligacao',
              });

            if (linkError) {
              console.error(`❌ Erro ao vincular contato ${novoContato.id} ao evento:`, linkError);
              result.erros.push(`Vincular ${telefone}: ${linkError.message}`);
            } else {
              result.criados++;
            }
          }
        } else {
          result.criados++;
        }
      } else {
        result.mantidos++;
      }
    }

    // 3b. Contatos locais que NÃO existem no webhook → DELETAR vínculo (não o contato)
    for (const [telefone, localContato] of locaisMap) {
      if (!webhookContatosMap.has(telefone)) {
        console.log(`🗑️ Remover vínculo do contato: ${localContato.id} - ${localContato.nome}`);
        
        if (!dry_run) {
          // Deletar apenas o vínculo em eventos_prospeccao
          const { error: deleteError } = await supabase
            .from('eventos_prospeccao')
            .delete()
            .eq('contato_id', localContato.id)
            .eq('prospeccao_id', prospeccao_id);

          if (deleteError) {
            console.error(`❌ Erro ao remover vínculo do contato ${localContato.id}:`, deleteError);
            result.erros.push(`Remover vínculo ${localContato.id}: ${deleteError.message}`);
          } else {
            result.deletados++;
          }
        } else {
          result.deletados++;
        }
      }
    }

    console.log(`✅ Sincronização de contatos concluída:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        result,
        summary: {
          total_webhook: result.total_webhook,
          total_local: result.total_local,
          criados: result.criados,
          deletados: result.deletados,
          mantidos: result.mantidos,
          erros: result.erros.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na sincronização de contatos:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno na sincronização de contatos' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
