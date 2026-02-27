import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const SAGA_ONE = Deno.env.get('SAGA_ONE') || '';
    
    if (!SAGA_ONE) {
      console.error('SAGA_ONE not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = await req.json();
    
    // Support custom webhook URL override via _webhook_url
    const defaultUrl = 'https://automatemaiawh.sagadatadriven.com.br/webhook/8275b29e-b3b1-494d-a604-b285a8cc0d56';
    const targetUrl = payload._webhook_url || defaultUrl;
    
    // Remove internal field before forwarding
    const { _webhook_url, ...forwardPayload } = payload;
    
    console.log('Proxying webhook request to:', targetUrl);

    const response = await fetch(
      targetUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'saga_one_supabase': SAGA_ONE,
        },
        body: JSON.stringify(forwardPayload),
      }
    );

    const responseText = await response.text();
    console.log('Webhook response status:', response.status);
    console.log('Webhook response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { 
        status: response.status, 
        statusText: response.statusText,
        body: responseText 
      };
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        data: responseData,
      }),
      {
        status: response.ok ? 200 : response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in maia-webhook-proxy:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
