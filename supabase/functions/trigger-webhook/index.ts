import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { gatilho, dados } = await req.json();

    if (!gatilho || !dados) {
      return new Response(
        JSON.stringify({ error: 'gatilho e dados são obrigatórios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar gatilhos ativos para o tipo de evento
    const { data: gatilhos, error } = await supabaseClient
      .from('gatilhos')
      .select('*')
      .eq('tipo', gatilho)
      .eq('status', 'Ativo');

    if (error) {
      console.error('Erro ao buscar gatilhos:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar gatilhos' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const webhooksDispareados = [];

    // Disparar webhooks para cada gatilho ativo
    for (const gatilhoConfig of gatilhos || []) {
      try {
        const acoes = gatilhoConfig.acoes || {};
        const webhookUrl = acoes.webhook_url;

        if (webhookUrl) {
          console.log(`Disparando webhook: ${webhookUrl}`);
          console.log(`Descrição do gatilho: ${gatilhoConfig.descricao}`);
          
          // Preparar dados do webhook baseado na descrição e tipo do gatilho
          let webhookBody = {
            gatilho: gatilho,
            gatilho_id: gatilhoConfig.id,
            gatilho_nome: gatilhoConfig.nome,
            timestamp: new Date().toISOString()
          };

          // Para gatilho de novo contato na prospecção
          if (gatilho === 'novo_contato_prospeccao' && dados) {
            webhookBody = {
              nome: dados.nome || '',
              telefone: dados.telefone || '',
              email: dados.email || '',
              id: dados.contato_id || dados.id || '',
              status: dados.status || 'Novo',
              prospeccao_id: dados.prospeccao_id || ''
            };
          }
          // Para outros gatilhos, incluir dados completos
          else {
            webhookBody = {
              ...webhookBody,
              dados: dados
            };
          }
          
          const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookBody)
          });

          webhooksDispareados.push({
            gatilho_id: gatilhoConfig.id,
            webhook_url: webhookUrl,
            status: webhookResponse.ok ? 'sucesso' : 'erro',
            status_code: webhookResponse.status
          });

          // Atualizar última execução do gatilho
          await supabaseClient
            .from('gatilhos')
            .update({
              ultima_execucao: new Date().toISOString()
            })
            .eq('id', gatilhoConfig.id);

        } else {
          console.log(`Gatilho ${gatilhoConfig.id} não possui webhook configurado`);
        }
      } catch (webhookError) {
        console.error(`Erro ao disparar webhook para gatilho ${gatilhoConfig.id}:`, webhookError);
        webhooksDispareados.push({
          gatilho_id: gatilhoConfig.id,
          webhook_url: gatilhoConfig.acoes?.webhook_url || 'N/A',
          status: 'erro',
          erro: webhookError.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        gatilho: gatilho,
        webhooks_disparados: webhooksDispareados.length,
        detalhes: webhooksDispareados
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro na função trigger-webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});