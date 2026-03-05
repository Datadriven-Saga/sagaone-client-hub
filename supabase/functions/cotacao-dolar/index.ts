import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let cotacao: number | null = null;
    let dataCotacao: string | null = null;
    let fonte = "Fallback";

    // Primary: Frankfurter API (latest real-time rate)
    try {
      const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=BRL", {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.rates?.BRL) {
          cotacao = data.rates.BRL;
          dataCotacao = data.date + "T" + new Date().toISOString().split("T")[1];
          fonte = "Frankfurter";
        }
      }
    } catch (e) {
      console.warn("Frankfurter API failed, trying fallback:", e.message);
    }

    // Fallback 1: AwesomeAPI
    if (!cotacao) {
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
            fonte = "AwesomeAPI";
          }
        }
      } catch (e) {
        console.warn("AwesomeAPI also failed:", e.message);
      }
    }

    // Final fallback
    if (!cotacao) {
      cotacao = 5.75;
      dataCotacao = new Date().toISOString();
      fonte = "Fallback";
      console.warn("Using fallback rate: 5.75");
    }

    return new Response(
      JSON.stringify({
        cotacao,
        data_cotacao: dataCotacao,
        moeda: "USD/BRL",
        fonte,
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
