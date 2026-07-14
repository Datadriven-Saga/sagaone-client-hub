import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Clock, X, Eye, Loader2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useScheduledCampaignJobs, type ScheduledJob } from '@/hooks/useScheduledCampaignJobs';

interface Props {
  prospeccaoId: string | undefined;
  canCancel: boolean;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Agendado', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' },
  processing: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100' },
  partially_completed: { label: 'Parcial', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100' },
  completed: { label: 'Concluído', cls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
  cancelled: { label: 'Cancelado', cls: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100' },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
  pending: { label: 'Pendente', cls: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100' },
};

function fmt(ts: string | null) {
  if (!ts) return '—';
  try { return format(new Date(ts), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return ts; }
}

// Agrupa chunks físicos (CHUNK=250) por lot_index — cada lote de negócio
// pode ter N chunks no mesmo scheduled_at; a UI exibe 1 linha por lote.
const STATUS_PRIORITY = ['processing', 'scheduled', 'pending', 'failed', 'cancelled', 'completed'];

type GroupedLot = {
  lot_index: number;
  scheduled_at: string | null;
  total_leads: number;
  status: string;
  retry_count: number;
  locked_at: string | null;
  chunk_count: number;
};

function groupBatchesByLot(batches: ScheduledJob['batches']): GroupedLot[] {
  const byIndex = new Map<number, ScheduledJob['batches']>();
  for (const b of batches) {
    const idx = b.lot_index ?? 0;
    if (!byIndex.has(idx)) byIndex.set(idx, []);
    byIndex.get(idx)!.push(b);
  }
  const grouped: GroupedLot[] = [];
  for (const [lot_index, chunks] of byIndex) {
    const statusAgg = STATUS_PRIORITY.find(s => chunks.some(c => c.status === s)) ?? chunks[0].status;
    const lockedAts = chunks.filter(c => c.status === 'processing' && c.locked_at).map(c => c.locked_at!);
    grouped.push({
      lot_index,
      scheduled_at: chunks[0].scheduled_at,
      total_leads: chunks.reduce((s, c) => s + (c.total_leads || 0), 0),
      status: statusAgg,
      retry_count: Math.max(0, ...chunks.map(c => c.retry_count ?? 0)),
      locked_at: lockedAts.length ? lockedAts.reduce((a, b) => a < b ? a : b) : null,
      chunk_count: chunks.length,
    });
  }
  return grouped.sort((a, b) => a.lot_index - b.lot_index);
}

export default function DisparosProgramadosList({ prospeccaoId, canCancel }: Props) {
  const { jobs, loading, cancelJob } = useScheduledCampaignJobs(prospeccaoId);
  const { toast } = useToast();
  const [detailJob, setDetailJob] = useState<ScheduledJob | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  if (!prospeccaoId) return null;
  if (!loading && jobs.length === 0) return null;

  const onCancel = async () => {
    if (!confirmCancelId) return;
    setCancelling(true);
    try {
      const res: any = await cancelJob(confirmCancelId);
      toast({
        title: 'Disparo cancelado',
        description: res?.kept_processing
          ? `${res?.cancelled_batches ?? 0} lote(s) cancelado(s). ${res.kept_processing} em execução serão finalizados.`
          : `${res?.cancelled_batches ?? 0} lote(s) cancelado(s).`,
      });
      setConfirmCancelId(null);
    } catch (e: any) {
      toast({ title: 'Erro ao cancelar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" /> Disparos programados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Lotes</TableHead>
              <TableHead>Próximo lote</TableHead>
              <TableHead>Primeiro envio</TableHead>
              <TableHead>Último envio</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map(j => {
              const lotesAgrupados = groupBatchesByLot(j.batches);
              const scheduled = j.batches.filter(b => b.status === 'scheduled');
              const proximo = scheduled.length
                ? scheduled.reduce((a, b) => (a.scheduled_at! < (b.scheduled_at ?? '')) ? a : b).scheduled_at
                : null;
              const datas = j.batches.map(b => b.scheduled_at).filter(Boolean) as string[];
              const min = datas.length ? datas.reduce((a, b) => a < b ? a : b) : j.first_scheduled_at;
              const max = datas.length ? datas.reduce((a, b) => a > b ? a : b) : j.first_scheduled_at;
              const done = (j.processed_records ?? 0) + (j.failed_records ?? 0) + (j.duplicate_records ?? 0);
              const sb = STATUS_BADGE[j.status] ?? { label: j.status, cls: 'bg-slate-100 text-slate-800' };
              return (
                <TableRow key={j.id}>
                  <TableCell><Badge className={sb.cls}>{sb.label}</Badge></TableCell>
                  <TableCell className="text-right">{j.total_records.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{lotesAgrupados.length}</TableCell>
                  <TableCell>{fmt(proximo)}</TableCell>
                  <TableCell>{fmt(min)}</TableCell>
                  <TableCell>{fmt(max)}</TableCell>
                  <TableCell>{done.toLocaleString()} / {j.total_records.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setDetailJob(j)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canCancel}
                        onClick={() => canCancel && setConfirmCancelId(j.id)}
                        className="text-destructive hover:text-destructive"
                        title={canCancel ? 'Cancelar disparo programado' : 'Sem permissão'}
                      >
                        {canCancel ? <X className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Dialog open={!!detailJob} onOpenChange={(o) => !o && setDetailJob(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Lotes programados</DialogTitle>
              <DialogDescription>
                Total: {detailJob?.total_records.toLocaleString()} contatos · {detailJob ? groupBatchesByLot(detailJob.batches).length : 0} lotes
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60dvh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agendado para</TableHead>
                    <TableHead className="text-right">Contatos</TableHead>
                    <TableHead className="text-right">Tentativas</TableHead>
                    <TableHead>Em processamento desde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detailJob ? groupBatchesByLot(detailJob.batches) : []).map(b => {
                    const sb = STATUS_BADGE[b.status] ?? { label: b.status, cls: 'bg-slate-100 text-slate-800' };
                    return (
                      <TableRow key={b.lot_index}>
                        <TableCell>{b.lot_index + 1}</TableCell>
                        <TableCell><Badge className={sb.cls}>{sb.label}</Badge></TableCell>
                        <TableCell>{fmt(b.scheduled_at)}</TableCell>
                        <TableCell className="text-right">{b.total_leads.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{b.retry_count}</TableCell>
                        <TableCell>{b.status === 'processing' ? fmt(b.locked_at) : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailJob(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!confirmCancelId} onOpenChange={(o) => !o && !cancelling && setConfirmCancelId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar disparo programado?</AlertDialogTitle>
              <AlertDialogDescription>
                Os lotes ainda não enviados serão cancelados. Lotes em execução serão finalizados normalmente. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); onCancel(); }} disabled={cancelling}>
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancelar disparo'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}