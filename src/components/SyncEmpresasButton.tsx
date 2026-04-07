import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Trash2, Plus, Pencil, Upload, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeRead, XLSX } from '@/lib/xlsxSafe';

interface SyncResult {
  success: boolean;
  summary: {
    added: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  details: {
    added: Array<{ nome: string; crm_id: string; status: string }>;
    updated: Array<{ nome: string; crm_id: string; status: string }>;
    skipped: Array<{ crm_id: string; nome: string }>;
    errors: Array<{ nome?: string; crm_id?: string; error: string }>;
  };
}

interface EmpresaCSV {
  cnpj: string;
  nome: string;
  marca: string;
  uf: string;
  crm_id: string;
  cidade?: string;
}

export function SyncEmpresasButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<EmpresaCSV[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeColumnName = (name: string): string => {
    return name.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9]/g, "_")
      .trim();
  };

  const parseFile = async (file: File) => {
    setParseError(null);
    setParsedData([]);
    
    try {
      const fileName = file.name.toLowerCase();
      const isCSV = fileName.endsWith('.csv');
      
      let jsonData: Record<string, any>[] = [];

      if (isCSV) {
        // Handle CSV files manually to support different delimiters
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          setParseError("Arquivo vazio ou sem dados válidos");
          return;
        }

        // Try to detect delimiter (semicolon, comma, or tab)
        const firstLine = lines[0];
        let delimiter = ',';
        if (firstLine.includes(';')) {
          delimiter = ';';
        } else if (firstLine.includes('\t')) {
          delimiter = '\t';
        }

        // Parse headers
        const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          
          // Handle quoted values that might contain delimiters
          const values: string[] = [];
          let inQuotes = false;
          let currentValue = '';
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"' || char === "'") {
              inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
              values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
          
          const row: Record<string, any> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          jsonData.push(row);
        }
      } else {
        // Handle XLS/XLSX files with XLSX library
        const arrayBuffer = await file.arrayBuffer();
        const workbook = safeRead(arrayBuffer, { codepage: 65001 });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse to JSON with header row
        jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      }
      
      console.log('Dados brutos do arquivo:', jsonData.slice(0, 3)); // Debug log
      
      if (jsonData.length === 0) {
        setParseError("Arquivo vazio ou sem dados válidos");
        return;
      }

      // Log available columns for debugging
      if (jsonData.length > 0) {
        console.log('Colunas encontradas:', Object.keys(jsonData[0]));
      }

      // Map columns to expected format with more flexible matching
      const empresas: EmpresaCSV[] = jsonData.map((row) => {
        const normalizedRow: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
          const normalizedKey = normalizeColumnName(key);
          normalizedRow[normalizedKey] = String(value || '').trim();
        }

        // Try multiple possible column name variations
        const getCrmId = () => {
          return normalizedRow['crm_id'] || normalizedRow['crmid'] || normalizedRow['crm'] || 
                 normalizedRow['id_crm'] || normalizedRow['dealer_id'] || normalizedRow['dealerid'] ||
                 normalizedRow['cod_crm'] || normalizedRow['codigo_crm'] || normalizedRow['id'] ||
                 normalizedRow['nm_codigo_svm'] || normalizedRow['codigo_svm'] || '';
        };

        const getNome = () => {
          return normalizedRow['nome'] || normalizedRow['nome_empresa'] || normalizedRow['razao_social'] ||
                 normalizedRow['empresa'] || normalizedRow['fantasia'] || normalizedRow['nome_fantasia'] ||
                 normalizedRow['dealer'] || normalizedRow['concessionaria'] || 
                 normalizedRow['vc_empresa'] || '';
        };

        const getCnpj = () => {
          const raw = normalizedRow['cnpj'] || normalizedRow['cnpj_cpf'] || normalizedRow['documento'] ||
                 normalizedRow['cpf_cnpj'] || normalizedRow['id_cnpj'] || 
                 normalizedRow['vc_cnpj2'] || normalizedRow['cnpj2'] || '';
          // Remove non-numeric chars and format as XX.XXX.XXX/XXXX-XX
          const digits = raw.replace(/\D/g, '');
          if (digits.length === 14) {
            return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`;
          }
          return raw;
        };

        const getMarca = () => {
          return normalizedRow['marca'] || normalizedRow['bandeira'] || normalizedRow['fabricante'] ||
                 normalizedRow['montadora'] || normalizedRow['vc_marca'] || '';
        };

        const getUf = () => {
          return normalizedRow['uf'] || normalizedRow['estado'] || normalizedRow['sigla_uf'] || 
                 normalizedRow['vc_uf'] || '';
        };

        const getCidade = () => {
          return normalizedRow['cidade'] || normalizedRow['municipio'] || normalizedRow['cidade_sede'] || 
                 normalizedRow['vc_cidade'] || '';
        };

        return {
          cnpj: getCnpj(),
          nome: getNome(),
          marca: getMarca(),
          uf: getUf(),
          crm_id: getCrmId(),
          cidade: getCidade(),
        };
      }).filter(e => e.crm_id && e.nome); // Filtrar apenas registros válidos

      console.log('Empresas processadas:', empresas.slice(0, 3)); // Debug log

      if (empresas.length === 0) {
        const availableCols = jsonData.length > 0 ? Object.keys(jsonData[0]).join(', ') : 'nenhuma';
        setParseError(`Nenhum registro válido encontrado. Colunas no arquivo: ${availableCols}. Necessário ter ao menos: crm_id (ou id) e nome (ou empresa).`);
        return;
      }

      setParsedData(empresas);
      toast.success(`${empresas.length} empresas encontradas no arquivo`);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      setParseError(`Erro ao processar arquivo: ${(error as Error).message}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    await parseFile(file);
  };

  const handleSync = async () => {
    if (parsedData.length === 0) {
      toast.error("Nenhum dado válido para sincronizar");
      return;
    }

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
        body: {
          empresas: parsedData,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setSyncResult(data as SyncResult);
      
      if (data.success) {
        toast.success(
          `Sincronização concluída! ${data.summary.added} adicionadas, ${data.summary.updated} atualizadas, ${data.summary.skipped} ignoradas`
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
    setSelectedFile(null);
    setParsedData([]);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      await parseFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sincronizar Empresas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Sincronizar Empresas</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo (CSV, XLS ou XLSX) para sincronizar as empresas.
          </DialogDescription>
        </DialogHeader>

        {!syncResult ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Scrollable content area */}
            <ScrollArea className="flex-1 pr-4">
              <div className="flex flex-col gap-4 pb-2">
                {/* Upload Area */}
                <div 
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Arraste um arquivo aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: CSV, XLS, XLSX
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Colunas esperadas: <strong>vc_empresa</strong>, <strong>vc_marca</strong>, <strong>vc_uf</strong>, <strong>nm_codigo_svm</strong>, <strong>vc_cnpj2</strong>, vc_cidade
                  </p>
                </div>

                {/* Selected File Info */}
                {selectedFile && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    {parsedData.length > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 flex-shrink-0">
                        {parsedData.length} empresas
                      </Badge>
                    )}
                  </div>
                )}

                {/* Parse Error */}
                {parseError && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                    <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{parseError}</p>
                  </div>
                )}

                {/* Preview Table */}
                {parsedData.length > 0 && (
                  <div className="space-y-2">
                    <Label>Pré-visualização ({Math.min(5, parsedData.length)} de {parsedData.length})</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-xs">CRM ID</th>
                            <th className="px-3 py-2 text-left font-medium text-xs">Nome</th>
                            <th className="px-3 py-2 text-left font-medium text-xs">CNPJ</th>
                            <th className="px-3 py-2 text-left font-medium text-xs">Marca</th>
                            <th className="px-3 py-2 text-left font-medium text-xs">UF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedData.slice(0, 5).map((empresa, index) => (
                            <tr key={index} className="border-t">
                              <td className="px-3 py-2 text-xs">{empresa.crm_id}</td>
                              <td className="px-3 py-2 text-xs truncate max-w-[120px]">{empresa.nome}</td>
                              <td className="px-3 py-2 text-xs">{empresa.cnpj}</td>
                              <td className="px-3 py-2 text-xs">{empresa.marca}</td>
                              <td className="px-3 py-2 text-xs">{empresa.uf}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Info */}
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <p className="font-medium mb-1 text-xs">Campos obrigatórios: vc_empresa (nome), nm_codigo_svm (CRM ID)</p>
                  <p className="font-medium mb-1 text-xs mt-2">Esta operação irá:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    <li><span className="text-green-600 font-medium">Adicionar</span> empresas que estão no arquivo mas não no banco</li>
                    <li><span className="text-blue-600 font-medium">Atualizar</span> dados de empresas existentes (match por CRM ID ou CNPJ)</li>
                    <li>Empresas no banco que não estão no arquivo serão <strong>mantidas</strong> (nunca removidas)</li>
                  </ul>
                </div>
              </div>
            </ScrollArea>
            
            {/* Fixed footer with buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t mt-4 flex-shrink-0">
              <Button
                variant="outline"
                onClick={handleClose}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSync}
                disabled={isSyncing || parsedData.length === 0}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Sincronizar ({parsedData.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Summary - Fixed at top */}
            {syncResult.success && (
              <div className="p-3 bg-muted rounded-lg flex-shrink-0 mb-4">
                <h4 className="font-semibold mb-2 text-sm">Resultado da Sincronização:</h4>
                <div className="flex gap-4 text-sm flex-wrap">
                  <span className="text-green-600 flex items-center gap-1">
                    <Plus className="h-4 w-4" /> {syncResult.summary.added} adicionadas
                  </span>
                  <span className="text-blue-600 flex items-center gap-1">
                    <Pencil className="h-4 w-4" /> {syncResult.summary.updated} atualizadas
                  </span>
                  {syncResult.summary.skipped > 0 && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      {syncResult.summary.skipped} ignoradas (não estão no CSV)
                    </span>
                  )}
                  {syncResult.summary.errors > 0 && (
                    <span className="text-yellow-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> {syncResult.summary.errors} erros
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable results list */}
            <ScrollArea className="flex-1 min-h-0 border rounded-md">
              <div className="p-4 space-y-2">
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
                
                {/* Skipped (not in CSV) */}
                {syncResult.details.skipped.map((item, index) => (
                  <div key={`skipped-${index}`} className="flex items-center gap-3 p-2 border rounded opacity-60">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.nome}</div>
                      <div className="text-xs text-muted-foreground">CRM ID: {item.crm_id} — não consta no CSV (mantida)</div>
                    </div>
                    <Badge variant="outline">Ignorada</Badge>
                  </div>
                ))}
                
                {/* Errors */}
                {syncResult.details.errors.map((item, index) => (
                  <div key={`error-${index}`} className="flex items-center gap-3 p-2 border rounded border-destructive">
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.nome || 'Desconhecido'}</div>
                      <div className="text-xs text-destructive">{item.error}</div>
                    </div>
                    <Badge variant="destructive" className="flex-shrink-0">Erro</Badge>
                  </div>
                ))}
                
                {syncResult.details.added.length === 0 && 
                 syncResult.details.updated.length === 0 && 
                 syncResult.details.skipped.length === 0 && 
                 syncResult.details.errors.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Nenhuma alteração necessária. Banco já está sincronizado!</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Fixed footer with button */}
            <div className="flex justify-end pt-4 border-t mt-4 flex-shrink-0">
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
