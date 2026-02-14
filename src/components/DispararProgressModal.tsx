import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Send, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface CampaignJob {
  id: string;
  total_records: number;
  processed_records: number;
  failed_records: number;
  status: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface DispararProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  onRetry?: (jobId: string) => void;
}

const DispararProgressModal: React.FC<DispararProgressModalProps> = ({
  isOpen,
  onClose,
  jobId,
  onRetry,
}) => {
  const [job, setJob] = useState<CampaignJob | null>(null);
  const [dots, setDots] = useState('');
  const dotsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial job data
  useEffect(() => {
    if (!isOpen || !jobId) return;

    const fetchJob = async () => {
      const { data } = await supabase
        .from('campaign_jobs')
        .select('id, total_records, processed_records, failed_records, status, error_message, started_at, completed_at')
        .eq('id', jobId)
        .single();
      if (data) setJob(data as CampaignJob);
    };
    fetchJob();
  }, [isOpen, jobId]);

  // Subscribe to Realtime updates
  useEffect(() => {
    if (!isOpen || !jobId) return;

    const channel = supabase
      .channel(`campaign-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaign_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const updated = payload.new as CampaignJob;
          setJob(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, jobId]);

  // Dots animation
  useEffect(() => {
    if (!isOpen || !job || job.status === 'completed' || job.status === 'failed') {
      setDots('');
      return;
    }

    dotsRef.current = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => {
      if (dotsRef.current) clearInterval(dotsRef.current);
    };
  }, [isOpen, job?.status]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setJob(null);
      setDots('');
    }
  }, [isOpen]);

  const totalContatos = job?.total_records || 0;
  const displayedCount = job?.processed_records || 0;
  const failedCount = job?.failed_records || 0;
  const isCompleted = job?.status === 'completed';
  const isFailed = job?.status === 'failed';
  const isProcessing = job?.status === 'processing' || job?.status === 'pending';
  const progress = totalContatos > 0 ? (displayedCount / totalContatos) * 100 : 0;
  const hasRetryable = isFailed && failedCount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-semibold">
            {isCompleted ? 'Disparo Concluído!' : isFailed ? 'Disparo com Erros' : 'Disparando Mensagens'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-6">
          {/* Ícone animado */}
          <div className={cn(
            "relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500",
            isCompleted
              ? "bg-green-100 dark:bg-green-900/30"
              : isFailed
                ? "bg-destructive/10"
                : "bg-primary/10"
          )}>
            {isCompleted ? (
              <Check className="w-12 h-12 text-green-600 dark:text-green-400 animate-scale-in" />
            ) : isFailed ? (
              <AlertTriangle className="w-12 h-12 text-destructive" />
            ) : (
              <>
                <Send className="w-10 h-10 text-primary animate-pulse" />
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="48" cy="48" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                  <circle
                    cx="48" cy="48" r="44" fill="none"
                    stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
              </>
            )}
          </div>

          {/* Status text */}
          <div className="text-center space-y-2">
            {isCompleted ? (
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                {failedCount > 0 
                  ? `Concluído com ${failedCount} falha(s)`
                  : 'Todos os disparos foram realizados!'
                }
              </p>
            ) : isFailed ? (
              <p className="text-lg font-semibold text-destructive">
                {job?.error_message || `${failedCount} registros falharam`}
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Enviando mensagens{dots}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Processando no servidor (você pode fechar esta janela)
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Contador */}
          <div className="bg-muted/50 rounded-lg px-6 py-4 min-w-[200px]">
            <div className="text-center">
              <span className="text-4xl font-bold text-primary tabular-nums">
                {displayedCount.toLocaleString('pt-BR')}
              </span>
              <span className="text-2xl text-muted-foreground mx-2">/</span>
              <span className="text-2xl text-muted-foreground tabular-nums">
                {totalContatos.toLocaleString('pt-BR')}
              </span>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-1">
              {isCompleted ? 'contatos disparados' : 'contatos processados'}
            </p>
            {failedCount > 0 && (
              <p className="text-center text-sm text-destructive mt-1">
                {failedCount.toLocaleString('pt-BR')} falha(s)
              </p>
            )}
          </div>

          {/* Barra de progresso */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-1000 ease-out rounded-full",
                isCompleted ? "bg-green-500" : isFailed ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            {hasRetryable && onRetry && jobId && (
              <Button variant="default" onClick={() => onRetry(jobId)}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Retomar Falhas
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              {isCompleted || isFailed ? 'Fechar' : 'Deixar em segundo plano'}
            </Button>
          </div>

          {isProcessing && (
            <p className="text-xs text-muted-foreground text-center">
              O envio continua no servidor mesmo se você fechar esta janela
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DispararProgressModal;
