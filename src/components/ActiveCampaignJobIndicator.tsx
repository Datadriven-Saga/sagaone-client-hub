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

/**
 * LIMITAÇÃO CONHECIDA — recuperação de jobs órfãos
 * --------------------------------------------------
 * A recuperação automática de um disparo immediate travado depende deste
 * componente estar montado no frontend (alguém com a empresa do job aberta).
 * Se ninguém estiver na UI após um crash mid-chain, o batch fica órfão até
 * a UI ser aberta ou o usuário acionar "Retomar Falhas". Recuperação
 * server-side está fora desta fase.
 */

const ActiveCampaignJobIndicator: React.FC = () => {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [showModal, setShowModal] = useState(false);
  // Evita re-tentar recuperação para o mesmo job em loops sucessivos.
  const [recoveryAttempted] = useState<Map<string, number>>(() => new Map());

  const isJobStuck = useCallback((job: ActiveJob): boolean => {
    const refTime = job.updated_at || job.started_at;
    if (!refTime) return false;
    return (Date.now() - new Date(refTime).getTime()) > STUCK_THRESHOLD_MS;
  }, []);

  const autoResolveStuckJob = useCallback(async (job: ActiveJob) => {
    // Guarda: se ainda houver lotes scheduled no futuro, NÃO finalizar.
    // Disparos programados podem ter intervalos longos (30min, 1h) entre lotes,
    // o que faria updated_at parecer "travado" entre os lotes.
    const nowIso = new Date().toISOString();
    const { count: futureScheduled } = await supabase
      .from('campaign_batches')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', job.id)
      .eq('status', 'scheduled')
      .gt('scheduled_at', nowIso);
    if ((futureScheduled ?? 0) > 0) {
      console.log(`⏭️ Job ${job.id} tem ${futureScheduled} lotes scheduled futuros — não é travamento.`);
      setActiveJob(null);
      return;
    }

    // Tentativa de recuperação via self-chain antes de marcar como falho.
    // O process-campaign-job reivindica batches em 'processing' há >10min
    // (RPC claim_next_immediate_batch), então o job estagnado é re-engatado.
    const lastAttempt = recoveryAttempted.get(job.id) || 0;
    if (Date.now() - lastAttempt > STUCK_THRESHOLD_MS) {
      recoveryAttempted.set(job.id, Date.now());
      console.warn(`🔁 Tentando recuperar job ${job.id} via self-chain antes de finalizar`);
      try {
        await supabase.functions.invoke('process-campaign-job', {
          body: { job_id: job.id },
        });
        // Notifica o usuário que o disparo foi retomado.
        try {
          const { data: jobFull } = await (supabase as any)
            .from('campaign_jobs')
            .select('user_id, empresa_id, prospeccao_id')
            .eq('id', job.id)
            .single();
          if (jobFull?.user_id) {
            await (supabase as any).from('notificacoes').insert({
              user_id: jobFull.user_id,
              empresa_id: jobFull.empresa_id,
              tipo: 'disparo_retomado',
              titulo: 'Disparo retomado',
              mensagem: `Detectamos uma pausa no disparo e ele foi retomado automaticamente.`,
              link: `/prospeccao/${jobFull.prospeccao_id || ''}?job=${job.id}`,
              lida: false,
            });
          }
        } catch (e) {
          console.warn('Falha ao notificar retomada:', e);
        }
        // Poll por 90s aguardando updated_at avançar.
        const startCheck = Date.now();
        const baseUpdated = new Date(job.updated_at).getTime();
        let recovered = false;
        while (Date.now() - startCheck < 90_000) {
          await new Promise((r) => setTimeout(r, 10_000));
          const { data: jr } = await supabase
            .from('campaign_jobs')
            .select('updated_at, status')
            .eq('id', job.id)
            .single();
          if (jr && (new Date(jr.updated_at).getTime() > baseUpdated || ['completed','partially_completed','cancelled','failed'].includes(jr.status))) {
            recovered = true;
            break;
          }
        }
        if (recovered) {
          console.log(`✅ Job ${job.id} recuperado via self-chain.`);
          return;
        }
        console.warn(`⏱️ Job ${job.id} não progrediu após tentativa de recuperação — marcando como finalizado.`);
      } catch (e) {
        console.warn(`⚠️ Recuperação via invoke falhou para job ${job.id}:`, e);
      }
    }

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
    // NÃO tocar em batches 'scheduled' — eles podem ter scheduled_at no passado
    // (e neste caso o cron-dispatcher os reivindicará na próxima volta).

    // Persistir notificação para quem programou o disparo
    try {
      const { data: jobFull } = await (supabase as any)
        .from('campaign_jobs')
        .select('user_id, empresa_id, prospeccao_id')
        .eq('id', job.id)
        .single();
      if (jobFull?.user_id) {
        const link = `/prospeccao/${jobFull.prospeccao_id || ''}?job=${job.id}`;
        const { data: existing } = await (supabase as any)
          .from('notificacoes')
          .select('id')
          .eq('user_id', jobFull.user_id)
          .eq('tipo', 'disparo_falhou')
          .eq('link', link)
          .limit(1);
        if (!existing || existing.length === 0) {
          await (supabase as any).from('notificacoes').insert({
            user_id: jobFull.user_id,
            empresa_id: jobFull.empresa_id,
            tipo: 'disparo_falhou',
            titulo: 'Disparo finalizado automaticamente',
            mensagem: `O servidor parou de responder. ${job.processed_records} de ${job.total_records} contatos foram processados.`.substring(0, 240),
            link,
            lida: false,
          });
        }
      }
    } catch (e) {
      console.warn('Falha ao persistir notificação de timeout:', e);
    }

    setActiveJob(null);
    toast({
      title: '⚠️ Disparo finalizado automaticamente',
      description: `O servidor parou de responder. ${job.processed_records} de ${job.total_records} contatos foram processados.`,
    });
  }, [toast, recoveryAttempted]);

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
        // Se há lotes scheduled futuros, é um job entre lotes — não mostrar como "Disparando".
        const { count: futureScheduled } = await supabase
          .from('campaign_batches')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', job.id)
          .eq('status', 'scheduled')
          .gt('scheduled_at', new Date().toISOString());
        if ((futureScheduled ?? 0) > 0) {
          setActiveJob(null);
        } else if (isJobStuck(job)) {
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
