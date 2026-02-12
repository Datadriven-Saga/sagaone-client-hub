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
    // Try AwesomeAPI first
    let cotacao: number | null = null;
    let dataCotacao: string | null = null;

    try {
      const response = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const usdBrl = data?.USDBRL;
        if (usdBrl?.bid) {
          cotacao = parseFloat(usdBrl.bid);
          dataCotacao = usdBrl.create_date;
        }
      }
    } catch (e) {
      console.warn("AwesomeAPI failed, trying fallback:", e.message);
    }

    // Fallback: Banco Central do Brasil API
    if (!cotacao) {
      try {
        const today = new Date();
        const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-${today.getFullYear()}`;
        const bcbUrl = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dateStr}'&$format=json&$top=1&$orderby=dataHoraCotacao%20desc`;
        
        const bcbResponse = await fetch(bcbUrl, {
          signal: AbortSignal.timeout(5000),
        });
        
        if (bcbResponse.ok) {
          const bcbData = await bcbResponse.json();
          if (bcbData?.value?.length > 0) {
            cotacao = bcbData.value[0].cotacaoCompra;
            dataCotacao = bcbData.value[0].dataHoraCotacao;
          }
        }
      } catch (e) {
        console.warn("BCB API also failed:", e.message);
      }
    }

    // Final fallback: use a recent known rate
    if (!cotacao) {
      cotacao = 5.75;
      dataCotacao = new Date().toISOString();
      console.warn("Using fallback rate: 5.75");
    }

    return new Response(
      JSON.stringify({
        cotacao,
        data_cotacao: dataCotacao,
        moeda: "USD/BRL",
        fonte: cotacao === 5.75 ? "Fallback" : "API",
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
