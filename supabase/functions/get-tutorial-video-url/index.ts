import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "videos-tutoriais";
const FILE_PATH = "SagaOne - Login Terceiros.mp4";
const SIGNED_URL_TTL = 60 * 60;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Usuário não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "Usuário não autenticado" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await serviceClient.storage
      .from(BUCKET)
      .createSignedUrl(FILE_PATH, SIGNED_URL_TTL);

    if (error || !data?.signedUrl) {
      console.error("[get-tutorial-video-url] signed url error:", error);
      return json({ error: error?.message || "Falha ao gerar URL do vídeo" }, 500);
    }

    return json({ url: data.signedUrl });
  } catch (error) {
    console.error("[get-tutorial-video-url] unexpected error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Erro inesperado ao gerar URL do vídeo" },
      500,
    );
  }
});