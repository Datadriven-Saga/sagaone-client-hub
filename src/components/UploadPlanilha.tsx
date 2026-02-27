import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  validatePhonePermissive, 
  normalizeToLocalPhone,
  PhoneErrorCode 
} from '@/lib/phoneUtils';
import { useUserAccessType } from '@/hooks/useUserAccessType';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBulkImport, BulkImportProgress } from '@/hooks/useBulkImport';

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
  emQuarentena?: boolean;
  quarentenaInfo?: string;
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

export interface ImportResult {
  eventosInseridos: number;
  eventosErros: number;
  novosContatosCriados: number;
  existentesVinculados: number;
  jaNoEvento: number;
  insertErrors: number;
  totalEnviados: number;
}

interface UploadPlanilhaProps {
  onImportComplete?: () => void;
  prospeccoes: Prospeccao[];
}

interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  quarentena: number;
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

export const UploadPlanilha = ({ onImportComplete, prospeccoes }: UploadPlanilhaProps) => {
  const { activeCompany } = useCompany();
  const { tipoAcesso } = useUserAccessType();
  const isAdminOrMaster = tipoAcesso === 'Administrador' || tipoAcesso === 'Master';
  const isAdminOnly = tipoAcesso === 'Administrador';
  const isCRMOrMaster = tipoAcesso === 'CRM' || tipoAcesso === 'Master';
  const ADMIN_UPLOAD_LIMIT = 10;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCampanha, setSelectedCampanha] = useState<string>('');
  const [selectedOrigem, setSelectedOrigem] = useState<string>('');
  const [nomeBase, setNomeBase] = useState<string>('');
  const [origens, setOrigens] = useState<OrigemOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ClienteData[]>([]);
  const [invalidData, setInvalidData] = useState<ClienteData[]>([]);
  const [duplicateData, setDuplicateData] = useState<ClienteData[]>([]);
  const [quarentenaData, setQuarentenaData] = useState<ClienteData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [activeTab, setActiveTab] = useState('valid');
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ parsed: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Bulk import hook
  const { progress: importProgress, importContacts, resetProgress, abort, isImporting } = useBulkImport();
  const [finalResult, setFinalResult] = useState<BulkImportProgress | null>(null);

  // beforeunload protection during import
  useEffect(() => {
    if (!isImporting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'A importação ainda está em andamento. Tem certeza que deseja sair?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isImporting]);

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
      if (!error && data) setOrigens(data);
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

  const normalizeColumnName = (name: string): string => {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  };

  const columnMappings: Record<string, string[]> = {
    nome: ['nome', 'name', 'nome completo', 'nome do cliente'],
    telefone: ['telefone', 'phone', 'celular', 'cel', 'whatsapp', 'fone', 'tel'],
    email: ['email', 'e-mail', 'mail'],
    cpf: ['cpf', 'cpf/cnpj', 'documento'],
    segmentacao: ['segmentacao', 'segmento', 'categoria', 'tipo', 'grupo'],
    responsavel: ['responsavel', 'vendedor', 'atendente', 'consultor', 'responsavel email'],
  };

  const tokenize = (value: string) =>
    normalizeColumnName(value).split(/[^a-z0-9]+/g).filter(Boolean);

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

  const validateAndMapRows = (headers: string[], dataRows: any[][]): {
    validClientes: ClienteData[];
    invalidClientes: ClienteData[];
    duplicateClientes: ClienteData[];
  } => {
    const columnIndices = {
      nome: findColumnIndex(headers, 'nome'),
      telefone: findColumnIndex(headers, 'telefone'),
      email: findColumnIndex(headers, 'email'),
      cpf: findColumnIndex(headers, 'cpf'),
      segmentacao: findColumnIndex(headers, 'segmentacao'),
      responsavel: findColumnIndex(headers, 'responsavel'),
    };

    if (columnIndices.telefone === -1) {
      throw new Error('MISSING_PHONE_COLUMN');
    }

    const validClientes: ClienteData[] = [];
    const invalidClientes: ClienteData[] = [];
    const duplicateClientes: ClienteData[] = [];
    const seenPhones = new Map<string, number>();

    dataRows.filter(row => row && row.length > 0).forEach((row, index) => {
      const nome = columnIndices.nome >= 0 ? row[columnIndices.nome]?.toString().trim() || '' : '';
      const telefoneOriginal = columnIndices.telefone >= 0 ? row[columnIndices.telefone]?.toString().trim() || '' : '';
      const phoneValidation = validatePhonePermissive(telefoneOriginal);

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

      if (!phoneValidation.isValid) {
        invalidClientes.push({
          ...clienteBase,
          validationError: phoneValidation.errorMessage || 'Telefone inválido',
          validationErrorCode: phoneValidation.errorCode || undefined
        });
        return;
      }

      const normalized = phoneValidation.normalized!;
      if (seenPhones.has(normalized)) {
        duplicateClientes.push({
          ...clienteBase,
          validationError: `Duplicado da linha ${seenPhones.get(normalized)! + 2}`
        });
        return;
      }

      seenPhones.set(normalized, index);

      const localPhoneResult = normalizeToLocalPhone(phoneValidation.normalized);
      const telefoneNormalizado = localPhoneResult.valido
        ? localPhoneResult.localPhone!
        : phoneValidation.normalized!;

      validClientes.push({
        ...clienteBase,
        telefone: telefoneNormalizado,
        telefoneFormatado: phoneValidation.formatted!
      });
    });

    return { validClientes, invalidClientes, duplicateClientes };
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setInvalidData([]);
    setDuplicateData([]);
    setValidationSummary(null);
    setParseProgress(null);

    const isCsv = file.name.endsWith('.csv');

    try {
      let headers: string[] = [];
      let dataRows: any[][] = [];

      if (isCsv) {
        // Use PapaParse streaming for CSV files (handles massive files)
        await new Promise<void>((resolve, reject) => {
          let headerParsed = false;
          let rowCount = 0;
          const estimatedTotal = Math.round(file.size / 50); // rough estimate ~50 bytes/row

          Papa.parse(file, {
            worker: true,
            step: (result) => {
              const row = result.data as any[];
              if (!headerParsed) {
                headers = row.map(h => h?.toString() || '');
                headerParsed = true;
                return;
              }
              if (row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
                dataRows.push(row);
                rowCount++;
                if (rowCount % 10000 === 0) {
                  setParseProgress({ parsed: rowCount, total: estimatedTotal });
                }
              }
            },
            complete: () => {
              setParseProgress({ parsed: rowCount, total: rowCount });
              resolve();
            },
            error: (err) => reject(err),
          });
        });
      } else {
        // Use XLSX for Excel files
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          toast({ title: "Arquivo vazio", description: "O arquivo não contém dados suficientes", variant: "destructive" });
          setIsProcessing(false);
          return;
        }

        headers = (jsonData[0] as any[]).map(h => h?.toString() || '');
        dataRows = (jsonData.slice(1) as any[][]);
      }

      if (dataRows.length === 0) {
        toast({ title: "Arquivo vazio", description: "O arquivo não contém dados", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      console.log(`📊 Arquivo lido: ${dataRows.length} linhas`);

      let result;
      try {
        result = validateAndMapRows(headers, dataRows);
      } catch (err: any) {
        if (err.message === 'MISSING_PHONE_COLUMN') {
          toast({ title: "Coluna obrigatória não encontrada", description: "Não foi possível identificar a coluna 'Telefone'.", variant: "destructive" });
          setIsProcessing(false);
          return;
        }
        throw err;
      }

      let { validClientes, invalidClientes, duplicateClientes } = result;
      const quarentenaClientes: ClienteData[] = [];

      // Admin limit
      if (isAdminOnly && !isCRMOrMaster && validClientes.length > ADMIN_UPLOAD_LIMIT) {
        const excedentes = validClientes.length - ADMIN_UPLOAD_LIMIT;
        validClientes = validClientes.slice(0, ADMIN_UPLOAD_LIMIT);
        toast({
          title: "Limite de base de teste",
          description: `Administradores podem subir no máximo ${ADMIN_UPLOAD_LIMIT} contatos. ${excedentes} removidos.`,
        });
      }

      setPreviewData(validClientes);
      setInvalidData(invalidClientes);
      setDuplicateData(duplicateClientes);
      setQuarentenaData(quarentenaClientes);
      setValidationSummary({
        total: validClientes.length + invalidClientes.length + duplicateClientes.length,
        valid: validClientes.length,
        invalid: invalidClientes.length,
        duplicates: duplicateClientes.length,
        quarentena: 0,
      });

      setIsProcessing(false);
      setParseProgress(null);

      if (invalidClientes.length > 0 || duplicateClientes.length > 0) {
        toast({
          title: "Arquivo processado com ressalvas",
          description: `${validClientes.length} válidos, ${invalidClientes.length} inválidos, ${duplicateClientes.length} duplicados`,
        });
        setActiveTab(invalidClientes.length > 0 ? 'invalid' : 'duplicates');
      } else {
        toast({ title: "Arquivo processado", description: `${validClientes.length} registros válidos encontrados` });
        setActiveTab('valid');
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      setIsProcessing(false);
      setParseProgress(null);
      toast({ title: "Erro ao processar arquivo", description: "Verifique se o formato está correto", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!selectedCampanha) {
      toast({ title: "Selecione uma campanha", description: "Escolha uma campanha para adicionar os contatos", variant: "destructive" });
      return;
    }
    if (previewData.length === 0) {
      toast({ title: "Nenhum contato válido", description: "Não há contatos válidos para importar.", variant: "destructive" });
      return;
    }
    if (!activeCompany?.id) return;

    const baseNomeFinal = nomeBase.trim() || `Importação ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const selectedProspeccao = prospeccoes.find(p => p.id === selectedCampanha);

    setIsProcessing(true);
    resetProgress();

    try {
      // 1) Criar registro da base importada
      const { data: baseData, error: baseError } = await supabase
        .from('bases_importadas')
        .insert({
          nome: baseNomeFinal,
          empresa_id: activeCompany.id,
          total_contatos: previewData.length
        })
        .select()
        .single();

      if (baseError) throw baseError;

      // 2) Preparar contatos para importação via RPC
      const origemContato = selectedOrigem || 'Outros';
      const contatosForImport = previewData.map(c => ({
        nome: c.nome,
        telefone: c.telefone,
        email: c.email || undefined,
        origem: origemContato,
        observacoes: `Importado para: ${selectedProspeccao?.titulo || ''}`,
        responsavel_email: c.responsavel && c.responsavel.trim() ? c.responsavel : undefined,
        base_id: baseData.id,
      }));

      // 3) Execute bulk import via RPC with progress tracking
      const result = await importContacts(contatosForImport, activeCompany.id, selectedCampanha);

      // 4) Register quarantine
      const QUARENTENA_BATCH = 500;
      for (let i = 0; i < previewData.length; i += QUARENTENA_BATCH) {
        const batch = previewData.slice(i, i + QUARENTENA_BATCH).map(c => ({
          telefone_normalizado: c.telefone,
          empresa_id: activeCompany.id,
          ultimo_impacto_at: new Date().toISOString(),
          prospeccao_id: selectedCampanha,
          evento_nome: selectedProspeccao?.titulo || '',
          canal: selectedProspeccao?.canal || 'WhatsApp',
        }));
        await supabase
          .from('contato_quarentena')
          .upsert(batch, { onConflict: 'telefone_normalizado,empresa_id' });
      }

      // 5) Create notification
      const { data: userData } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
        .single();

      await supabase.from('notificacoes_importacao').insert({
        empresa_id: activeCompany.id,
        solicitante_id: (await supabase.auth.getUser()).data.user?.id || '',
        solicitante_nome: userData?.nome_completo || 'Usuário',
        base_nome: baseNomeFinal,
        total_contatos: result.linked + result.alreadyLinked,
        prospeccao_id: selectedCampanha,
      });

      // 6) Notify CRM users
      const { data: crmUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('empresa_id', activeCompany.id)
        .eq('tipo_acesso', 'CRM')
        .eq('status', 'Ativo');

      if (crmUsers && crmUsers.length > 0) {
        const notificacoes = crmUsers.map(crm => ({
          destinatario_id: crm.id,
          tipo: 'Push' as const,
          titulo: `Nova importação: ${baseNomeFinal}`,
          mensagem: `${userData?.nome_completo || 'Usuário'} importou ${result.linked} contatos para "${selectedProspeccao?.titulo || ''}"`,
          status: 'Pendente' as const,
        }));
        await supabase.from('notificacoes').insert(notificacoes);
      }

      // 7) Handle Ligação sync if needed
      if (selectedProspeccao?.canal === 'Ligação') {
        try {
          const { data: agenteData } = await supabase
            .from('agente_empresas')
            .select('agente_id, agentes_ia (id, nome, telefone, ativo)')
            .eq('empresa_id', activeCompany.id)
            .limit(10);

          const agenteAtivo = agenteData?.find((a: any) => a.agentes_ia?.ativo === true && a.agentes_ia?.telefone);

          if (agenteAtivo?.agentes_ia?.telefone) {
            const telefonePri = (agenteAtivo.agentes_ia as any).telefone.replace(/\D/g, '');
            const idEvento = selectedProspeccao.event_id_pri ? Number(selectedProspeccao.event_id_pri) : null;

            const contatosPayload = previewData.map(c => {
              let digits = c.telefone.replace(/\D/g, '');
              if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
              return { nome: c.nome || '', telefone: digits };
            });

            const SYNC_BATCH = 1000;
            for (let i = 0; i < contatosPayload.length; i += SYNC_BATCH) {
              const batch = contatosPayload.slice(i, i + SYNC_BATCH);
              try {
                await supabase.functions.invoke('create-base-ligacao', {
                  body: {
                    contatos: batch,
                    id_evento: idEvento || 0,
                    telefone_pri: telefonePri,
                    empresa_id: activeCompany.id,
                    prospeccao_id: selectedProspeccao.id,
                    loja: activeCompany?.nome_empresa || '',
                    sync_external: !!idEvento,
                  },
                });
              } catch (batchError) {
                console.error('❌ Sync batch error:', batchError);
              }
            }
          }
        } catch (syncError) {
          console.error('❌ Ligação sync error:', syncError);
        }
      }

      // Close upload dialog and show result
      setIsOpen(false);
      setFinalResult(result);
      setShowResultDialog(true);
      onImportComplete?.();

      // Clean up state
      setSelectedCampanha('');
      setSelectedOrigem('');
      setNomeBase('');
      setFile(null);
      setPreviewData([]);
      setInvalidData([]);
      setDuplicateData([]);
      setQuarentenaData([]);
      setValidationSummary(null);

    } catch (error) {
      console.error('Erro na importação:', error);
      toast({ title: "Erro na importação", description: "Não foi possível completar a importação", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearData = () => {
    setFile(null);
    setPreviewData([]);
    setInvalidData([]);
    setDuplicateData([]);
    setQuarentenaData([]);
    setSelectedCampanha('');
    setSelectedOrigem('');
    setNomeBase('');
    setValidationSummary(null);
    resetProgress();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const progressPercent = importProgress.totalRecords > 0
    ? Math.round((importProgress.processedRecords / importProgress.totalRecords) * 100)
    : 0;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isImporting) setIsOpen(open); }}>
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
          {/* Aviso de limite para Admin */}
          {isAdminOnly && !isCRMOrMaster && (
            <Card className="p-3 bg-amber-50 border-amber-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm text-amber-800">
                <strong>Base de teste:</strong> Administradores podem subir no máximo {ADMIN_UPLOAD_LIMIT} contatos por base.
              </span>
            </Card>
          )}

          {/* Seleção de Campanha */}
          <Card className="p-4 bg-green-50 border-green-200">
            <Label className="text-green-800 font-medium">Selecione a Campanha</Label>
            <Select value={selectedCampanha} onValueChange={setSelectedCampanha} disabled={isImporting}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Escolha uma campanha para adicionar os contatos..." />
              </SelectTrigger>
              <SelectContent>
                {prospeccoes.map((prospeccao) => (
                  <SelectItem key={prospeccao.id} value={prospeccao.id}>
                    {prospeccao.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Nome da Base e Origem */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-orange-50 border-orange-200">
              <Label className="text-orange-800 font-medium">Nome da Base (opcional)</Label>
              <Input className="mt-2" placeholder="Ex: Base Janeiro 2026..." value={nomeBase} onChange={(e) => setNomeBase(e.target.value)} disabled={isImporting} />
            </Card>
            <Card className="p-4 bg-purple-50 border-purple-200">
              <Label className="text-purple-800 font-medium">Origem (opcional)</Label>
              <Select value={selectedOrigem} onValueChange={setSelectedOrigem} disabled={isImporting}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Escolha a origem..." />
                </SelectTrigger>
                <SelectContent>
                  {origens.map((origem) => (
                    <SelectItem key={origem.id} value={origem.nome}>{origem.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>
          </div>

          {/* Instruções e Upload */}
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
                    • Números repetidos são rejeitados<br/>
                    • Duplicatas na planilha são ignoradas<br/>
                    • Duplicatas no banco são atualizadas (idempotente)
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-dashed border-2 border-muted flex flex-col justify-center">
              <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" id="file-upload" disabled={isImporting} />
              <Label htmlFor="file-upload" className="cursor-pointer text-center">
                <Upload className="mx-auto mb-2 text-muted-foreground" size={24} />
                <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste o arquivo</p>
                {file && <p className="text-sm font-medium mt-2 text-primary">{file.name}</p>}
              </Label>
            </Card>
          </div>

          {/* Parse progress for large files */}
          {parseProgress && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Lendo arquivo...</p>
                  <p className="text-xs text-muted-foreground">{parseProgress.parsed.toLocaleString('pt-BR')} linhas lidas</p>
                </div>
              </div>
            </Card>
          )}

          {/* Processing indicator (validation) */}
          {isProcessing && !isImporting && !parseProgress && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Processando e validando arquivo...</p>
            </div>
          )}

          {/* Import progress bar */}
          {isImporting && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Importando contatos...</p>
                <span className="text-sm font-bold text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <p className="font-bold text-emerald-600">{importProgress.inserted.toLocaleString('pt-BR')}</p>
                  <p className="text-muted-foreground">Novos</p>
                </div>
                <div>
                  <p className="font-bold text-blue-600">{importProgress.updated.toLocaleString('pt-BR')}</p>
                  <p className="text-muted-foreground">Atualizados</p>
                </div>
                <div>
                  <p className="font-bold text-primary">{importProgress.linked.toLocaleString('pt-BR')}</p>
                  <p className="text-muted-foreground">Vinculados</p>
                </div>
                <div>
                  <p className="font-bold text-destructive">{importProgress.errors.toLocaleString('pt-BR')}</p>
                  <p className="text-muted-foreground">Erros</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Lote {importProgress.currentBatch}/{importProgress.totalBatches}</span>
                <span>{importProgress.processedRecords.toLocaleString('pt-BR')}/{importProgress.totalRecords.toLocaleString('pt-BR')} registros</span>
                {importProgress.retries > 0 && (
                  <span className="text-amber-600">{importProgress.retries} retentativas</span>
                )}
              </div>
              <Button variant="destructive" size="sm" onClick={abort} className="w-full">
                Cancelar Importação
              </Button>
            </Card>
          )}

          {/* Resumo de validação */}
          {validationSummary && !isProcessing && !isImporting && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Resultado da Validação</h4>
                <Button variant="outline" size="sm" onClick={clearData}>Limpar</Button>
              </div>
              
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{validationSummary.total.toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-700">{validationSummary.valid.toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-green-600">Válidos</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-700">{validationSummary.invalid.toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-red-600">Inválidos</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-2xl font-bold text-yellow-700">{validationSummary.duplicates.toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-yellow-600">Duplicados</div>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="valid" className="flex items-center gap-1 text-xs">
                    <CheckCircle size={14} className="text-green-600" />
                    Válidos ({previewData.length.toLocaleString('pt-BR')})
                  </TabsTrigger>
                  <TabsTrigger value="invalid" className="flex items-center gap-1 text-xs">
                    <XCircle size={14} className="text-red-600" />
                    Inválidos ({invalidData.length.toLocaleString('pt-BR')})
                  </TabsTrigger>
                  <TabsTrigger value="duplicates" className="flex items-center gap-1 text-xs">
                    <AlertTriangle size={14} className="text-yellow-600" />
                    Duplicados ({duplicateData.length.toLocaleString('pt-BR')})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="valid" className="mt-4">
                  <ScrollArea className="h-[280px] border rounded-lg">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[180px]">Nome</TableHead>
                          <TableHead className="w-[160px]">Telefone</TableHead>
                          <TableHead className="w-[180px]">E-mail</TableHead>
                          <TableHead className="w-[120px]">CPF</TableHead>
                          <TableHead className="w-[60px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.slice(0, 100).map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.nome}</TableCell>
                            <TableCell className="font-mono text-sm">{item.telefone}</TableCell>
                            <TableCell>{item.email || '-'}</TableCell>
                            <TableCell>{item.cpf || '-'}</TableCell>
                            <TableCell><CheckCircle className="text-green-600" size={16} /></TableCell>
                          </TableRow>
                        ))}
                        {previewData.length > 100 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                              ...e mais {(previewData.length - 100).toLocaleString('pt-BR')} registros
                            </TableCell>
                          </TableRow>
                        )}
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
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invalidData.slice(0, 100).map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className={!item.nome ? 'text-red-600' : ''}>{item.nome || '(vazio)'}</TableCell>
                            <TableCell className="font-mono text-sm text-red-600">{item.telefoneOriginal || '(vazio)'}</TableCell>
                            <TableCell>
                              {item.validationErrorCode && (
                                <Badge variant="destructive" className="text-xs">
                                  {ERROR_LABELS[item.validationErrorCode] || item.validationErrorCode}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-red-600 text-sm">{item.validationError}</TableCell>
                          </TableRow>
                        ))}
                        {invalidData.length > 100 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                              ...e mais {(invalidData.length - 100).toLocaleString('pt-BR')} erros
                            </TableCell>
                          </TableRow>
                        )}
                        {invalidData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum erro</TableCell>
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
                        {duplicateData.slice(0, 100).map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.nome}</TableCell>
                            <TableCell className="font-mono text-sm text-yellow-600">{item.telefoneOriginal}</TableCell>
                            <TableCell className="text-yellow-600 text-sm">{item.validationError}</TableCell>
                          </TableRow>
                        ))}
                        {duplicateData.length > 100 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                              ...e mais {(duplicateData.length - 100).toLocaleString('pt-BR')} duplicatas
                            </TableCell>
                          </TableRow>
                        )}
                        {duplicateData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhuma duplicata</TableCell>
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
            {validationSummary && previewData.length > 0 && !isImporting && (
              <span className="text-green-700 font-medium">
                ✓ {previewData.length.toLocaleString('pt-BR')} contatos serão importados
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isImporting}>Cancelar</Button>
            {previewData.length > 0 && !isImporting && (
              <Button onClick={handleImport} disabled={isProcessing}>
                {isProcessing ? 'Importando...' : `Importar ${previewData.length.toLocaleString('pt-BR')} Contatos`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Dialog de resultado da importação */}
    <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
      <DialogContent className="w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {finalResult && (finalResult.errors > 0) ? (
              <><AlertTriangle className="h-5 w-5 text-amber-500" /> Importação Parcial</>
            ) : (
              <><CheckCircle className="h-5 w-5 text-emerald-500" /> Importação Concluída</>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {finalResult && (
          <div className="space-y-4">
            {/* Número principal - disponíveis para disparo */}
            <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-500">{(finalResult.linked + finalResult.alreadyLinked).toLocaleString('pt-BR')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  contatos vinculados ao evento
                </p>
              </div>
            </Card>
            
            {/* Detalhamento */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Total processados</span>
                <span className="font-medium">{finalResult.processedRecords.toLocaleString('pt-BR')}</span>
              </div>
              
              {finalResult.inserted > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    Novos contatos criados
                  </span>
                  <span className="font-medium text-emerald-600">{finalResult.inserted.toLocaleString('pt-BR')}</span>
                </div>
              )}
              
              {finalResult.updated > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
                    Contatos atualizados (já existiam)
                  </span>
                  <span className="font-medium text-blue-600">{finalResult.updated.toLocaleString('pt-BR')}</span>
                </div>
              )}

              {finalResult.linked > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    Vinculados ao evento
                  </span>
                  <span className="font-medium text-primary">{finalResult.linked.toLocaleString('pt-BR')}</span>
                </div>
              )}
              
              {finalResult.alreadyLinked > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    Já estavam no evento
                  </span>
                  <span className="font-medium text-amber-600">{finalResult.alreadyLinked.toLocaleString('pt-BR')}</span>
                </div>
              )}
              
              {finalResult.errors > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                    Erros no processamento
                  </span>
                  <span className="font-medium text-destructive">{finalResult.errors.toLocaleString('pt-BR')}</span>
                </div>
              )}

              {finalResult.retries > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Retentativas por oscilação de rede
                  </span>
                  <span className="font-medium text-amber-600">{finalResult.retries}</span>
                </div>
              )}
            </div>

            {/* Error details */}
            {finalResult.errorDetails.length > 0 && (
              <Card className="p-3 border-destructive/30 bg-destructive/5">
                <div className="flex gap-2 items-start">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-xs text-destructive">
                    <p className="font-medium mb-1">Detalhes dos erros:</p>
                    <ul className="space-y-0.5 list-disc list-inside">
                      {finalResult.errorDetails.slice(0, 10).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {finalResult.errorDetails.length > 10 && (
                        <li>...e mais {finalResult.errorDetails.length - 10} erros</li>
                      )}
                    </ul>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setShowResultDialog(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};
