import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export interface MetricasLigacaoExternas {
  total: number;
  pendentes: number;        // 0 tentativas
  disparados1: number;      // 1 tentativa
  disparados2: number;      // 2+ tentativas
  emFila: number;           // ligacao_erro=true E tentativas < 2 E não encerrado
  encerrados: number;       // tentativas >= 2 OU (agendado/atendido/whatsapp)
  elegiveisDisparo: number; // pendentes + emFila (o que realmente pode disparar)
}

interface CachedMetrics {
  [eventIdKey: string]: {
    metrics: MetricasLigacaoExternas;
    timestamp: number;
  };
}

// Cache global para evitar múltiplas chamadas
const metricsCache: CachedMetrics = {};
const CACHE_DURATION_MS = 30000; // 30 segundos

export function useMetricasLigacao() {
  const { activeCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(false);
  const [telefonePriCache, setTelefonePriCache] = useState<string | null>(null);

  // Buscar telefone do agente Pri(Ligação) para esta empresa
  const fetchTelefonePriLigacao = useCallback(async (): Promise<string | null> => {
    if (!activeCompany?.id) return null;
    
    if (telefonePriCache) return telefonePriCache;
    
    try {
      const { data: agenteEmpresa, error } = await supabase
        .from('agente_empresas')
        .select('agente_id, agentes_ia(id, telefone, nome)')
        .eq('empresa_id', activeCompany.id);

      if (error) {
        console.error('Erro ao buscar agentes:', error);
        return null;
      }

      if (agenteEmpresa) {
        const agenteLigacao = agenteEmpresa.find((ae: any) => {
          const nome = ae.agentes_ia?.nome?.toLowerCase() || '';
          return nome.includes('pri') && nome.includes('liga');
        });
        
        if (agenteLigacao) {
          const tel = (agenteLigacao as any).agentes_ia?.telefone;
          setTelefonePriCache(tel);
          return tel;
        }
      }
    } catch (error) {
      console.error('Erro ao buscar telefone Pri(Ligação):', error);
    }
    return null;
  }, [activeCompany?.id, telefonePriCache]);

  // Buscar métricas de IA Ligação do webhook externo (dash-pri)
  const fetchMetricasLigacao = useCallback(async (
    eventoId: string,
    eventIdPri?: string | null,
    forceRefresh = false
  ): Promise<MetricasLigacaoExternas | null> => {
    if (!activeCompany?.id) return null;

    const cacheKey = `${activeCompany.id}_${eventoId}`;
    
    // Verificar cache
    if (!forceRefresh && metricsCache[cacheKey]) {
      const cached = metricsCache[cacheKey];
      if (Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        return cached.metrics;
      }
    }

    try {
      setIsLoading(true);
      
      const telefonePri = await fetchTelefonePriLigacao();
      if (!telefonePri) {
        console.warn('⚠️ Telefone Pri(Ligação) não encontrado para buscar métricas externas');
        return null;
      }

      const idEvento = eventIdPri || eventoId;
      
      console.log('📊 Buscando métricas externas para evento:', idEvento);

      const { data, error } = await supabase.functions.invoke('external-webhook-proxy', {
        body: {
          endpoint: 'metricas',
          id_evento: idEvento,
          telefone_pri: telefonePri
        }
      });

      if (error) {
        console.error('❌ Erro ao buscar métricas externas:', error);
        return null;
      }

      // O webhook pode retornar dados agregados ou lista de contatos
      if (Array.isArray(data) && data.length > 0) {
        const firstItem = data[0];
        
        // Formato agregado: [{total_registros, tentativas_0, tentativas_1, ...}]
        if ('total_registros' in firstItem) {
          const agg = firstItem;
          const total = Number(agg.total_registros) || 0;
          const tentativas0 = Number(agg.tentativas_0) || 0;
          const tentativas1 = Number(agg.tentativas_1) || 0;
          const tentativas2 = Number(agg.tentativas_2) || 0;
          const tentativasMaior2 = Number(agg.tentativas_maior_2) || 0;
          const ligacaoAtendida = Number(agg.ligacao_atendida) || 0;
          const statusAgendado = Number(agg.status_agendado) || 0;
          const ligacaoErro = Number(agg.ligacao_erro) || 0;
          const enviadoWhatsapp = Number(agg.enviado_whatsapp) || 0;

          // Encerrados = sucesso (agendado/atendido/whatsapp) + tentativas >= 2
          const encerradosSucesso = Math.max(ligacaoAtendida, statusAgendado, enviadoWhatsapp);
          const encerradosTentativas = tentativas2 + tentativasMaior2;
          
          const metricsResult: MetricasLigacaoExternas = {
            total,
            pendentes: tentativas0,
            disparados1: tentativas1,
            disparados2: tentativas2 + tentativasMaior2,
            emFila: ligacaoErro,
            encerrados: encerradosSucesso + encerradosTentativas,
            elegiveisDisparo: tentativas0 + ligacaoErro
          };

          console.log(`📊 Métricas agregadas para ${eventoId}:`, metricsResult);

          metricsCache[cacheKey] = {
            metrics: metricsResult,
            timestamp: Date.now()
          };

          return metricsResult;
        }
        
        // Formato legado: lista de contatos individuais
        const metricsResult: MetricasLigacaoExternas = {
          total: data.length,
          pendentes: 0,
          disparados1: 0,
          disparados2: 0,
          emFila: 0,
          encerrados: 0,
          elegiveisDisparo: 0
        };

        for (const contato of data) {
          const numTentativas = Number(contato.num_tentativas) || 0;
          const statusAgendado = contato.status_agendado === true;
          const enviadoWhatsapp = contato.enviado_whatsapp === true;
          const ligacaoAtendida = contato.ligacao_atendida === true;
          const ligacaoErro = contato.ligacao_erro === true;

          const isSuccessEncerrado = statusAgendado || enviadoWhatsapp || ligacaoAtendida;
          const isEncerrado = isSuccessEncerrado || numTentativas >= 2;
          const isEmFila = ligacaoErro && numTentativas < 2 && !isSuccessEncerrado;
          
          if (isEmFila) metricsResult.emFila++;
          if (isEncerrado) metricsResult.encerrados++;

          if (numTentativas === 0) {
            metricsResult.pendentes++;
          } else if (numTentativas === 1) {
            metricsResult.disparados1++;
          } else {
            metricsResult.disparados2++;
          }
        }

        metricsResult.elegiveisDisparo = metricsResult.pendentes + metricsResult.emFila;
        console.log(`📊 Métricas calculadas para ${eventoId}:`, metricsResult);

        metricsCache[cacheKey] = {
          metrics: metricsResult,
          timestamp: Date.now()
        };

        return metricsResult;
      }

      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar métricas de ligação:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany?.id, fetchTelefonePriLigacao]);

  // Buscar métricas para múltiplos eventos em paralelo
  const fetchMetricasMultiplosEventos = useCallback(async (
    eventos: Array<{ id: string; eventIdPri?: string | null }>
  ): Promise<Map<string, MetricasLigacaoExternas>> => {
    const resultMap = new Map<string, MetricasLigacaoExternas>();
    
    // Processar em lotes de 3 para não sobrecarregar
    const batchSize = 3;
    for (let i = 0; i < eventos.length; i += batchSize) {
      const batch = eventos.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (evento) => {
          const metrics = await fetchMetricasLigacao(evento.id, evento.eventIdPri);
          return { id: evento.id, metrics };
        })
      );
      
      results.forEach(({ id, metrics }) => {
        if (metrics) {
          resultMap.set(id, metrics);
        }
      });
    }
    
    return resultMap;
  }, [fetchMetricasLigacao]);

  // Limpar cache de um evento específico
  const invalidateCache = useCallback((eventoId: string) => {
    if (!activeCompany?.id) return;
    const cacheKey = `${activeCompany.id}_${eventoId}`;
    delete metricsCache[cacheKey];
  }, [activeCompany?.id]);

  return {
    fetchMetricasLigacao,
    fetchMetricasMultiplosEventos,
    invalidateCache,
    isLoading
  };
}
