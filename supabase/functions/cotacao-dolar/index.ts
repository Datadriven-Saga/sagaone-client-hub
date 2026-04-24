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

    // Build today's date in YYYY-MM-DD for Frankfurter
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // Primary: Frankfurter API with today's date
    try {
      const response = await fetch(
        `https://api.frankfurter.app/${todayStr}?from=USD&to=BRL`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (response.ok) {
        const data = await response.json();
        if (data?.rates?.BRL) {
          cotacao = data.rates.BRL;
          dataCotacao = now.toISOString();
          fonte = "Frankfurter";
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("Frankfurter API failed, trying fallback:", message);
    }

    // Fallback: AwesomeAPI
    if (!cotacao) {
      try {
        const cacheBuster = Date.now();
        const response = await fetch(
          `https://economia.awesomeapi.com.br/json/last/USD-BRL?t=${cacheBuster}`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (response.ok) {
          const data = await response.json();
          const usdBrl = data?.USDBRL;
          if (usdBrl?.bid) {
            cotacao = parseFloat(usdBrl.bid);
            dataCotacao = now.toISOString();
            fonte = "AwesomeAPI";
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("AwesomeAPI also failed:", message);
      }
    }

    // Final fallback
    if (!cotacao) {
      cotacao = 5.75;
      dataCotacao = now.toISOString();
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
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: "Não foi possível obter a cotação do dólar", details: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
