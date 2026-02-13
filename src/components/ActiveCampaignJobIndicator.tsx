import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import DispararProgressModal from './DispararProgressModal';

interface ActiveJob {
  id: string;
  total_records: number;
  processed_records: number;
  status: string;
}

const ActiveCampaignJobIndicator: React.FC = () => {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Check for active jobs on mount and subscribe
  useEffect(() => {
    if (!activeCompany?.id) return;

    const fetchActive = async () => {
      const { data } = await supabase
        .from('campaign_jobs')
        .select('id, total_records, processed_records, status')
        .eq('empresa_id', activeCompany.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setActiveJob(data[0] as ActiveJob);
      } else {
        setActiveJob(null);
      }
    };

    fetchActive();

    // Subscribe to changes
    const channel = supabase
      .channel('campaign-jobs-active')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_jobs',
        },
        (payload) => {
          const job = (payload.new || payload.old) as any;
          if (job?.empresa_id !== activeCompany.id) return;

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newJob = payload.new as ActiveJob;
            if (newJob.status === 'pending' || newJob.status === 'processing') {
              setActiveJob(newJob);
            } else if (newJob.status === 'completed') {
              setActiveJob(null);
              toast({
                title: '✅ Disparo concluído!',
                description: `${newJob.processed_records} contatos processados`,
              });
            } else if (newJob.status === 'failed') {
              setActiveJob(null);
              toast({
                title: '⚠️ Disparo com erros',
                description: 'Verifique o histórico de disparos',
                variant: 'destructive',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCompany?.id, toast]);

  if (!activeJob) return null;

  const progress = activeJob.total_records > 0
    ? Math.round((activeJob.processed_records / activeJob.total_records) * 100)
    : 0;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors text-sm"
      >
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-primary font-medium">
          Disparando {progress}%
        </span>
      </button>

      <DispararProgressModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        jobId={activeJob.id}
      />
    </>
  );
};

export default ActiveCampaignJobIndicator;
