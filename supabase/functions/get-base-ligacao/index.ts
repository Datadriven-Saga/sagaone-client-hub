import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  id_evento: number;
  empresa_id: string;
  prospeccao_id?: string;
  page?: number;
  page_size?: number;
  filters?: {
    search?: string;
    status?: 'todos' | 'pendente' | 'em_fila' | 'disparado' | 'encerrado';
    status_ligacao?: 'todos' | 'agendado' | 'whatsapp' | 'atendido' | 'em_fila' | 'elegivel';
    tentativas?: 'todos' | '0' | '1' | '2' | '3+';
  };
}

interface MetricasResult {
  total: number;
  pendentes: number;        // num_tentativas = 0 e não encerrado
  disparados: number;       // num_tentativas >= 1
  emFila: number;          // ligacao_erro = true E não encerrado
  encerrados: number;       // agendado || whatsapp || atendido
  agendados: number;        // status_agendado = true
  whatsappEnviado: number;  // enviado_whatsapp = true
  atendidos: number;        // ligacao_atendida = true
  elegiveisDisparo: number; // pendentes + emFila
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`\n🔍 [${requestId}] GET-BASE-LIGACAO - Buscando dados do Supabase`);

  try {
    const body: RequestBody = await req.json();
    const { 
      id_evento, 
      empresa_id, 
      prospeccao_id,
      page = 1, 
      page_size = 20,
      filters = {}
    } = body;

    if (!id_evento) {
      return new Response(
        JSON.stringify({ success: false, error: 'id_evento é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!empresa_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'empresa_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 [${requestId}] Parâmetros: id_evento=${id_evento}, empresa=${empresa_id}, page=${page}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =====================================================
    // BUSCAR MÉTRICAS AGREGADAS
    // =====================================================
    const { data: allProspects, error: metricsError } = await supabase
      .from('prospect_pri_voz')
      .select('ligacao_atendida, status_agendado, enviado_whatsapp, ligacao_erro')
      .eq('id_evento', id_evento)
      .eq('empresa_id', empresa_id);

    if (metricsError) {
      console.error(`❌ [${requestId}] Erro ao buscar métricas:`, metricsError);
    }

    // Buscar tentativas da tabela cadencia_pri_voz
    const { data: cadenciaData } = await supabase
      .from('cadencia_pri_voz')
      .select('telefone_lead, num_tentativas')
      .eq('id_evento', id_evento)
      .eq('empresa_id', empresa_id);

    // Criar mapa de tentativas por telefone
    const tentativasMap = new Map<string, number>();
    (cadenciaData || []).forEach(c => {
      tentativasMap.set(c.telefone_lead, c.num_tentativas || 0);
    });

    // Calcular métricas
    const metricas: MetricasResult = {
      total: allProspects?.length || 0,
      pendentes: 0,
      disparados: 0,
      emFila: 0,
      encerrados: 0,
      agendados: 0,
      whatsappEnviado: 0,
      atendidos: 0,
      elegiveisDisparo: 0,
    };

    (allProspects || []).forEach(p => {
      const isEncerrado = p.status_agendado || p.enviado_whatsapp || p.ligacao_atendida;
      const isEmFila = p.ligacao_erro && !isEncerrado;
      const numTentativas = tentativasMap.get(p.telefone_lead) || 0;
      const isPendente = numTentativas === 0 && !isEmFila && !isEncerrado;
      const isDisparado = numTentativas > 0 && !isEmFila && !isEncerrado;

      if (isEncerrado) metricas.encerrados++;
      if (isEmFila) metricas.emFila++;
      if (isPendente) metricas.pendentes++;
      if (isDisparado) metricas.disparados++;
      if (p.status_agendado) metricas.agendados++;
      if (p.enviado_whatsapp) metricas.whatsappEnviado++;
      if (p.ligacao_atendida) metricas.atendidos++;
    });

    metricas.elegiveisDisparo = metricas.pendentes + metricas.emFila;

    console.log(`📊 [${requestId}] Métricas: total=${metricas.total}, pendentes=${metricas.pendentes}, encerrados=${metricas.encerrados}`);

    // =====================================================
    // BUSCAR CONTATOS PAGINADOS COM FILTROS
    // =====================================================
    const offset = (page - 1) * page_size;

    let query = supabase
      .from('prospect_pri_voz')
      .select('*', { count: 'exact' })
      .eq('id_evento', id_evento)
      .eq('empresa_id', empresa_id);

    // Aplicar filtros
    if (filters.search) {
      query = query.or(`nome.ilike.%${filters.search}%,telefone_lead.ilike.%${filters.search}%`);
    }

    // Filtro de status precisa ser calculado client-side após buscar os dados
    // pois depende de joins com cadencia_pri_voz

    query = query
      .order('criado_em', { ascending: false })
      .range(offset, offset + page_size - 1);

    const { data: prospects, error: prospectError, count } = await query;

    if (prospectError) {
      console.error(`❌ [${requestId}] Erro ao buscar prospects:`, prospectError);
      return new Response(
        JSON.stringify({ success: false, error: prospectError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enriquecer com dados de tentativas
    const enrichedProspects = (prospects || []).map(p => {
      const numTentativas = tentativasMap.get(p.telefone_lead) || 0;
      const isEncerrado = p.status_agendado || p.enviado_whatsapp || p.ligacao_atendida;
      const isEmFila = p.ligacao_erro && !isEncerrado;
      
      return {
        ...p,
        num_tentativas: numTentativas,
        status_calculado: isEncerrado 
          ? 'encerrado' 
          : isEmFila 
            ? 'em_fila' 
            : numTentativas > 0 
              ? 'disparado' 
              : 'pendente',
      };
    });

    // Aplicar filtros de status client-side
    let filteredProspects = enrichedProspects;

    if (filters.status && filters.status !== 'todos') {
      filteredProspects = filteredProspects.filter(p => p.status_calculado === filters.status);
    }

    if (filters.status_ligacao && filters.status_ligacao !== 'todos') {
      filteredProspects = filteredProspects.filter(p => {
        switch (filters.status_ligacao) {
          case 'agendado': return p.status_agendado;
          case 'whatsapp': return p.enviado_whatsapp;
          case 'atendido': return p.ligacao_atendida;
          case 'em_fila': return p.status_calculado === 'em_fila';
          case 'elegivel': return p.status_calculado === 'pendente' || p.status_calculado === 'em_fila';
          default: return true;
        }
      });
    }

    if (filters.tentativas && filters.tentativas !== 'todos') {
      filteredProspects = filteredProspects.filter(p => {
        switch (filters.tentativas) {
          case '0': return p.num_tentativas === 0;
          case '1': return p.num_tentativas === 1;
          case '2': return p.num_tentativas === 2;
          case '3+': return p.num_tentativas >= 3;
          default: return true;
        }
      });
    }

    console.log(`✅ [${requestId}] Retornando ${filteredProspects.length} contatos (página ${page})`);

    return new Response(
      JSON.stringify({
        success: true,
        metricas,
        contatos: filteredProspects,
        pagination: {
          page,
          page_size,
          total: count || metricas.total,
          total_pages: Math.ceil((count || metricas.total) / page_size),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`❌ [${requestId}] Erro:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
