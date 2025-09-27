import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
import { format } from "date-fns";

interface ImportOptOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CsvRow {
  data_optout: string;
  nome: string;
  telefone: string;
  email: string;
  canal: string;
  empresa: string;
  linha: number;
  errors: string[];
}

interface ImportStats {
  total: number;
  valid: number;
  invalid: number;
  processed: number;
  success: number;
  failed: number;
}

const REQUIRED_HEADERS = [
  "data_optout",
  "nome", 
  "telefone",
  "email",
  "canal",
  "empresa"
];

const CANAIS_VALIDOS = ["Whatsapp", "Ligação", "SMS", "E-mail"];

export function ImportOptOutModal({ isOpen, onClose, onSuccess }: ImportOptOutModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [stats, setStats] = useState<ImportStats>({
    total: 0,
    valid: 0,
    invalid: 0,
    processed: 0,
    success: 0,
    failed: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [phase, setPhase] = useState<'upload' | 'preview' | 'processing' | 'complete'>('upload');
  const [importResults, setImportResults] = useState<string[]>([]);

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome_empresa")
        .order("nome_empresa");
      if (error) throw error;
      return data;
    },
  });

  const handleClose = () => {
    setFile(null);
    setCsvData([]);
    setStats({
      total: 0,
      valid: 0,
      invalid: 0,
      processed: 0,
      success: 0,
      failed: 0,
    });
    setPhase('upload');
    setImportResults([]);
    onClose();
  };

  const validateRow = (row: any, linha: number, empresasMap: Map<string, string>): CsvRow => {
    const errors: string[] = [];
    
    // Validate required fields
    if (!row.data_optout?.trim()) {
      errors.push("Data do opt-out é obrigatória");
    } else {
      const date = new Date(row.data_optout);
      if (isNaN(date.getTime())) {
        errors.push("Data do opt-out em formato inválido");
      }
    }

    // At least one identifier required
    if (!row.telefone?.trim() && !row.email?.trim()) {
      errors.push("Pelo menos telefone ou e-mail deve ser informado");
    }

    // Validate canal
    if (!row.canal?.trim()) {
      errors.push("Canal é obrigatório");
    } else if (!CANAIS_VALIDOS.includes(row.canal.trim())) {
      errors.push(`Canal deve ser: ${CANAIS_VALIDOS.join(", ")}`);
    }

    // Validate empresa
    if (!row.empresa?.trim()) {
      errors.push("Empresa é obrigatória");
    } else if (!empresasMap.has(row.empresa.trim())) {
      errors.push("Empresa não encontrada no sistema");
    }

    // Validate email format if provided
    if (row.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email.trim())) {
        errors.push("E-mail em formato inválido");
      }
    }

    return {
      data_optout: row.data_optout?.trim() || "",
      nome: row.nome?.trim() || "",
      telefone: row.telefone?.trim() || "",
      email: row.email?.trim() || "",
      canal: row.canal?.trim() || "",
      empresa: row.empresa?.trim() || "",
      linha,
      errors,
    };
  };

  const parseCsvFile = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error("Arquivo deve conter pelo menos cabeçalho e uma linha de dados");
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Validate headers
    const missingHeaders = REQUIRED_HEADERS.filter(required => 
      !headers.some(header => header.toLowerCase() === required.toLowerCase())
    );
    
    if (missingHeaders.length > 0) {
      throw new Error(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(', ')}`);
    }

    const empresasMap = new Map(
      empresas?.map(emp => [emp.nome_empresa, emp.id]) || []
    );

    const rows: CsvRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const rowData: any = {};
      
      headers.forEach((header, index) => {
        rowData[header.toLowerCase()] = values[index] || "";
      });

      const validatedRow = validateRow(rowData, i + 1, empresasMap);
      rows.push(validatedRow);
    }

    return rows;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Erro no arquivo",
        description: "Por favor, selecione um arquivo CSV",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);

    try {
      const content = await selectedFile.text();
      const parsedData = parseCsvFile(content);
      
      setCsvData(parsedData);
      
      const newStats = {
        total: parsedData.length,
        valid: parsedData.filter(row => row.errors.length === 0).length,
        invalid: parsedData.filter(row => row.errors.length > 0).length,
        processed: 0,
        success: 0,
        failed: 0,
      };
      setStats(newStats);
      setPhase('preview');
    } catch (error: any) {
      toast({
        title: "Erro ao processar arquivo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    const validRows = csvData.filter(row => row.errors.length === 0);
    if (validRows.length === 0) {
      toast({
        title: "Nenhuma linha válida",
        description: "Corrija os erros antes de importar",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setPhase('processing');
    
    const empresasMap = new Map(
      empresas?.map(emp => [emp.nome_empresa, emp.id]) || []
    );

    let success = 0;
    let failed = 0;
    const results: string[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      
      try {
        const insertData = {
          data_optout: new Date(row.data_optout).toISOString(),
          nome: row.nome || null,
          telefone_e164: row.telefone || null,
          email_normalizado: row.email || null,
          canal: row.canal as any,
          empresa_id: empresasMap.get(row.empresa),
          source: "IMPORT",
          dedupe_key: "", // Will be generated by trigger
        };

        const { error } = await supabase
          .from("opt_outs")
          .insert([insertData]);

        if (error) {
          if (error.code === "23505") {
            // Duplicate key - update existing
            results.push(`Linha ${row.linha}: Opt-out já existe, data atualizada`);
          } else {
            throw error;
          }
        } else {
          results.push(`Linha ${row.linha}: Importado com sucesso`);
        }
        success++;
      } catch (error: any) {
        failed++;
        results.push(`Linha ${row.linha}: Erro - ${error.message}`);
      }

      setStats(prev => ({
        ...prev,
        processed: i + 1,
        success,
        failed,
      }));
    }

    setImportResults(results);
    setPhase('complete');
    setIsProcessing(false);

    toast({
      title: "Importação concluída",
      description: `${success} registros processados com sucesso, ${failed} com erro`,
    });
  };

  const renderPhase = () => {
    switch (phase) {
      case 'upload':
        return (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="space-y-2">
                <Label htmlFor="csv-file" className="cursor-pointer">
                  <div className="text-sm font-medium">
                    Clique para selecionar um arquivo CSV
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ou arraste e solte aqui
                  </div>
                </Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Formato do CSV:</strong></p>
                  <div className="font-mono text-xs bg-muted p-2 rounded">
                    data_optout,nome,telefone,email,canal,empresa
                  </div>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    <li>Data no formato ISO (YYYY-MM-DDTHH:mm:ss)</li>
                    <li>Canal: Whatsapp, Ligação, SMS ou E-mail</li>
                    <li>Pelo menos telefone ou e-mail obrigatório</li>
                    <li>Nome da empresa deve existir no sistema</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
                <div className="text-sm text-muted-foreground">Válidas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
                <div className="text-sm text-muted-foreground">Com erro</div>
              </div>
            </div>

            {stats.invalid > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {stats.invalid} linha(s) com erro. Corrija os erros ou importe apenas as linhas válidas.
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-60 overflow-y-auto space-y-2">
              {csvData.slice(0, 10).map((row, index) => (
                <div key={index} className={`p-2 rounded border ${
                  row.errors.length > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      Linha {row.linha}: {row.nome || "Sem nome"} - {row.canal}
                    </span>
                    {row.errors.length === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  {row.errors.length > 0 && (
                    <div className="text-xs text-red-600 mt-1">
                      {row.errors.join(", ")}
                    </div>
                  )}
                </div>
              ))}
              {csvData.length > 10 && (
                <div className="text-center text-sm text-muted-foreground">
                  ... e mais {csvData.length - 10} linhas
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPhase('upload')} className="flex-1">
                Voltar
              </Button>
              <Button 
                onClick={handleImport} 
                className="flex-1"
                disabled={stats.valid === 0}
              >
                Importar {stats.valid} registro(s)
              </Button>
            </div>
          </div>
        );

      case 'processing':
        const progress = stats.total > 0 ? (stats.processed / stats.total) * 100 : 0;
        return (
          <div className="space-y-4 text-center">
            <div className="text-lg font-medium">Processando importação...</div>
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-muted-foreground">
              {stats.processed} de {stats.total} registros processados
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-green-600">{stats.success}</div>
                <div className="text-sm text-muted-foreground">Sucesso</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-sm text-muted-foreground">Falhas</div>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Importação concluída! {stats.success} registros processados com sucesso.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.success}</div>
                <div className="text-sm text-muted-foreground">Sucesso</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-sm text-muted-foreground">Falhas</div>
              </div>
            </div>

            {importResults.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Log de importação:</Label>
                <Textarea
                  value={importResults.join('\n')}
                  readOnly
                  className="max-h-40 mt-1"
                />
              </div>
            )}

            <Button onClick={onSuccess} className="w-full">
              Concluir
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Opt-outs via CSV</DialogTitle>
        </DialogHeader>

        {renderPhase()}
      </DialogContent>
    </Dialog>
  );
}