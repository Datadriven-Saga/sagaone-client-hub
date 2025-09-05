import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportResult {
  success: number;
  errors: number;
  details: Array<{
    cnpj: string;
    nome: string;
    status: 'success' | 'error' | 'skipped';
    reason?: string;
  }>;
}

export function ImportEmpresasButton() {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para importar empresas");
        return;
      }

      const response = await fetch(`https://karcxgnfiymlrkbzhewo.supabase.co/functions/v1/import-empresas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ empresas: [] })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro na importação');
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      
      toast.success(`Importação concluída! ${result.success} empresas importadas com sucesso`);
      if (result.errors > 0) {
        toast.warning(`${result.errors} empresas tiveram erro na importação`);
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao importar empresas: ' + (error as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'skipped':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pulado</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Importar Lista Saga
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Importar Empresas do Grupo Saga</DialogTitle>
          <DialogDescription>
            Esta ação irá importar automaticamente todas as empresas da lista do Grupo Saga.
            {importResult && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Resultado da Importação:</h4>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">✓ {importResult.success} sucessos</span>
                  <span className="text-red-600">✗ {importResult.errors} erros</span>
                  <span className="text-yellow-600">⚠ {importResult.details.filter(d => d.status === 'skipped').length} pulados</span>
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {!importResult ? (
          <div className="flex flex-col gap-4">
            <div className="text-sm text-muted-foreground">
              <p>Esta operação irá:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Importar 107 empresas do Grupo Saga</li>
                <li>Pular empresas que já existem (baseado no CNPJ)</li>
                <li>Validar cada empresa individualmente</li>
                <li>Continuar a importação mesmo se houver erros</li>
              </ul>
            </div>
            
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting ? "Importando..." : "Iniciar Importação"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ScrollArea className="h-[400px] w-full border rounded-md p-4">
              <div className="space-y-2">
                {importResult.details.map((detail, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 border rounded">
                    {getStatusIcon(detail.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {detail.nome}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        CNPJ: {detail.cnpj}
                        {detail.reason && ` - ${detail.reason}`}
                      </div>
                    </div>
                    {getStatusBadge(detail.status)}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex justify-end">
              <Button onClick={() => setDialogOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}