import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import * as XLSX from 'xlsx';
import { 
  validateAndNormalizePhone, 
  PhoneValidationResult,
  PhoneErrorCode 
} from '@/lib/phoneUtils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ClienteData {
  nome: string;
  telefone: string;
  telefoneOriginal?: string;
  telefoneFormatado?: string;
  email?: string;
  cpf?: string;
  segmentacao?: string;
  responsavel?: string;
  origem?: string;
  base_id?: string;
  validationError?: string;
  validationErrorCode?: PhoneErrorCode;
}

interface Prospeccao {
  id: string;
  titulo: string;
  descricao?: string;
  data_fim?: string | null;
  canal?: string;
  event_id_pri?: string | null;
}

interface OrigemOption {
  id: string;
  nome: string;
}

interface UploadPlanilhaProps {
  onClientesImported: (campanha: string, clientes: ClienteData[]) => void;
  prospeccoes: Prospeccao[];
}

interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
}

const ERROR_LABELS: Record<PhoneErrorCode, string> = {
  EMPTY: 'Vazio',
  INVALID_CHARACTERS: 'Caracteres inválidos',
  WRONG_LENGTH: 'Qtd. dígitos errada',
  INVALID_DDD: 'DDD inválido',
  NOT_MOBILE: 'Não é celular',
  REPEATED_DIGITS: 'Dígitos repetidos',
  INVALID_FORMAT: 'Formato inválido'
};

export const UploadPlanilha = ({ onClientesImported, prospeccoes }: UploadPlanilhaProps) => {
  const { activeCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCampanha, setSelectedCampanha] = useState<string>('');
  const [selectedOrigem, setSelectedOrigem] = useState<string>('');
  const [nomeBase, setNomeBase] = useState<string>('');
  const [origens, setOrigens] = useState<OrigemOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ClienteData[]>([]);
  const [invalidData, setInvalidData] = useState<ClienteData[]>([]);
  const [duplicateData, setDuplicateData] = useState<ClienteData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [activeTab, setActiveTab] = useState('valid');
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

  // Mapeia nomes de colunas possíveis para os campos esperados
  const columnMappings: Record<string, string[]> = {
    nome: ['nome', 'name', 'nome completo', 'nome do cliente'],
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

  const headerMatches = (header: string, candidate: string) => {
    const h = normalizeColumnName(header);
    const c = normalizeColumnName(candidate);

    if (!h || !c) return false;
    if (h === c) return true;

    const headerTokens = new Set(tokenize(h));
    const candidateTokens = tokenize(c);

    if (candidateTokens.length > 0 && candidateTokens.every(t => headerTokens.has(t))) return true;

    return candidateTokens.length === 1 && h.startsWith(candidateTokens[0]);
  };

  const findColumnIndex = (headers: string[], fieldName: string): number => {
    const possibleNames = columnMappings[fieldName] || [fieldName];

    for (let i = 0; i < headers.length; i++) {
      if (possibleNames.some(name => headerMatches(headers[i] || '', name))) return i;
    }

    for (let i = 0; i < headers.length; i++) {
      const h = ` ${normalizeColumnName(headers[i] || '')} `;
      if (possibleNames.some(name => h.includes(` ${normalizeColumnName(name)} `))) return i;
    }

    return -1;
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setInvalidData([]);
    setDuplicateData([]);
    setValidationSummary(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
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

      const headers = (jsonData[0] as any[]).map(h => h?.toString() || '');
      const dataRows = jsonData.slice(1) as any[][];

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

      if (columnIndices.nome === -1 || columnIndices.telefone === -1) {
        toast({
          title: "Colunas obrigatórias não encontradas",
          description: "Não foi possível identificar claramente as colunas 'Nome' e 'Telefone' no cabeçalho.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }
      
      // Processar e validar cada linha
      const validClientes: ClienteData[] = [];
      const invalidClientes: ClienteData[] = [];
      const duplicateClientes: ClienteData[] = [];
      const seenPhones = new Map<string, number>(); // normalized -> index
      
      dataRows
        .filter(row => row && row.length > 0)
        .forEach((row, index) => {
          const nome = columnIndices.nome >= 0 ? row[columnIndices.nome]?.toString().trim() || '' : '';
          const telefoneOriginal = columnIndices.telefone >= 0 ? row[columnIndices.telefone]?.toString().trim() || '' : '';
          
          // Validar telefone usando a biblioteca centralizada
          const phoneValidation = validateAndNormalizePhone(telefoneOriginal);
          
          const clienteBase: ClienteData = {
            nome,
            telefone: phoneValidation.normalized || '',
            telefoneOriginal,
            telefoneFormatado: phoneValidation.formatted || undefined,
            email: columnIndices.email >= 0 ? row[columnIndices.email]?.toString().trim() || '' : '',
            cpf: columnIndices.cpf >= 0 ? row[columnIndices.cpf]?.toString().trim() || '' : '',
            segmentacao: columnIndices.segmentacao >= 0 ? row[columnIndices.segmentacao]?.toString().trim() || '' : '',
            responsavel: columnIndices.responsavel >= 0 ? row[columnIndices.responsavel]?.toString().trim() || '' : '',
          };
          
          // Validação de nome obrigatório
          if (!nome) {
            invalidClientes.push({
              ...clienteBase,
              validationError: 'Nome é obrigatório',
              validationErrorCode: 'EMPTY' as PhoneErrorCode
            });
            return;
          }
          
          // Validação de telefone
          if (!phoneValidation.isValid) {
            invalidClientes.push({
              ...clienteBase,
              validationError: phoneValidation.errorMessage || 'Telefone inválido',
              validationErrorCode: phoneValidation.errorCode || undefined
            });
            return;
          }
          
          // Verificar duplicata dentro do lote
          const normalized = phoneValidation.normalized!;
          if (seenPhones.has(normalized)) {
            duplicateClientes.push({
              ...clienteBase,
              validationError: `Duplicado da linha ${seenPhones.get(normalized)! + 2}`
            });
            return;
          }
          
          seenPhones.set(normalized, index);
          
          // Usar o telefone formatado para armazenamento
          validClientes.push({
            ...clienteBase,
            telefone: phoneValidation.formatted! // Formato padrão (XX) 9 XXXX-XXXX
          });
        });
      
      setPreviewData(validClientes);
      setInvalidData(invalidClientes);
      setDuplicateData(duplicateClientes);
      setValidationSummary({
        total: validClientes.length + invalidClientes.length + duplicateClientes.length,
        valid: validClientes.length,
        invalid: invalidClientes.length,
        duplicates: duplicateClientes.length
      });
      
      setIsProcessing(false);
      
      if (invalidClientes.length > 0 || duplicateClientes.length > 0) {
        toast({
          title: "Arquivo processado com ressalvas",
          description: `${validClientes.length} válidos, ${invalidClientes.length} inválidos, ${duplicateClientes.length} duplicados`,
          variant: "default",
        });
        setActiveTab(invalidClientes.length > 0 ? 'invalid' : 'duplicates');
      } else {
        toast({
          title: "Arquivo processado",
          description: `${validClientes.length} registros válidos encontrados`,
        });
        setActiveTab('valid');
      }
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

    if (previewData.length === 0) {
      toast({
        title: "Nenhum contato válido",
        description: "Não há contatos válidos para importar. Corrija os erros e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    const baseNomeFinal = nomeBase.trim() || `Importação ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    setIsProcessing(true);

    const selectedProspeccao = prospeccoes.find(p => p.id === selectedCampanha);
    const isLigacaoEvent = selectedProspeccao?.canal === 'Ligação';

    try {
      // Criar registro da base importada
      const { data: baseData, error: baseError } = await supabase
        .from('bases_importadas')
        .insert({
          nome: baseNomeFinal,
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

      // Adicionar origem e base_id aos clientes (somente os válidos)
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
      setInvalidData([]);
      setDuplicateData([]);
      setValidationSummary(null);
      
      const rejectedCount = (validationSummary?.invalid || 0) + (validationSummary?.duplicates || 0);
      
      toast({
        title: "Importação concluída",
        description: `${previewData.length} contatos importados.${rejectedCount > 0 ? ` (${rejectedCount} rejeitados)` : ''}${isLigacaoEvent ? ' Use o botão "Disparar" para iniciar as ligações.' : ''}`,
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
    setInvalidData([]);
    setDuplicateData([]);
    setSelectedCampanha('');
    setSelectedOrigem('');
    setNomeBase('');
    setValidationSummary(null);
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
      
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Upload de Planilha de Contatos</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
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

          {/* Nome da Base e Origem lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-orange-50 border-orange-200">
              <Label className="text-orange-800 font-medium">Nome da Base (opcional)</Label>
              <Input
                className="mt-2"
                placeholder="Ex: Base Janeiro 2026, Clientes VIP..."
                value={nomeBase}
                onChange={(e) => setNomeBase(e.target.value)}
              />
            </Card>

            <Card className="p-4 bg-purple-50 border-purple-200">
              <Label className="text-purple-800 font-medium">Origem (opcional)</Label>
              <Select value={selectedOrigem} onValueChange={setSelectedOrigem}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Escolha a origem..." />
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
          </div>

          {/* Instruções e Upload lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-2">
                <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                <div className="text-sm">
                  <p className="font-medium text-blue-800 mb-1">Regras de Validação:</p>
                  <p className="text-blue-700">
                    • Telefone: formato brasileiro (11 dígitos após DDD)<br/>
                    • Apenas celulares (deve iniciar com 9)<br/>
                    • DDD válido do Brasil<br/>
                    • Números repetidos são rejeitados (ex: 99999999999)<br/>
                    • Duplicatas dentro do lote são ignoradas
                  </p>
                </div>
              </div>
            </Card>

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

          {/* Processing indicator */}
          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Processando e validando arquivo...</p>
            </div>
          )}

          {/* Resumo de validação */}
          {validationSummary && !isProcessing && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Resultado da Validação</h4>
                <Button variant="outline" size="sm" onClick={clearData}>
                  Limpar
                </Button>
              </div>
              
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{validationSummary.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-700">{validationSummary.valid}</div>
                  <div className="text-xs text-green-600">Válidos</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-700">{validationSummary.invalid}</div>
                  <div className="text-xs text-red-600">Inválidos</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-2xl font-bold text-yellow-700">{validationSummary.duplicates}</div>
                  <div className="text-xs text-yellow-600">Duplicados</div>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="valid" className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-600" />
                    Válidos ({previewData.length})
                  </TabsTrigger>
                  <TabsTrigger value="invalid" className="flex items-center gap-2">
                    <XCircle size={14} className="text-red-600" />
                    Inválidos ({invalidData.length})
                  </TabsTrigger>
                  <TabsTrigger value="duplicates" className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-yellow-600" />
                    Duplicados ({duplicateData.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="valid" className="mt-4">
                  <ScrollArea className="h-[280px] border rounded-lg">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[180px]">Nome</TableHead>
                          <TableHead className="w-[160px]">Telefone Formatado</TableHead>
                          <TableHead className="w-[180px]">E-mail</TableHead>
                          <TableHead className="w-[120px]">CPF</TableHead>
                          <TableHead className="w-[60px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.nome}</TableCell>
                            <TableCell className="font-mono text-sm">{item.telefone}</TableCell>
                            <TableCell>{item.email || '-'}</TableCell>
                            <TableCell>{item.cpf || '-'}</TableCell>
                            <TableCell>
                              <CheckCircle className="text-green-600" size={16} />
                            </TableCell>
                          </TableRow>
                        ))}
                        {previewData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Nenhum contato válido encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="invalid" className="mt-4">
                  <ScrollArea className="h-[280px] border rounded-lg">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[180px]">Nome</TableHead>
                          <TableHead className="w-[160px]">Telefone Original</TableHead>
                          <TableHead className="w-[120px]">Tipo Erro</TableHead>
                          <TableHead>Motivo da Rejeição</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invalidData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className={!item.nome ? 'text-red-600' : ''}>
                              {item.nome || '(vazio)'}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-red-600">
                              {item.telefoneOriginal || '(vazio)'}
                            </TableCell>
                            <TableCell>
                              {item.validationErrorCode && (
                                <Badge variant="destructive" className="text-xs">
                                  {ERROR_LABELS[item.validationErrorCode] || item.validationErrorCode}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-red-600 text-sm">
                              {item.validationError}
                            </TableCell>
                          </TableRow>
                        ))}
                        {invalidData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Nenhum erro de validação
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="duplicates" className="mt-4">
                  <ScrollArea className="h-[280px] border rounded-lg">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[180px]">Nome</TableHead>
                          <TableHead className="w-[160px]">Telefone</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {duplicateData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.nome}</TableCell>
                            <TableCell className="font-mono text-sm text-yellow-600">
                              {item.telefoneOriginal}
                            </TableCell>
                            <TableCell className="text-yellow-600 text-sm">
                              {item.validationError}
                            </TableCell>
                          </TableRow>
                        ))}
                        {duplicateData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                              Nenhuma duplicata encontrada
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </Card>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {validationSummary && previewData.length > 0 && (
              <span className="text-green-700 font-medium">
                ✓ {previewData.length} contatos serão importados
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            {previewData.length > 0 && (
              <Button onClick={handleImport} disabled={isProcessing}>
                {isProcessing ? 'Importando...' : `Importar ${previewData.length} Contatos`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
