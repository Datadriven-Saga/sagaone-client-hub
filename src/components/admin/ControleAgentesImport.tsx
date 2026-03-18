import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx-js-style";

interface ImportRow {
  nome_agente: string;
  tipo_agente: string;
  marca: string;
  uf: string;
  loja: string;
  cnpj: string;
  responsavel?: string;
  implantador?: string;
  telefone_toca?: string;
  cronograma?: string;
  status?: string;
  chamado?: string;
  observacoes?: string;
  descricao?: string;
  numero_telefone?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ControleAgentesImport({ open, onOpenChange, onImportComplete }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrors([]);
    setPreviewData([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

      const mappedData: ImportRow[] = [];
      const validationErrors: string[] = [];

      jsonData.forEach((row, index) => {
        const rowNum = index + 2; // +2 because Excel starts at 1 and has header

        // Map common column name variations
        const nomeAgente = row["Nome Agente"] || row["nome_agente"] || row["Agente"] || row["AGENTE"] || "";
        const tipoAgente = row["Tipo"] || row["tipo_agente"] || row["TIPO"] || "";
        const marca = row["Marca"] || row["marca"] || row["MARCA"] || "";
        const uf = row["UF"] || row["uf"] || row["Estado"] || "";
        const loja = row["Loja"] || row["loja"] || row["LOJA"] || "";
        const cnpj = row["CNPJ"] || row["cnpj"] || "";

        // Validate required fields
        if (!nomeAgente) validationErrors.push(`Linha ${rowNum}: Nome do Agente é obrigatório`);
        if (!tipoAgente) validationErrors.push(`Linha ${rowNum}: Tipo é obrigatório`);
        if (!marca) validationErrors.push(`Linha ${rowNum}: Marca é obrigatória`);
        if (!uf) validationErrors.push(`Linha ${rowNum}: UF é obrigatório`);
        if (!loja) validationErrors.push(`Linha ${rowNum}: Loja é obrigatória`);
        if (!cnpj) validationErrors.push(`Linha ${rowNum}: CNPJ é obrigatório`);

        mappedData.push({
          nome_agente: String(nomeAgente).trim(),
          tipo_agente: String(tipoAgente).trim(),
          marca: String(marca).trim(),
          uf: String(uf).trim().toUpperCase(),
          loja: String(loja).trim(),
          cnpj: String(cnpj).trim(),
          responsavel: row["Responsável"] || row["responsavel"] || row["RESPONSÁVEL"] || undefined,
          implantador: row["Implantador"] || row["implantador"] || row["IMPLANTADOR"] || undefined,
          telefone_toca: row["Telefone Toca"] || row["telefone_toca"] || row["TELEFONE"] || undefined,
          cronograma: row["Cronograma"] || row["cronograma"] || row["CRONOGRAMA"] || undefined,
          status: row["Status"] || row["status"] || row["STATUS"] || undefined,
          chamado: row["Chamado"] || row["chamado"] || row["CHAMADO"] || undefined,
          observacoes: row["Observações"] || row["observacoes"] || row["OBS"] || undefined,
          descricao: row["Descrição"] || row["descricao"] || row["DESCRIÇÃO"] || undefined,
          numero_telefone: row["Número Telefone"] || row["numero_telefone"] || row["Número"] || undefined,
        });
      });

      setPreviewData(mappedData);
      setErrors(validationErrors);

      if (mappedData.length === 0) {
        setErrors(["Nenhum registro encontrado no arquivo"]);
      }
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      setErrors(["Erro ao processar o arquivo. Verifique se o formato está correto."]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;

    setImporting(true);
    try {
      const recordsToInsert = previewData.map(row => ({
        nome_agente: row.nome_agente,
        tipo_agente: row.tipo_agente,
        marca: row.marca,
        uf: row.uf,
        loja: row.loja,
        cnpj: row.cnpj,
        responsavel: row.responsavel || null,
        implantador: row.implantador || null,
        telefone_toca: row.telefone_toca || null,
        cronograma: row.cronograma || null,
        status: row.status || null,
        chamado: row.chamado || null,
        observacoes: row.observacoes || null,
        descricao: row.descricao || null,
        numero_telefone: row.numero_telefone || null,
        created_by: user?.id
      }));

      const { error } = await supabase
        .from("controle_agentes")
        .insert(recordsToInsert);

      if (error) throw error;

      toast({
        title: "Importação concluída!",
        description: `${recordsToInsert.length} registros importados com sucesso.`
      });

      onImportComplete();
      handleReset();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível importar os registros. Verifique se não há duplicatas.",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setPreviewData([]);
    setFileName(null);
    setErrors([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Agentes
          </DialogTitle>
          <DialogDescription>
            Importe registros de uma planilha (CSV, XLS ou XLSX)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* File Upload */}
          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".csv,.xls,.xlsx"
              className="hidden"
            />
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar Arquivo
              </Button>
              
              {fileName && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{fileName}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReset}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              A planilha deve conter as colunas: Nome Agente, Tipo, Marca, UF, Loja, CNPJ (obrigatórios).
              Colunas opcionais: Responsável, Implantador, Telefone Toca, Cronograma, Status, Chamado, Observações, Descrição, Número Telefone.
            </p>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="p-3 border border-destructive/50 bg-destructive/10 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">Erros encontrados:</span>
              </div>
              <ul className="text-sm text-destructive space-y-1 ml-6">
                {errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {errors.length > 5 && (
                  <li>...e mais {errors.length - 5} erros</li>
                )}
              </ul>
            </div>
          )}

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="flex-1 min-h-0">
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Prévia: {previewData.length} registros
                </Label>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.nome_agente}</TableCell>
                        <TableCell>{row.tipo_agente}</TableCell>
                        <TableCell>{row.marca}</TableCell>
                        <TableCell>{row.uf}</TableCell>
                        <TableCell>{row.loja}</TableCell>
                        <TableCell className="text-xs font-mono">{row.cnpj}</TableCell>
                        <TableCell>{row.responsavel || "-"}</TableCell>
                        <TableCell>{row.status || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {previewData.length > 50 && (
                  <div className="text-center py-3 text-sm text-muted-foreground">
                    ...e mais {previewData.length - 50} registros
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || previewData.length === 0 || errors.length > 0}
          >
            {importing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importar {previewData.length} registros
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
