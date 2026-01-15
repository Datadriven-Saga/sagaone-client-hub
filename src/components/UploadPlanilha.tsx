import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import * as XLSX from 'xlsx';

interface ClienteData {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  segmentacao?: string;
  responsavel?: string;
  origem?: string;
  base_id?: string;
}

interface Prospeccao {
  id: string;
  titulo: string;
  descricao?: string;
  data_fim?: string | null;
}

interface OrigemOption {
  id: string;
  nome: string;
}

interface UploadPlanilhaProps {
  onClientesImported: (campanha: string, clientes: ClienteData[]) => void;
  prospeccoes: Prospeccao[];
}

export const UploadPlanilha = ({ onClientesImported, prospeccoes }: UploadPlanilhaProps) => {
  const { activeCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCampanha, setSelectedCampanha] = useState<string>('');
  const [selectedOrigem, setSelectedOrigem] = useState<string>('');
  const [nomeBase, setNomeBase] = useState<string>('');
  const [origens, setOrigens] = useState<OrigemOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ClienteData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Buscar origens quando abrir o modal
  useEffect(() => {
    const fetchOrigens = async () => {
      if (!isOpen || !activeCompany?.id) return;
      
      const { data, error } = await supabase
        .from('origens_lead')
        .select('id, nome')
        .eq('empresa_id', activeCompany.id)
        .eq('ativo', true)
        .order('ordem');
      
      if (!error && data) {
        setOrigens(data);
      }
    };
    
    fetchOrigens();
  }, [isOpen, activeCompany?.id]);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const isExcel = selectedFile.type.includes('excel') || selectedFile.type.includes('spreadsheet') || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
      const isCsv = selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv');
      
      if (isExcel || isCsv) {
        setFile(selectedFile);
        processFile(selectedFile);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv)",
          variant: "destructive",
        });
      }
    }
  };

  // Normaliza nome de coluna para comparação (lowercase, sem acentos, sem espaços extras)
  const normalizeColumnName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Mapeia nomes de colunas possíveis para os campos esperados (evitar termos genéricos que causam inversão)
  const columnMappings: Record<string, string[]> = {
    // "cliente" é genérico e estava causando match indevido (ex.: "Telefone do Cliente")
    nome: ['nome', 'name', 'nome completo', 'nome do cliente'],
    // "numero" é genérico e também pode causar match indevido
    telefone: ['telefone', 'phone', 'celular', 'cel', 'whatsapp', 'fone', 'tel'],
    email: ['email', 'e-mail', 'mail'],
    cpf: ['cpf', 'cpf/cnpj', 'documento'],
    segmentacao: ['segmentacao', 'segmento', 'categoria', 'tipo', 'grupo'],
    responsavel: ['responsavel', 'vendedor', 'atendente', 'consultor', 'responsavel email'],
  };

  const tokenize = (value: string) =>
    normalizeColumnName(value)
      .split(/[^a-z0-9]+/g)
      .filter(Boolean);

  // Match mais estrito: prioriza igualdade / palavras completas (evita "includes" solto)
  const headerMatches = (header: string, candidate: string) => {
    const h = normalizeColumnName(header);
    const c = normalizeColumnName(candidate);

    if (!h || !c) return false;
    if (h === c) return true;

    const headerTokens = new Set(tokenize(h));
    const candidateTokens = tokenize(c);

    // Ex.: "nome completo" exige as duas palavras
    if (candidateTokens.length > 0 && candidateTokens.every(t => headerTokens.has(t))) return true;

    // fallback: começa com (ex.: "telefone" em "telefone1")
    return candidateTokens.length === 1 && h.startsWith(candidateTokens[0]);
  };

  // Encontra o índice da coluna baseado no nome do cabeçalho
  const findColumnIndex = (headers: string[], fieldName: string): number => {
    const possibleNames = columnMappings[fieldName] || [fieldName];

    // 1) tentar match exato / por tokens (mais confiável)
    for (let i = 0; i < headers.length; i++) {
      if (possibleNames.some(name => headerMatches(headers[i] || '', name))) return i;
    }

    // 2) fallback bem conservador: contains com separador (" telefone ")
    for (let i = 0; i < headers.length; i++) {
      const h = ` ${normalizeColumnName(headers[i] || '')} `;
      if (possibleNames.some(name => h.includes(` ${normalizeColumnName(name)} `))) return i;
    }

    return -1;
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Pega a primeira planilha
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Converte para JSON com a primeira linha como cabeçalho
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados suficientes",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Pega o cabeçalho (primeira linha) e as linhas de dados
      const headers = (jsonData[0] as any[]).map(h => h?.toString() || '');
      const dataRows = jsonData.slice(1) as any[][];

      // Encontra os índices das colunas pelo nome do cabeçalho
      const columnIndices = {
        nome: findColumnIndex(headers, 'nome'),
        telefone: findColumnIndex(headers, 'telefone'),
        email: findColumnIndex(headers, 'email'),
        cpf: findColumnIndex(headers, 'cpf'),
        segmentacao: findColumnIndex(headers, 'segmentacao'),
        responsavel: findColumnIndex(headers, 'responsavel'),
      };

      console.log('Cabeçalhos encontrados:', headers);
      console.log('Mapeamento de colunas:', columnIndices);

      // Verifica se as colunas obrigatórias foram encontradas
      // (evita inversão por planilhas sem cabeçalho/colunas mal nomeadas)
      if (columnIndices.nome === -1 || columnIndices.telefone === -1) {
        toast({
          title: "Colunas obrigatórias não encontradas",
          description: "Não foi possível identificar claramente as colunas 'Nome' e 'Telefone' no cabeçalho. Verifique a primeira linha da planilha.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }
      
      // Mapeia os dados para o formato esperado usando os índices das colunas
      const clientesData: ClienteData[] = dataRows
        .filter(row => row && row.length > 0)
        .map(row => ({
          nome: columnIndices.nome >= 0 ? row[columnIndices.nome]?.toString().trim() || '' : '',
          telefone: columnIndices.telefone >= 0 ? row[columnIndices.telefone]?.toString().trim() || '' : '',
          email: columnIndices.email >= 0 ? row[columnIndices.email]?.toString().trim() || '' : '',
          cpf: columnIndices.cpf >= 0 ? row[columnIndices.cpf]?.toString().trim() || '' : '',
          segmentacao: columnIndices.segmentacao >= 0 ? row[columnIndices.segmentacao]?.toString().trim() || '' : '',
          responsavel: columnIndices.responsavel >= 0 ? row[columnIndices.responsavel]?.toString().trim() || '' : '',
        }))
        .filter(cliente => cliente.nome || cliente.telefone);
      
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
        description: "Verifique se o arquivo está no formato correto (.csv, .xlsx ou .xls)",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!selectedCampanha) {
      toast({
        title: "Selecione uma campanha",
        description: "Você deve escolher uma campanha para adicionar os contatos",
        variant: "destructive",
      });
      return;
    }

    if (!nomeBase.trim()) {
      toast({
        title: "Nome da base obrigatório",
        description: "Por favor, informe um nome para identificar esta base de contatos",
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

    setIsProcessing(true);

    try {
      // Criar registro da base importada
      const { data: baseData, error: baseError } = await supabase
        .from('bases_importadas')
        .insert({
          nome: nomeBase.trim(),
          empresa_id: activeCompany?.id,
          total_contatos: previewData.length
        })
        .select()
        .single();

      if (baseError) {
        console.error('Erro ao criar base:', baseError);
        throw baseError;
      }

      console.log('✅ Base criada:', baseData);

      // Adicionar origem e base_id aos clientes
      const clientesComDados = previewData.map(c => ({ 
        ...c, 
        origem: selectedOrigem || undefined,
        base_id: baseData.id
      }));
      
      onClientesImported(selectedCampanha, clientesComDados);
      setIsOpen(false);
      setSelectedCampanha('');
      setSelectedOrigem('');
      setNomeBase('');
      setFile(null);
      setPreviewData([]);
      
      toast({
        title: "Importação concluída",
        description: `${previewData.length} contatos importados na base "${nomeBase}"`,
      });
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível criar a base de contatos",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearData = () => {
    setFile(null);
    setPreviewData([]);
    setSelectedCampanha('');
    setSelectedOrigem('');
    setNomeBase('');
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
                  {prospeccoes
                    .filter((p) => !p.data_fim || new Date(p.data_fim) >= new Date(new Date().toDateString()))
                    .map((prospeccao) => (
                      <SelectItem key={prospeccao.id} value={prospeccao.id}>
                        {prospeccao.titulo}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Nome da Base */}
          <Card className="p-4 bg-orange-50 border-orange-200">
            <Label className="text-orange-800 font-medium">Nome da Base *</Label>
            <Input
              className="mt-2"
              placeholder="Ex: Base Janeiro 2026, Clientes VIP, etc."
              value={nomeBase}
              onChange={(e) => setNomeBase(e.target.value)}
            />
            <p className="text-xs text-orange-600 mt-1">
              Este nome ajuda a identificar a base para reutilização futura
            </p>
          </Card>

          {/* Seleção de Origem */}
          <Card className="p-4 bg-purple-50 border-purple-200">
            <Label className="text-purple-800 font-medium">Selecione a Origem (opcional)</Label>
            <Select value={selectedOrigem} onValueChange={setSelectedOrigem}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Escolha a origem dos contatos..." />
              </SelectTrigger>
              <SelectContent>
                {origens.map((origem) => (
                  <SelectItem key={origem.id} value={origem.nome}>
                    {origem.nome}
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
                    • Formato: CSV (.csv) ou Excel (.xlsx, .xls)<br/>
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
                accept=".xlsx,.xls,.csv"
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