import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  id_evento: number;
  empresa_id: string;
  prospeccao_id?: string;
  loja?: string; // Filtro por loja específica
  telefone_pri?: string; // Telefone do agente PRI
  dealerid?: string; // CRM ID da loja (apenas para referência, busca do evento)
  page?: number;
  page_size?: number;
  filters?: {
    search?: string;
    loja?: string; // Filtro por loja
    status?: 'todos' | 'pendente' | 'em_fila' | 'disparado' | 'encerrado';
    status_ligacao?: 'todos' | 'agendado' | 'whatsapp' | 'atendido' | 'em_fila' | 'elegivel';
    tentativas?: 'todos' | '0' | '1' | '2' | '3+';
  };
}

interface MetricasResult {
  total: number;
  pendentes: number;
  disparados: number;
  emFila: number;
  encerrados: number;
  agendados: number;
  whatsappEnviado: number;
  atendidos: number;
  elegiveisDisparo: number;
}

interface LojaInfo {
  loja: string;
  total: number;
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
      loja: lojaParam,
      telefone_pri,
      dealerid: dealerIdParam,
      page = 1, 
      page_size = 20,
      filters = {}
    } = body;
    
    // Loja pode vir como parâmetro direto ou dentro de filters
    const lojaFilter = lojaParam || filters.loja;

    console.log(`📥 [${requestId}] Parâmetros recebidos: id_evento=${id_evento}, empresa=${empresa_id}, dealerid_param=${dealerIdParam || 'não informado'}, telefone_pri=${telefone_pri || 'não informado'}`);

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =====================================================
    // BUSCAR DADOS DO EVENTO da tabela eventos_pri_voz
    // Usado para referência e validação, não para filtrar prospects
    // =====================================================
    console.log(`🔎 [${requestId}] Buscando dados do evento ${id_evento} na tabela eventos_pri_voz...`);
    
    const { data: eventoData, error: eventoError } = await supabase
      .from('eventos_pri_voz')
      .select('id_evento, dealerid, telefone_pri, nome, empresa_id')
      .eq('id_evento', id_evento)
      .maybeSingle();
    
    if (eventoError) {
      console.error(`⚠️ [${requestId}] Erro ao buscar evento:`, eventoError);
    } else if (eventoData) {
      console.log(`✅ [${requestId}] Evento encontrado: "${eventoData.nome}", dealerid=${eventoData.dealerid}, telefone_pri=${eventoData.telefone_pri}, empresa_id=${eventoData.empresa_id}`);
    } else {
      console.log(`⚠️ [${requestId}] Evento ${id_evento} não encontrado em eventos_pri_voz`);
    }

    // =====================================================
    // BUSCAR TODOS OS PROSPECTS - Usando apenas id_evento como PK
    // A tabela prospect_pri_voz já está segmentada por id_evento
    // =====================================================
    console.log(`📥 [${requestId}] Buscando TODOS os prospects para id_evento=${id_evento}`);
    
    // Buscar em lotes para contornar limite do Supabase (default 1000 rows)
    let allProspects: any[] = [];
    let hasMore = true;
    let offset = 0;
    const batchSize = 1000; // Supabase default limit
    
    while (hasMore) {
      console.log(`📥 [${requestId}] Buscando prospects batch: offset=${offset}, limit=${batchSize}`);
      
      const { data: batch, error: batchError, count } = await supabase
        .from('prospect_pri_voz')
        .select('*', { count: 'exact' })
        .eq('id_evento', id_evento)
        .range(offset, offset + batchSize - 1)
        .order('criado_em', { ascending: false });
      
      if (batchError) {
        console.error(`❌ [${requestId}] Erro ao buscar prospects (batch ${offset}):`, batchError);
        return new Response(
          JSON.stringify({ success: false, error: batchError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (batch && batch.length > 0) {
        allProspects = allProspects.concat(batch);
        offset += batch.length;
        // Continue if we got a full batch (there might be more)
        hasMore = batch.length === batchSize;
        console.log(`📊 [${requestId}] Batch: +${batch.length} prospects (total acumulado: ${allProspects.length})`);
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 [${requestId}] Total prospects carregados: ${allProspects.length}`);

    // =====================================================
    // BUSCAR CADENCIAS (tentativas) - JOIN por telefone_lead + id_evento
    // Também em lotes para eventos grandes
    // =====================================================
    let allCadencias: any[] = [];
    hasMore = true;
    let cadenciaOffset = 0;
    
    while (hasMore) {
      console.log(`📥 [${requestId}] Buscando cadencias batch: offset=${cadenciaOffset}`);
      
      const { data: batch, error: batchError } = await supabase
        .from('cadencia_pri_voz')
        .select('telefone_lead, telefone_pri, id_evento, num_tentativas, hora_primeira_tentativa, hora_ultima_tentativa')
        .eq('id_evento', id_evento)
        .range(cadenciaOffset, cadenciaOffset + batchSize - 1);
      
      if (batchError) {
        console.error(`❌ [${requestId}] Erro ao buscar cadencias (batch ${cadenciaOffset}):`, batchError);
        break;
      }
      
      if (batch && batch.length > 0) {
        allCadencias = allCadencias.concat(batch);
        cadenciaOffset += batch.length;
        hasMore = batch.length === batchSize;
        console.log(`📊 [${requestId}] Cadencias batch: +${batch.length} (total: ${allCadencias.length})`);
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 [${requestId}] Total cadencias carregadas: ${allCadencias.length}`);

    // Criar mapa de cadencias por telefone_lead (PK do JOIN)
    const cadenciaMap = new Map<string, {
      num_tentativas: number;
      hora_primeira_tentativa: string | null;
      hora_ultima_tentativa: string | null;
    }>();
    
    allCadencias.forEach(c => {
      cadenciaMap.set(c.telefone_lead, {
        num_tentativas: c.num_tentativas || 0,
        hora_primeira_tentativa: c.hora_primeira_tentativa,
        hora_ultima_tentativa: c.hora_ultima_tentativa,
      });
    });

    console.log(`📊 [${requestId}] Prospects: ${allProspects.length}, Cadencias mapeadas: ${cadenciaMap.size}`);

    // =====================================================
    // ENRIQUECER PROSPECTS COM DADOS DE CADENCIA (JOIN)
    // =====================================================
    const enrichedProspects = (allProspects || []).map(p => {
      const cadencia = cadenciaMap.get(p.telefone_lead);
      const numTentativas = cadencia?.num_tentativas || 0;
      const isEncerrado = p.status_agendado || p.enviado_whatsapp || p.ligacao_atendida;
      const isEmFila = p.ligacao_erro && !isEncerrado;
      
      return {
        ...p,
        // Dados da cadencia (JOIN)
        num_tentativas: numTentativas,
        hora_primeira_tentativa: cadencia?.hora_primeira_tentativa || null,
        hora_ultima_tentativa: cadencia?.hora_ultima_tentativa || null,
        // Status calculado
        status_calculado: isEncerrado 
          ? 'encerrado' 
          : isEmFila 
            ? 'em_fila' 
            : numTentativas > 0 
              ? 'disparado' 
              : 'pendente',
      };
    });

    // =====================================================
    // FILTRAR POR LOJA SE ESPECIFICADA (antes de calcular métricas)
    // =====================================================
    let prospectsForMetrics = enrichedProspects;
    if (lojaFilter && lojaFilter !== '__all__') {
      prospectsForMetrics = enrichedProspects.filter(p => p.loja === lojaFilter);
      console.log(`🏪 [${requestId}] Filtrado por loja "${lojaFilter}": ${prospectsForMetrics.length} de ${enrichedProspects.length}`);
    }

    // =====================================================
    // LISTAR LOJAS DISPONÍVEIS (para o dropdown)
    // =====================================================
    const lojasMap = new Map<string, number>();
    enrichedProspects.forEach(p => {
      if (p.loja) {
        lojasMap.set(p.loja, (lojasMap.get(p.loja) || 0) + 1);
      }
    });
    const lojas: LojaInfo[] = Array.from(lojasMap.entries())
      .map(([loja, total]) => ({ loja, total }))
      .sort((a, b) => b.total - a.total);

    // =====================================================
    // CALCULAR MÉTRICAS (considerando filtro de loja)
    // =====================================================
    const metricas: MetricasResult = {
      total: prospectsForMetrics.length,
      pendentes: 0,
      disparados: 0,
      emFila: 0,
      encerrados: 0,
      agendados: 0,
      whatsappEnviado: 0,
      atendidos: 0,
      elegiveisDisparo: 0,
    };

    prospectsForMetrics.forEach(p => {
      if (p.status_calculado === 'encerrado') metricas.encerrados++;
      if (p.status_calculado === 'em_fila') metricas.emFila++;
      if (p.status_calculado === 'pendente') metricas.pendentes++;
      if (p.status_calculado === 'disparado') metricas.disparados++;
      if (p.status_agendado) metricas.agendados++;
      if (p.enviado_whatsapp) metricas.whatsappEnviado++;
      if (p.ligacao_atendida) metricas.atendidos++;
    });

    metricas.elegiveisDisparo = metricas.pendentes + metricas.emFila;

    console.log(`📊 [${requestId}] Métricas${lojaFilter ? ` (loja: ${lojaFilter})` : ''}: total=${metricas.total}, pendentes=${metricas.pendentes}, agendados=${metricas.agendados}, atendidos=${metricas.atendidos}`);

    // =====================================================
    // APLICAR FILTROS ADICIONAIS (client-side, após JOIN)
    // =====================================================
    let filteredProspects = [...prospectsForMetrics];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredProspects = filteredProspects.filter(p => 
        (p.nome?.toLowerCase().includes(searchLower)) ||
        (p.telefone_lead?.includes(filters.search))
      );
    }

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

    // =====================================================
    // PAGINAÇÃO
    // =====================================================
    const totalFiltered = filteredProspects.length;
    const paginationOffset = (page - 1) * page_size;
    const paginatedProspects = filteredProspects
      .sort((a, b) => new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime())
      .slice(paginationOffset, paginationOffset + page_size);

    console.log(`✅ [${requestId}] Retornando ${paginatedProspects.length} contatos (página ${page} de ${Math.ceil(totalFiltered / page_size)})`);

    return new Response(
      JSON.stringify({
        success: true,
        evento: eventoData ? {
          id_evento: eventoData.id_evento,
          nome: eventoData.nome,
          dealerid: eventoData.dealerid,
          telefone_pri: eventoData.telefone_pri,
        } : null,
        metricas,
        lojas, // Lista de lojas disponíveis com contagem
        loja_selecionada: lojaFilter || null,
        contatos: paginatedProspects,
        pagination: {
          page,
          page_size,
          total: totalFiltered,
          total_pages: Math.ceil(totalFiltered / page_size),
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
