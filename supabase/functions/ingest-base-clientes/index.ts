// @ts-nocheck
// Edge Function: ingest-base-clientes
// Recebe POST diário do Datalake com leads de todas as lojas misturadas.
// Responde 202 Accepted imediatamente e processa em background via EdgeRuntime.waitUntil().

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DATALAKE_INGEST_TOKEN = Deno.env.get('DATALAKE_INGEST_TOKEN');

const CHUNK_SIZE = 500;
const MAX_RETRIES = 3;

interface LeadRaw {
  codigo_proposta?: string;
  codigo_loja?: string;
  cnpj_loja?: string;
  telefone?: string;
  email_cliente?: string;
  nome_cliente?: string;
  criado_em_origem?: string;
  canal?: string;
  origem?: string;
  veiculo_interesse?: string;
  tags?: string[];
  lead_maia?: string;
  lead_pri?: string;
  motivo_nao_venda?: string;
  [k: string]: unknown;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processarPool(jobId: string, leads: LeadRaw[], snapshotDate: string) {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = Date.now();
  await supabase
    .from('pool_ingestao_jobs')
    .update({ status: 'processing' })
    .eq('id', jobId);

  const erros: Array<{ stage: string; message: string; sample?: unknown }> = [];

  try {
    // 1) Resolver empresa_id via empresas.crm_id
    const codigosLoja = Array.from(
      new Set(
        leads
          .map((l) => (l.codigo_loja ? String(l.codigo_loja).trim() : ''))
          .filter(Boolean),
      ),
    );

    const empresaMap = new Map<string, string>(); // crm_id -> empresa_id
    if (codigosLoja.length > 0) {
      const { data: empresas, error: empErr } = await supabase
        .from('empresas')
        .select('id, crm_id')
        .in('crm_id', codigosLoja);
      if (empErr) throw new Error(`Erro ao buscar empresas: ${empErr.message}`);
      for (const e of empresas ?? []) {
        if (e.crm_id) empresaMap.set(String(e.crm_id), e.id as string);
      }
    }

    // 2) Dedup por (empresa_id, codigo_proposta) ou (codigo_loja, codigo_proposta) p/ órfãos
    //    mantendo o de criado_em_origem mais recente.
    const dedupMap = new Map<string, any>();
    let totalOrfaos = 0;

    for (const raw of leads) {
      const codigoProposta = raw.codigo_proposta ? String(raw.codigo_proposta).trim() : '';
      if (!codigoProposta) continue; // sem proposta, ignora
      const codigoLoja = raw.codigo_loja ? String(raw.codigo_loja).trim() : '';
      const empresaId = codigoLoja ? empresaMap.get(codigoLoja) ?? null : null;
      const isOrfao = !empresaId;

      const row = {
        empresa_id: empresaId,
        codigo_proposta: codigoProposta,
        telefone: raw.telefone ?? null,
        email_cliente: raw.email_cliente ?? null,
        nome_cliente: raw.nome_cliente ?? null,
        criado_em_origem: raw.criado_em_origem ?? null,
        canal: raw.canal ?? null,
        origem: raw.origem ?? null,
        codigo_loja: codigoLoja || null,
        cnpj_loja: raw.cnpj_loja ?? null,
        veiculo_interesse: raw.veiculo_interesse ?? null,
        tags: typeof raw.tags === 'string'
          ? raw.tags.split(';').map((s) => s.trim()).filter(Boolean)
          : (Array.isArray(raw.tags) ? raw.tags : []),
        lead_maia: raw.lead_maia ?? null,
        lead_pri: raw.lead_pri ?? null,
        status: isOrfao ? 'orfao' : 'ativo',
        motivo_nao_venda: raw.motivo_nao_venda ?? null,
        motivo_orfao: isOrfao
          ? codigoLoja
            ? `CRM não encontrado: ${codigoLoja}`
            : 'codigo_loja ausente'
          : null,
        ingestao_job_id: jobId,
        snapshot_date: snapshotDate,
      };

      const dedupKey = isOrfao
        ? `O::${codigoLoja}::${codigoProposta}`
        : `E::${empresaId}::${codigoProposta}`;

      const existing = dedupMap.get(dedupKey);
      if (!existing) {
        dedupMap.set(dedupKey, row);
      } else {
        // mantém o mais recente
        const a = existing.criado_em_origem ? Date.parse(existing.criado_em_origem) : 0;
        const b = row.criado_em_origem ? Date.parse(row.criado_em_origem) : 0;
        if (b >= a) dedupMap.set(dedupKey, row);
      }
    }

    const rows = Array.from(dedupMap.values());
    totalOrfaos = rows.filter((r) => r.status === 'orfao').length;

    // 3) UPSERT em chunks — codigo_proposta é globalmente único
    let totalProcessado = 0;

    async function upsertChunk(chunk: any[]) {
      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        const { error } = await supabase
          .from('pool_clientes_externos')
          .upsert(chunk, { onConflict: 'codigo_proposta', ignoreDuplicates: false });
        if (!error) return chunk.length;
        attempt++;
        if (attempt >= MAX_RETRIES) {
          erros.push({
            stage: 'upsert',
            message: error.message,
            sample: chunk[0]?.codigo_proposta,
          });
          return 0;
        }
        await sleep(500 * attempt);
      }
      return 0;
    }

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      totalProcessado += await upsertChunk(chunk);
    }

    await supabase
      .from('pool_ingestao_jobs')
      .update({
        status: erros.length > 0 && totalProcessado === 0 ? 'error' : 'done',
        total_processado: totalProcessado,
        total_orfaos: totalOrfaos,
        erros,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(
      `[ingest-base-clientes] job=${jobId} processed=${totalProcessado} orfaos=${totalOrfaos} elapsed=${
        Date.now() - startedAt
      }ms errors=${erros.length}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ingest-base-clientes] job=${jobId} FATAL:`, msg);
    await supabase
      .from('pool_ingestao_jobs')
      .update({
        status: 'error',
        erros: [...erros, { stage: 'fatal', message: msg }],
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validação do token custom
  if (!DATALAKE_INGEST_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'DATALAKE_INGEST_TOKEN not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== DATALAKE_INGEST_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const leads: LeadRaw[] = Array.isArray(body) ? body : Array.isArray(body?.leads) ? body.leads : [];
  if (leads.length === 0) {
    return new Response(JSON.stringify({ error: 'No leads provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const snapshotDate =
    typeof body?.snapshot_date === 'string'
      ? body.snapshot_date
      : new Date().toISOString().slice(0, 10);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: job, error: jobErr } = await supabase
    .from('pool_ingestao_jobs')
    .insert({
      status: 'pending',
      payload_recebido: { snapshot_date: snapshotDate, sample: leads.slice(0, 3) },
      total_recebido: leads.length,
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    return new Response(
      JSON.stringify({ error: `Failed to create job: ${jobErr?.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // @ts-ignore — EdgeRuntime existe no runtime do Supabase
  EdgeRuntime.waitUntil(processarPool(job.id, leads, snapshotDate));

  return new Response(
    JSON.stringify({ status: 'accepted', job_id: job.id, total_recebido: leads.length }),
    { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});