import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduledBatch {
  id: string;
  lot_index: number | null;
  scheduled_at: string | null;
  status: string;
  total_leads: number;
  retry_count: number | null;
  locked_at: string | null;
}

export interface ScheduledJob {
  id: string;
  status: string;
  dispatch_mode: string | null;
  total_records: number;
  processed_records: number;
  failed_records: number;
  duplicate_records: number;
  first_scheduled_at: string | null;
  cadence_type: string | null;
  interval_minutes: number | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  user_id: string;
  created_at: string;
  batches: ScheduledBatch[];
}

const ACTIVE_STATUSES = ['scheduled', 'processing', 'partially_completed'];

export function useScheduledCampaignJobs(prospeccaoId: string | undefined) {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!prospeccaoId) {
      setJobs([]);
      return;
    }
    setLoading(true);
    const { data: js } = await supabase
      .from('campaign_jobs')
      .select('id, status, dispatch_mode, total_records, processed_records, failed_records, duplicate_records, first_scheduled_at, cadence_type, interval_minutes, cancelled_at, cancelled_by, user_id, created_at')
      .eq('prospeccao_id', prospeccaoId)
      .eq('dispatch_mode', 'scheduled')
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false });

    const jobIds = (js ?? []).map(j => j.id);
    let bsByJob: Record<string, ScheduledBatch[]> = {};
    if (jobIds.length) {
      const { data: bs } = await supabase
        .from('campaign_batches')
        .select('id, job_id, lot_index, scheduled_at, status, total_leads, retry_count, locked_at')
        .in('job_id', jobIds)
        .order('lot_index', { ascending: true });
      for (const b of (bs ?? []) as any[]) {
        (bsByJob[b.job_id] ??= []).push({
          id: b.id, lot_index: b.lot_index, scheduled_at: b.scheduled_at,
          status: b.status, total_leads: b.total_leads, retry_count: b.retry_count, locked_at: b.locked_at,
        });
      }
    }

    setJobs((js ?? []).map(j => ({ ...(j as any), batches: bsByJob[j.id] ?? [] })));
    setLoading(false);
  }, [prospeccaoId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    if (!prospeccaoId) return;
    const channel = supabase
      .channel(`scheduled-jobs-${prospeccaoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_jobs', filter: `prospeccao_id=eq.${prospeccaoId}` }, () => { fetchJobs(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_batches' }, () => { fetchJobs(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [prospeccaoId, fetchJobs]);

  const cancelJob = useCallback(async (jobId: string) => {
    const { data, error } = await supabase.rpc('cancel_scheduled_campaign_job', { p_job_id: jobId });
    if (error) throw error;
    await fetchJobs();
    return data;
  }, [fetchJobs]);

  return { jobs, loading, refetch: fetchJobs, cancelJob };
}