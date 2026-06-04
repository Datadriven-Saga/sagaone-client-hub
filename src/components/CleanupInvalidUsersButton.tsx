import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserX, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CleanupResult {
  success: boolean;
  summary: {
    total_invalid: number;
    deleted: number;
    errors: number;
  };
  deleted: Array<{ id: string; email: string; status: string }>;
  errors: Array<{ id: string; email: string; error: string }>;
}

export function CleanupInvalidUsersButton() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCleanup = async () => {
    setIsProcessing(true);
    setResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para executar esta ação");
        return;
      }

      const { data, error } = await supabase.functions.invoke('cleanup-invalid-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setResult(data as CleanupResult);
      
      if (data.success) {
        if (data.summary.deleted > 0) {
          toast.success(`${data.summary.deleted} usuários com domínio inválido foram removidos`);
        } else {
          toast.info('Nenhum usuário com domínio inválido encontrado');
        }
      } else {
        toast.error('Erro na limpeza: ' + data.error);
      }
    } catch (error) {
      console.error('Erro na limpeza:', error);
      toast.error('Erro ao limpar usuários: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setResult(null);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <UserX className="h-4 w-4 mr-2" />
          Remover Usuários Inválidos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Remover Usuários com Domínio Inválido</DialogTitle>
          <DialogDescription>
            Remove usuários cujo domínio não está autorizado em <code>allowed_login_domains</code>. Usuários externos (cadeiras) são preservados.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção!</AlertTitle>
              <AlertDescription>
                Esta ação é irreversível. Todos os usuários com domínio diferente de @gruposaga.com.br serão permanentemente removidos do sistema.
              </AlertDescription>
            </Alert>
            
            <div className="text-sm text-muted-foreground">
              <p>Esta operação irá:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Identificar usuários com domínio fora dos domínios autorizados</li>
                <li>Preservar usuários externos (cadeiras de terceiros)</li>
                <li>Remover perfis e contas de autenticação dos demais</li>
              </ul>
            </div>
            
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleCleanup}
                disabled={isProcessing}
              >
                {isProcessing ? "Processando..." : "Confirmar Remoção"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Resultado:</h4>
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> {result.summary.total_invalid} inválidos encontrados
                </span>
                <span className="text-red-600 flex items-center gap-1">
                  <UserX className="h-4 w-4" /> {result.summary.deleted} removidos
                </span>
                {result.summary.errors > 0 && (
                  <span className="text-destructive flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> {result.summary.errors} erros
                  </span>
                )}
              </div>
            </div>

            <ScrollArea className="h-[300px] w-full border rounded-md p-4">
              <div className="space-y-2">
                {result.deleted.map((item, index) => (
                  <div key={`deleted-${index}`} className="flex items-center gap-3 p-2 border rounded">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.email}</div>
                      <div className="text-xs text-muted-foreground">ID: {item.id}</div>
                    </div>
                    <Badge variant="secondary" className="bg-red-100 text-red-800">Removido</Badge>
                  </div>
                ))}
                
                {result.errors.map((item, index) => (
                  <div key={`error-${index}`} className="flex items-center gap-3 p-2 border rounded border-destructive">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.email}</div>
                      <div className="text-xs text-destructive">{item.error}</div>
                    </div>
                    <Badge variant="destructive">Erro</Badge>
                  </div>
                ))}
                
                {result.summary.total_invalid === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Nenhum usuário com domínio inválido encontrado!</p>
                    <p className="text-sm mt-1">Todos os usuários possuem email @gruposaga.com.br</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="flex justify-end">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
