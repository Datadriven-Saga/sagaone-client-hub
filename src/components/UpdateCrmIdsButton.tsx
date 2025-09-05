import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface UpdateResult {
  cnpj: string;
  crm_id: number;
  status: 'success' | 'error' | 'not_found';
  message: string;
}

interface UpdateCrmResponse {
  total: number;
  success: number;
  errors: number;
  not_found: number;
  details: UpdateResult[];
}

export const UpdateCrmIdsButton = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCrmResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error("Você precisa estar logado para realizar esta operação");
        return;
      }

      const response = await supabase.functions.invoke('update-crm-ids', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      setUpdateResult(response.data);
      
      if (response.data.success > 0) {
        toast.success(`${response.data.success} empresas atualizadas com sucesso!`);
      }
      
      if (response.data.errors > 0 || response.data.not_found > 0) {
        toast.warning(`${response.data.errors + response.data.not_found} empresas não puderam ser atualizadas`);
      }

    } catch (error: any) {
      console.error('Erro ao atualizar CRM IDs:', error);
      toast.error('Erro ao atualizar CRM IDs: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'not_found':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'not_found':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Não encontrada</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar CRM IDs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Atualizar CRM IDs das Empresas</DialogTitle>
        </DialogHeader>
        
        {!updateResult ? (
          <div className="space-y-4">
            <p>
              Esta operação irá atualizar os CRM IDs de todas as empresas do Grupo Saga 
              baseado nos CNPJs existentes no banco de dados.
            </p>
            <Button 
              onClick={handleUpdate} 
              disabled={isUpdating}
              className="w-full"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando CRM IDs...
                </>
              ) : (
                'Iniciar Atualização'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{updateResult.total}</div>
                <div className="text-sm text-blue-800">Total</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{updateResult.success}</div>
                <div className="text-sm text-green-800">Atualizadas</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{updateResult.errors}</div>
                <div className="text-sm text-red-800">Erros</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{updateResult.not_found}</div>
                <div className="text-sm text-yellow-800">Não encontradas</div>
              </div>
            </div>

            <ScrollArea className="h-96 w-full border rounded-md p-4">
              <div className="space-y-2">
                {updateResult.details.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <div className="font-medium">{result.cnpj}</div>
                        <div className="text-sm text-gray-600">CRM ID: {result.crm_id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(result.status)}
                      <span className="text-sm text-gray-600">{result.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};