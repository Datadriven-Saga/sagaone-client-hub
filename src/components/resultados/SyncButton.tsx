import { useState } from 'react';
import { RefreshCw, Check, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncButtonProps {
  telefonePri: string | null;
  idEvento: string | null;
  empresaId: string | null;
  onSyncComplete?: () => void;
  className?: string;
}

export const SyncButton = ({ 
  telefonePri, 
  idEvento, 
  empresaId,
  onSyncComplete,
  className 
}: SyncButtonProps) => {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    prospect_upserted?: number;
    cadencia_upserted?: number;
    total_webhook?: number;
    errors?: string[];
  } | null>(null);

  const handleSync = async () => {
    if (!telefonePri || !idEvento || !empresaId) {
      toast.error('Selecione um evento para sincronizar');
      return;
    }

    setStatus('syncing');
    setSyncResult(null);

    try {
      console.log('🔄 Iniciando sincronização...', { telefonePri, idEvento, empresaId });

      const { data, error } = await supabase.functions.invoke('sync-pri-dashboard', {
        body: {
          telefone_pri: telefonePri,
          id_evento: idEvento,
          empresa_id: empresaId,
        },
      });

      if (error) {
        console.error('❌ Erro na sincronização:', error);
        setStatus('error');
        toast.error('Erro ao sincronizar dados');
        return;
      }

      console.log('✅ Sincronização concluída:', data);

      if (data?.success) {
        setStatus('success');
        setSyncResult(data.result);
        setLastSync(new Date().toLocaleString('pt-BR'));
        
        const prospectCount = data.result?.prospect_upserted || 0;
        const cadenciaCount = data.result?.cadencia_upserted || 0;
        
        if (prospectCount > 0 || cadenciaCount > 0) {
          toast.success(`Sincronização concluída: ${prospectCount} prospects, ${cadenciaCount} cadências`);
        } else if (data.message) {
          toast.info(data.message);
        } else {
          toast.success('Sincronização concluída');
        }

        // Reset para idle após 5 segundos
        setTimeout(() => {
          setStatus('idle');
        }, 5000);

        onSyncComplete?.();
      } else {
        setStatus('error');
        toast.error(data?.error || 'Erro desconhecido na sincronização');
      }
    } catch (err) {
      console.error('❌ Erro ao chamar edge function:', err);
      setStatus('error');
      toast.error('Falha na comunicação com o servidor');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <Check className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'syncing':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'success':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'error':
        return 'bg-destructive hover:bg-destructive/90 text-destructive-foreground';
      default:
        return '';
    }
  };

  const getTooltipContent = () => {
    if (status === 'syncing') {
      return 'Sincronizando dados do n8n...';
    }
    if (status === 'success' && syncResult) {
      return (
        <div className="text-xs space-y-1">
          <p className="font-medium">✅ Sincronização concluída</p>
          <p>Prospects: {syncResult.prospect_upserted || 0}</p>
          <p>Cadências: {syncResult.cadencia_upserted || 0}</p>
          {lastSync && <p className="text-muted-foreground">Última: {lastSync}</p>}
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="text-xs space-y-1">
          <p className="font-medium text-destructive">❌ Erro na sincronização</p>
          {syncResult?.errors?.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
          <p className="text-muted-foreground">Clique para tentar novamente</p>
        </div>
      );
    }
    return (
      <div className="text-xs space-y-1">
        <p>Sincronizar dados do n8n</p>
        {lastSync && <p className="text-muted-foreground">Última: {lastSync}</p>}
      </div>
    );
  };

  const isDisabled = !telefonePri || !idEvento || !empresaId || status === 'syncing';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={status === 'idle' ? 'outline' : 'default'}
            size="sm"
            onClick={handleSync}
            disabled={isDisabled}
            className={cn(
              'gap-2 transition-all duration-300',
              getStatusColor(),
              className
            )}
          >
            {getStatusIcon()}
            <span className="hidden sm:inline">
              {status === 'syncing' ? 'Sincronizando...' : 
               status === 'success' ? 'Sincronizado' :
               status === 'error' ? 'Erro' : 'Sincronizar'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
