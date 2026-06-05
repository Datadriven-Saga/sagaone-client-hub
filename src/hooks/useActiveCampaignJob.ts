import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

/**
 * Retorna se existe um job de disparo ativo (pending/processing) para a
 * combinação (empresa ativa, prospeccaoId). Usado para desabilitar o botão
 * "Disparar" e evitar concorrência (também garantida por índice único no DB).
 */
export function useActiveCampaignJob(prospeccaoId?: string | null) {
  const { activeCompany } = useCompany();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompany?.id || !prospeccaoId) {
      setActiveJobId(null);
      return;
    }

    let cancelled = false;

    const fetchActive = async () => {
      const { data } = await supabase
        .from('campaign_jobs')
        .select('id, status')
        .eq('empresa_id', activeCompany.id)
        .eq('prospeccao_id', prospeccaoId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      setActiveJobId(data && data.length > 0 ? data[0].id : null);
    };

    fetchActive();

    const channel = supabase
      .channel(`active-job-${prospeccaoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_jobs', filter: `prospeccao_id=eq.${prospeccaoId}` },
        () => { fetchActive(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeCompany?.id, prospeccaoId]);

  return { hasActiveJob: !!activeJobId, activeJobId };
}