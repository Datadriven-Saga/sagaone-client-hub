import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import DispararProgressModal from './DispararProgressModal';

interface ActiveJob {
  id: string;
  total_records: number;
  processed_records: number;
  status: string;
  started_at: string | null;
  updated_at: string;
}

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

const ActiveCampaignJobIndicator: React.FC = () => {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [showModal, setShowModal] = useState(false);

  const isJobStuck = useCallback((job: ActiveJob): boolean => {
    const refTime = job.updated_at || job.started_at;
    if (!refTime) return false;
    return (Date.now() - new Date(refTime).getTime()) > STUCK_THRESHOLD_MS;
  }, []);

  const autoResolveStuckJob = useCallback(async (job: ActiveJob) => {
    console.warn(`🛑 Auto-resolvendo job travado: ${job.id}`);
    await supabase.from('campaign_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      error_message: `Finalizado automaticamente (sem atividade por 10+ min). ${job.processed_records}/${job.total_records} processados.`,
    }).eq('id', job.id);

    await supabase.from('campaign_batches').update({
      status: 'failed',
      error_log: 'Job finalizado automaticamente (timeout)',
    }).eq('job_id', job.id).in('status', ['pending', 'processing']);

    setActiveJob(null);
    toast({
      title: '⚠️ Disparo finalizado automaticamente',
      description: `O servidor parou de responder. ${job.processed_records} de ${job.total_records} contatos foram processados.`,
    });
  }, [toast]);

  // Check for active jobs on mount and subscribe
  useEffect(() => {
    if (!activeCompany?.id) return;

    const fetchActive = async () => {
      const { data } = await supabase
        .from('campaign_jobs')
        .select('id, total_records, processed_records, status, started_at, updated_at')
        .eq('empresa_id', activeCompany.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const job = data[0] as ActiveJob;
        // Auto-resolve if stuck
        if (isJobStuck(job)) {
          await autoResolveStuckJob(job);
        } else {
          setActiveJob(job);
        }
      } else {
        setActiveJob(null);
      }
    };

    fetchActive();

    // Also periodically check for stuck state (every 2 min)
    const interval = setInterval(() => {
      if (activeJob && isJobStuck(activeJob)) {
        autoResolveStuckJob(activeJob);
      }
    }, 2 * 60 * 1000);

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
            } else if (newJob.status === 'completed' || newJob.status === 'cancelled') {
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
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [activeCompany?.id, toast, isJobStuck, autoResolveStuckJob]);

  if (!activeJob) return null;

  const progress = activeJob.total_records > 0
    ? Math.round((activeJob.processed_records / activeJob.total_records) * 100)
    : 0;

  const stuck = isJobStuck(activeJob);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors text-sm ${
          stuck ? 'bg-amber-500/10 hover:bg-amber-500/20' : 'bg-primary/10 hover:bg-primary/20'
        }`}
      >
        {stuck ? (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        )}
        <span className={`font-medium ${stuck ? 'text-amber-500' : 'text-primary'}`}>
          {stuck ? 'Disparo travado' : `Disparando ${progress}%`}
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
