import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import * as XLSX from 'xlsx';

interface ClienteData {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  segmentacao?: string;
  responsavel?: string;
}

interface Prospeccao {
  id: string;
  titulo: string;
  descricao?: string;
}

interface UploadPlanilhaProps {
  onClientesImported: (campanha: string, clientes: ClienteData[]) => void;
  prospeccoes: Prospeccao[];
}

export const UploadPlanilha = ({ onClientesImported, prospeccoes }: UploadPlanilhaProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCampanha, setSelectedCampanha] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ClienteData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.includes('excel') || selectedFile.type.includes('spreadsheet') || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        processFile(selectedFile);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls)",
          variant: "destructive",
        });
      }
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Pega a primeira planilha
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Converte para JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Remove a primeira linha (cabeçalho) se existir
      const dataRows = jsonData.slice(1) as any[][];
      
      // Mapeia os dados para o formato esperado
      const clientesData: ClienteData[] = dataRows
        .filter(row => row && row.length > 0) // Remove linhas vazias
        .map(row => ({
          nome: row[0]?.toString().trim() || '',
          telefone: row[1]?.toString().trim() || '',
          email: row[2]?.toString().trim() || '',
          cpf: row[3]?.toString().trim() || '',
          segmentacao: row[4]?.toString().trim() || '',
          responsavel: row[5]?.toString().trim() || '',
        }))
        .filter(cliente => cliente.nome || cliente.telefone); // Remove registros completamente vazios
      
      setPreviewData(clientesData);
      setIsProcessing(false);
      
      toast({
        title: "Arquivo processado",
        description: `${clientesData.length} registros encontrados no arquivo`,
      });
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      setIsProcessing(false);
      toast({
        title: "Erro ao processar arquivo",
        description: "Verifique se o arquivo está no formato correto (Excel .xlsx ou .xls)",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    if (!selectedCampanha) {
      toast({
        title: "Selecione uma campanha",
        description: "Você deve escolher uma campanha para adicionar os contatos",
        variant: "destructive",
      });
      return;
    }

    // Validar dados obrigatórios
    const invalidRecords = previewData.filter(item => !item.nome || !item.telefone);
    
    if (invalidRecords.length > 0) {
      toast({
        title: "Dados inválidos",
        description: `${invalidRecords.length} registros não possuem Nome ou Telefone obrigatórios`,
        variant: "destructive",
      });
      return;
    }

    onClientesImported(selectedCampanha, previewData);
    setIsOpen(false);
    setSelectedCampanha('');
    setFile(null);
    setPreviewData([]);
    
    toast({
      title: "Importação concluída",
      description: `${previewData.length} contatos importados com sucesso`,
    });
  };

  const clearData = () => {
    setFile(null);
    setPreviewData([]);
    setSelectedCampanha('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="p-3 h-auto flex items-center gap-2">
          <FileSpreadsheet size={18} />
          <span className="text-sm">Upload de Planilha</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Upload de Planilha de Contatos</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Seleção de Campanha */}
          <Card className="p-4 bg-green-50 border-green-200">
            <Label className="text-green-800 font-medium">Selecione a Campanha</Label>
            <Select value={selectedCampanha} onValueChange={setSelectedCampanha}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Escolha uma campanha para adicionar os contatos..." />
              </SelectTrigger>
              <SelectContent>
                {prospeccoes.map((prospeccao) => (
                  <SelectItem key={prospeccao.id} value={prospeccao.titulo}>
                    {prospeccao.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Instruções e Upload lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            {/* Instruções */}
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-2">
                <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                <div className="text-sm">
                  <p className="font-medium text-blue-800 mb-1">Formato da planilha:</p>
                  <p className="text-blue-700">
                    • Colunas: Nome*, Telefone*, E-mail, CPF, Segmentação, Responsável (* = obrigatório)<br/>
                    • Formato: Excel (.xlsx ou .xls)<br/>
                    • Primeira linha deve conter os cabeçalhos<br/>
                    • Responsável deve ser o e-mail do responsável
                  </p>
                </div>
              </div>
            </Card>

            {/* Upload área */}
            <Card className="p-4 border-dashed border-2 border-muted flex flex-col justify-center">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <Label htmlFor="file-upload" className="cursor-pointer text-center">
                <Upload className="mx-auto mb-2 text-muted-foreground" size={24} />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar ou arraste o arquivo
                </p>
                {file && (
                  <p className="text-sm font-medium mt-2 text-primary">
                    {file.name}
                  </p>
                )}
              </Label>
            </Card>
          </div>

          {/* Preview dos dados */}
          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Processando arquivo...</p>
            </div>
          )}

          {previewData.length > 0 && !isProcessing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Preview dos dados ({previewData.length} registros)</h4>
                <Button variant="outline" size="sm" onClick={clearData}>
                  Limpar
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[200px]">Nome*</TableHead>
                        <TableHead className="w-[150px]">Telefone*</TableHead>
                        <TableHead className="w-[200px]">E-mail</TableHead>
                        <TableHead className="w-[150px]">CPF</TableHead>
                        <TableHead className="w-[150px]">Segmentação</TableHead>
                        <TableHead className="w-[200px]">Responsável</TableHead>
                        <TableHead className="w-[80px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((item, index) => {
                        const isValid = item.nome && item.telefone;
                        return (
                          <TableRow key={index}>
                            <TableCell className={!item.nome ? 'text-red-600' : ''}>{item.nome || 'OBRIGATÓRIO'}</TableCell>
                            <TableCell className={!item.telefone ? 'text-red-600' : ''}>{item.telefone || 'OBRIGATÓRIO'}</TableCell>
                            <TableCell>{item.email || '-'}</TableCell>
                            <TableCell>{item.cpf || '-'}</TableCell>
                            <TableCell>{item.segmentacao || '-'}</TableCell>
                            <TableCell>{item.responsavel || '-'}</TableCell>
                            <TableCell>
                              {isValid ? (
                                <CheckCircle className="text-green-600" size={16} />
                              ) : (
                                <AlertCircle className="text-red-600" size={16} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          {previewData.length > 0 && (
            <Button onClick={handleImport}>
              Importar Contatos
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};