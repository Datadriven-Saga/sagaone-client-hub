import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Trash2, Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SyncResult {
  success: boolean;
  summary: {
    added: number;
    updated: number;
    deleted: number;
    errors: number;
  };
  details: {
    added: Array<{ nome: string; crm_id: string; status: string }>;
    updated: Array<{ nome: string; crm_id: string; status: string }>;
    deleted: Array<{ id: string; crm_id: string; status: string }>;
    errors: Array<{ nome?: string; crm_id?: string; error: string }>;
  };
}

export function SyncEmpresasButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para sincronizar empresas");
        return;
      }

      const { data, error } = await supabase.functions.invoke('sync-empresas', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setSyncResult(data as SyncResult);
      
      if (data.success) {
        toast.success(
          `Sincronização concluída! ${data.summary.added} adicionadas, ${data.summary.updated} atualizadas, ${data.summary.deleted} removidas`
        );
      } else {
        toast.error('Erro na sincronização: ' + data.error);
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast.error('Erro ao sincronizar empresas: ' + (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'updated':
        return <Pencil className="h-4 w-4 text-blue-500" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'added':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Adicionada</Badge>;
      case 'updated':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Atualizada</Badge>;
      case 'deleted':
        return <Badge variant="destructive">Removida</Badge>;
      default:
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Erro</Badge>;
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSyncResult(null);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sincronizar Empresas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sincronizar Empresas do Grupo Saga</DialogTitle>
          <DialogDescription>
            Esta ação irá sincronizar as empresas com a lista oficial do CSV.
            {syncResult && syncResult.success && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Resultado da Sincronização:</h4>
                <div className="flex gap-4 text-sm flex-wrap">
                  <span className="text-green-600 flex items-center gap-1">
                    <Plus className="h-4 w-4" /> {syncResult.summary.added} adicionadas
                  </span>
                  <span className="text-blue-600 flex items-center gap-1">
                    <Pencil className="h-4 w-4" /> {syncResult.summary.updated} atualizadas
                  </span>
                  <span className="text-red-600 flex items-center gap-1">
                    <Trash2 className="h-4 w-4" /> {syncResult.summary.deleted} removidas
                  </span>
                  {syncResult.summary.errors > 0 && (
                    <span className="text-yellow-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> {syncResult.summary.errors} erros
                    </span>
                  )}
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {!syncResult ? (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-muted-foreground">
              <p>Esta operação irá:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Adicionar empresas que estão no CSV mas não no banco</li>
                <li>Atualizar dados de empresas existentes</li>
                <li>Remover empresas que não estão no CSV</li>
                <li>Usar o crm_id como identificador único</li>
              </ul>
            </div>
            
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  "Iniciar Sincronização"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ScrollArea className="h-[400px] w-full border rounded-md p-4">
              <div className="space-y-2">
                {/* Added */}
                {syncResult.details.added.map((item, index) => (
                  <div key={`added-${index}`} className="flex items-center gap-3 p-2 border rounded">
                    {getStatusIcon('added')}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.nome}</div>
                      <div className="text-xs text-muted-foreground">CRM ID: {item.crm_id}</div>
                    </div>
                    {getStatusBadge('added')}
                  </div>
                ))}
                
                {/* Updated */}
                {syncResult.details.updated.map((item, index) => (
                  <div key={`updated-${index}`} className="flex items-center gap-3 p-2 border rounded">
                    {getStatusIcon('updated')}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.nome}</div>
                      <div className="text-xs text-muted-foreground">CRM ID: {item.crm_id}</div>
                    </div>
                    {getStatusBadge('updated')}
                  </div>
                ))}
                
                {/* Deleted */}
                {syncResult.details.deleted.map((item, index) => (
                  <div key={`deleted-${index}`} className="flex items-center gap-3 p-2 border rounded">
                    {getStatusIcon('deleted')}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">ID: {item.id}</div>
                      <div className="text-xs text-muted-foreground">CRM ID: {item.crm_id}</div>
                    </div>
                    {getStatusBadge('deleted')}
                  </div>
                ))}
                
                {/* Errors */}
                {syncResult.details.errors.map((item, index) => (
                  <div key={`error-${index}`} className="flex items-center gap-3 p-2 border rounded border-destructive">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.nome || 'Desconhecido'}</div>
                      <div className="text-xs text-destructive">{item.error}</div>
                    </div>
                    <Badge variant="destructive">Erro</Badge>
                  </div>
                ))}
                
                {syncResult.details.added.length === 0 && 
                 syncResult.details.updated.length === 0 && 
                 syncResult.details.deleted.length === 0 && 
                 syncResult.details.errors.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Nenhuma alteração necessária. Banco já está sincronizado!</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
