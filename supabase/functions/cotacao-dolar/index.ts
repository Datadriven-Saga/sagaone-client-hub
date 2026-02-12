import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch USD/BRL rate from AwesomeAPI (free, no key needed)
    const response = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const usdBrl = data?.USDBRL;

    if (!usdBrl) {
      throw new Error("Could not parse exchange rate data");
    }

    return new Response(
      JSON.stringify({
        cotacao: parseFloat(usdBrl.bid),
        data_cotacao: usdBrl.create_date,
        moeda: "USD/BRL",
        fonte: "AwesomeAPI",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Erro ao buscar cotação:", error);
    return new Response(
      JSON.stringify({ error: "Não foi possível obter a cotação do dólar", details: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
