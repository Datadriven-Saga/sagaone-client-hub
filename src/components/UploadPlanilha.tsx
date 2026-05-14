import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { safeRead, XLSX } from '@/lib/xlsxSafe';
import { useUserAccessType } from '@/hooks/useUserAccessType';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface ImportLog {
  id: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  inserted: number;
  updated: number;
  linked: number;
  already_linked: number;
  errors: number;
  quarantined: number;
  error_details: string[];
  responsavel_applied?: number;
  responsavel_skipped?: number;
  warning_details?: Array<{ type?: string; value?: string; telefone?: string; nome?: string }>;
  message: string | null;
}

type ImportPhase = 'idle' | 'converting' | 'uploading' | 'processing' | 'done' | 'error';

export const UploadPlanilha = ({ onImportComplete, prospeccoes }: UploadPlanilhaProps) => {
  const { activeCompany } = useCompany();
  const { tipoAcesso } = useUserAccessType();
  const isAdminOnly = tipoAcesso === 'Administrador';
  const isCRMOrMaster = tipoAcesso === 'CRM' || tipoAcesso === 'Master';
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCampanha, setSelectedCampanha] = useState<string>('');
  const [selectedOrigem, setSelectedOrigem] = useState<string>('');
  const [nomeBase, setNomeBase] = useState<string>('');
  const [origens, setOrigens] = useState<OrigemOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Import state
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importLog, setImportLog] = useState<ImportLog | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const channelRef = useRef<any>(null);

  const isWorking = phase !== 'idle' && phase !== 'done' && phase !== 'error';

  // beforeunload protection
  useEffect(() => {
    if (!isWorking) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'A importação ainda está em andamento. Tem certeza que deseja sair?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isWorking]);

  // Fetch origens
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

  // Cleanup realtime channel on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const subscribeToImportLog = useCallback((logId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`import-${logId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'import_logs',
        filter: `id=eq.${logId}`,
      }, (payload: any) => {
        const newLog = payload.new as ImportLog;
        console.log('📡 Realtime update:', newLog.status, newLog.message);
        setImportLog(newLog);

        if (newLog.status === 'done') {
          setPhase('done');
          setShowResultDialog(true);
          onImportComplete?.();
        } else if (newLog.status === 'error') {
          setPhase('error');
          toast({
            title: 'Erro na importação',
            description: newLog.message || 'Erro desconhecido no processamento',
            variant: 'destructive',
          });
        }
      })
      .subscribe();

    channelRef.current = channel;
  }, [onImportComplete, toast]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const isExcel = selectedFile.type.includes('excel') || selectedFile.type.includes('spreadsheet') || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
      const isCsv = selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv');
      if (isExcel || isCsv) {
        setFile(selectedFile);
      } else {
        toast({
          title: 'Formato inválido',
          description: 'Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv)',
          variant: 'destructive',
        });
      }
    }
  };

  const convertExcelToCsv = async (file: File): Promise<File> => {
    setPhase('converting');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = safeRead(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const csvFileName = file.name.replace(/\.(xlsx|xls)$/i, '.csv');
    return new File([blob], csvFileName, { type: 'text/csv' });
  };

  const handleImport = async () => {
    if (!selectedCampanha) {
      toast({ title: 'Selecione uma campanha', description: 'Escolha uma campanha para adicionar os contatos', variant: 'destructive' });
      return;
    }
    if (!file) {
      toast({ title: 'Selecione um arquivo', description: 'Escolha um arquivo CSV ou Excel para importar', variant: 'destructive' });
      return;
    }
    if (!activeCompany?.id) return;

    const baseNomeFinal = nomeBase.trim() || `Importação ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const origemContato = selectedOrigem || 'Outros';

    try {
      // 1) Convert Excel to CSV if needed
      let csvFile = file;
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (isExcel) {
        csvFile = await convertExcelToCsv(file);
        console.log('📄 Excel convertido para CSV');
      }

      // 2) Upload CSV to Supabase Storage (with retry)
      setPhase('uploading');
      setUploadProgress(0);
      const timestamp = Date.now();
      const originalName = String(csvFile.name || 'arquivo.csv');
      const sanitizedName = originalName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      const filePath = `${activeCompany.id}/${timestamp}_${sanitizedName || 'arquivo.csv'}`;
      console.log(`🔤 Original filename: "${originalName}" → Sanitized: "${sanitizedName}"`);
      console.log(`📤 Uploading file to storage: ${filePath}`);

      const MAX_UPLOAD_RETRIES = 3;
      let uploadSuccess = false;
      let lastUploadError: any = null;

      for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
        setUploadProgress(attempt > 1 ? 0 : 0);
        console.log(`📤 Upload tentativa ${attempt}/${MAX_UPLOAD_RETRIES}...`);

        const { error: uploadError } = await supabase.storage
          .from('import-files')
          .upload(filePath, csvFile, {
            cacheControl: '3600',
            upsert: attempt > 1, // Allow overwrite on retry
          });

        if (!uploadError) {
          uploadSuccess = true;
          break;
        }

        lastUploadError = uploadError;
        console.error(`❌ Upload tentativa ${attempt} falhou:`, uploadError.message);

        if (attempt < MAX_UPLOAD_RETRIES) {
          toast({
            title: `Tentativa ${attempt} falhou`,
            description: `Reconectando... (tentativa ${attempt + 1}/${MAX_UPLOAD_RETRIES})`,
          });
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }

      if (!uploadSuccess) {
        console.error('❌ Upload failed after all retries:', lastUploadError);
        throw new Error(`Erro no upload após ${MAX_UPLOAD_RETRIES} tentativas: ${lastUploadError?.message || 'Timeout na conexão'}`);
      }

      setUploadProgress(100);
      console.log('✅ Upload concluído');

      // 3) Create base record
      const { data: baseData, error: baseError } = await supabase
        .from('bases_importadas')
        .insert({
          nome: baseNomeFinal,
          empresa_id: activeCompany.id,
          total_contatos: 0, // Will be updated by edge function
        })
        .select()
        .single();

      if (baseError) throw baseError;

      // 4) Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 5) Create import_log record
      const { data: logData, error: logError } = await supabase
        .from('import_logs')
        .insert({
          empresa_id: activeCompany.id,
          prospeccao_id: selectedCampanha,
          user_id: user.id,
          file_path: filePath,
          file_name: baseNomeFinal,
          status: 'pending',
          base_id: baseData.id,
          origem: origemContato,
          message: 'Aguardando processamento...',
        })
        .select()
        .single();

      if (logError) throw logError;

      console.log('📋 Import log created:', logData.id);

      // 6) Subscribe to realtime updates
      setPhase('processing');
      setImportLog(logData as ImportLog);
      subscribeToImportLog(logData.id);

      // 7) Trigger edge function (fire and forget)
      console.log('🚀 Triggering process-import edge function...');
      supabase.functions.invoke('process-import', {
        body: { import_log_id: logData.id },
      }).then(({ error }) => {
        if (error) {
          console.error('❌ Edge function invocation error:', error);
          // The edge function may still be running via self-chain
        }
      });

    } catch (error: any) {
      console.error('❌ Import error:', error);
      setPhase('error');
      toast({
        title: 'Erro na importação',
        description: error.message || 'Não foi possível iniciar a importação',
        variant: 'destructive',
      });
    }
  };

  const clearData = () => {
    setFile(null);
    setSelectedCampanha('');
    setSelectedOrigem('');
    setNomeBase('');
    setPhase('idle');
    setUploadProgress(0);
    setImportLog(null);
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeAndReset = () => {
    if (!isWorking) {
      setIsOpen(false);
      clearData();
    }
  };

  const progressPercent = importLog && importLog.total_rows > 0
    ? Math.round((importLog.processed_rows / importLog.total_rows) * 100)
    : 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!isWorking) setIsOpen(open); }}>
        <DialogTrigger asChild>
          <Button variant="outline" className="p-3 h-auto flex items-center gap-2">
            <FileSpreadsheet size={18} />
            <span className="text-sm">Upload de Planilha</span>
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Upload de Planilha de Contatos</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Admin limit warning */}
            {isAdminOnly && !isCRMOrMaster && (
              <Card className="p-3 bg-amber-50 border-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm text-amber-800">
                  <strong>Base de teste:</strong> Administradores podem subir bases limitadas.
                </span>
              </Card>
            )}

            {/* Campaign selection */}
            <Card className="p-4 bg-green-50 border-green-200">
              <Label className="text-green-800 font-medium">Selecione a Campanha</Label>
              <Select value={selectedCampanha} onValueChange={setSelectedCampanha} disabled={isWorking}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Escolha uma campanha..." />
                </SelectTrigger>
                <SelectContent>
                  {prospeccoes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            {/* Base name + Origin */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-orange-50 border-orange-200">
                <Label className="text-orange-800 font-medium">Nome da Base (opcional)</Label>
                <Input className="mt-2" placeholder="Ex: Base Janeiro 2026..." value={nomeBase} onChange={(e) => setNomeBase(e.target.value)} disabled={isWorking} />
              </Card>
              <Card className="p-4 bg-purple-50 border-purple-200">
                <Label className="text-purple-800 font-medium">Origem (opcional)</Label>
                <Select value={selectedOrigem} onValueChange={setSelectedOrigem} disabled={isWorking}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Escolha a origem..." />
                  </SelectTrigger>
                  <SelectContent>
                    {origens.map((o) => (
                      <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>
            </div>

            {/* Guide: Spreadsheet columns */}
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start space-x-2">
                <FileSpreadsheet className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                <div className="text-sm space-y-2 w-full">
                  <p className="font-medium text-blue-800">📋 Colunas aceitas na planilha:</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-blue-200">
                          <th className="text-left py-1 pr-2 text-blue-900 font-semibold">Coluna</th>
                          <th className="text-left py-1 pr-2 text-blue-900 font-semibold">Obrigatória</th>
                          <th className="text-left py-1 text-blue-900 font-semibold">Nomes aceitos</th>
                        </tr>
                      </thead>
                      <tbody className="text-blue-700">
                        <tr className="border-b border-blue-100">
                          <td className="py-1 pr-2 font-medium">Telefone</td>
                          <td className="py-1 pr-2"><span className="text-red-600 font-bold">Sim ✱</span></td>
                          <td className="py-1">telefone, phone, celular, cel, whatsapp, fone, tel</td>
                        </tr>
                        <tr className="border-b border-blue-100">
                          <td className="py-1 pr-2 font-medium">Nome</td>
                          <td className="py-1 pr-2">Não</td>
                          <td className="py-1">nome, name, nome completo, nome do cliente</td>
                        </tr>
                        <tr className="border-b border-blue-100">
                          <td className="py-1 pr-2 font-medium">E-mail</td>
                          <td className="py-1 pr-2">Não</td>
                          <td className="py-1">email, e-mail, mail</td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-2 font-medium">Responsável</td>
                          <td className="py-1 pr-2">Não</td>
                          <td className="py-1">responsavel, vendedor, atendente, consultor</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                      ⚠️ <strong>Responsável deve ser preenchido com o e-mail</strong> do vendedor cadastrado no sistema (ex: vendedor@gruposaga.com.br). Nomes não são aceitos.
                    </p>
                  </div>

                  <div className="mt-2 pt-2 border-t border-blue-200 space-y-1">
                    <p className="font-medium text-blue-800">👤 Distribuição de vendedores:</p>
                    <p className="text-blue-700">
                      • <strong>Com responsável preenchido:</strong> O lead é atribuído diretamente ao vendedor informado (e-mail) e <strong>não entra</strong> no pool de distribuição automática.<br/>
                      • <strong>Sem responsável:</strong> O lead entra no pool geral e será distribuído automaticamente (até 30 leads por vendedor) quando o vendedor acessar a aba "Atendimento".<br/>
                      • <strong>Dica:</strong> Você pode misturar na mesma planilha — preencha o responsável apenas nas linhas desejadas.
                    </p>
                  </div>

                  <div className="mt-2 pt-2 border-t border-blue-200 space-y-1">
                    <p className="font-medium text-blue-800">⚙️ Como funciona a importação:</p>
                    <p className="text-blue-700">
                      • Formatos aceitos: <strong>CSV</strong>, <strong>Excel (.xlsx, .xls)</strong><br/>
                      • Suporta <strong>milhões de linhas</strong> (processamento no servidor)<br/>
                      • Telefones são normalizados automaticamente (DDD + 9 dígitos)<br/>
                      • <strong>Duplicatas</strong> são atualizadas (mesmo telefone + empresa = atualiza dados)<br/>
                      • O contato é vinculado à <strong>campanha selecionada acima</strong><br/>
                      • Acompanhe o progresso em tempo real
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* File Upload */}
            <Card className="p-4 border-dashed border-2 border-muted flex flex-col justify-center">
              <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" id="file-upload" disabled={isWorking} />
              <Label htmlFor="file-upload" className="cursor-pointer text-center">
                <Upload className="mx-auto mb-2 text-muted-foreground" size={24} />
                <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo</p>
                <p className="text-xs text-muted-foreground mt-1">CSV ou Excel (.xlsx, .xls)</p>
                {file && <p className="text-sm font-medium mt-2 text-primary">{file.name}</p>}
              </Label>
            </Card>

            {/* Converting indicator */}
            {phase === 'converting' && (
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  <p className="text-sm font-medium">Convertendo Excel para CSV...</p>
                </div>
              </Card>
            )}

            {/* Upload progress */}
            {phase === 'uploading' && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Enviando arquivo ao servidor...</p>
                  <span className="text-sm font-bold text-primary">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-3" />
              </Card>
            )}

            {/* Server processing progress */}
            {(phase === 'processing' || phase === 'done' || phase === 'error') && importLog && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {phase === 'processing' ? 'Processando no servidor...' : phase === 'done' ? 'Processamento concluído!' : 'Erro no processamento'}
                  </p>
                  {importLog.total_rows > 0 && (
                    <span className="text-sm font-bold text-primary">{progressPercent}%</span>
                  )}
                </div>

                {importLog.total_rows > 0 && (
                  <Progress value={progressPercent} className="h-3" />
                )}

                {/* Status message */}
                {importLog.message && (
                  <p className="text-xs text-muted-foreground">{importLog.message}</p>
                )}

                {/* Stats grid */}
                {importLog.processed_rows > 0 && (
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    <div>
                      <p className="font-bold text-emerald-600">{importLog.inserted.toLocaleString('pt-BR')}</p>
                      <p className="text-muted-foreground">Novos</p>
                    </div>
                    <div>
                      <p className="font-bold text-blue-600">{importLog.updated.toLocaleString('pt-BR')}</p>
                      <p className="text-muted-foreground">Atualizados</p>
                    </div>
                    <div>
                      <p className="font-bold text-primary">{importLog.linked.toLocaleString('pt-BR')}</p>
                      <p className="text-muted-foreground">Vinculados</p>
                    </div>
                    <div>
                      <p className="font-bold text-amber-600">{(importLog.quarantined || 0).toLocaleString('pt-BR')}</p>
                      <p className="text-muted-foreground">Quarentena</p>
                    </div>
                    <div>
                      <p className="font-bold text-destructive">{importLog.errors.toLocaleString('pt-BR')}</p>
                      <p className="text-muted-foreground">Erros</p>
                    </div>
                  </div>
                )}

                {importLog.total_rows > 0 && (
                  <p className="text-xs text-muted-foreground text-right">
                    {importLog.processed_rows.toLocaleString('pt-BR')}/{importLog.total_rows.toLocaleString('pt-BR')} registros
                  </p>
                )}

                {/* Error details */}
                {importLog.error_details && importLog.error_details.length > 0 && (
                  <ScrollArea className="max-h-40 border rounded p-2">
                    <div className="text-xs space-y-1">
                      <p className="font-medium text-destructive mb-1">
                        ⚠️ Erros encontrados ({importLog.error_details.length}):
                      </p>
                      {importLog.error_details.slice(0, 30).map((err, i) => {
                        const parts = err.split(' | ');
                        if (parts.length >= 3) {
                          return (
                            <div key={i} className="py-0.5 border-b border-border/30 last:border-0">
                              <span className="text-muted-foreground">{parts[0]} • {parts[1]}</span>
                              <span className="text-destructive ml-1">→ {parts[2]}</span>
                            </div>
                          );
                        }
                        return <p key={i} className="text-destructive">• {err}</p>;
                      })}
                      {importLog.error_details.length > 30 && (
                        <p className="text-muted-foreground pt-1">...e mais {importLog.error_details.length - 30} erros</p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </Card>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {file && phase === 'idle' && (
                <span className="text-primary font-medium">
                  📎 {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeAndReset} disabled={isWorking}>
                {phase === 'done' || phase === 'error' ? 'Fechar' : 'Cancelar'}
              </Button>
              {file && phase === 'idle' && (
                <Button onClick={handleImport}>
                  Enviar e Processar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importLog && importLog.errors > 0 ? (
                <><AlertTriangle className="h-5 w-5 text-amber-500" /> Importação Parcial</>
              ) : (
                <><CheckCircle className="h-5 w-5 text-emerald-500" /> Importação Concluída</>
              )}
            </DialogTitle>
          </DialogHeader>

          {importLog && (
            <div className="space-y-4">
              {/* Main number */}
              <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-500">
                    {(importLog.linked + importLog.already_linked).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">contatos vinculados ao evento</p>
                </div>
              </Card>

              {/* Detail breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Total processados</span>
                  <span className="font-medium">{importLog.processed_rows.toLocaleString('pt-BR')}</span>
                </div>

                {importLog.inserted > 0 && (
                  <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      Novos contatos criados
                    </span>
                    <span className="font-medium text-emerald-600">{importLog.inserted.toLocaleString('pt-BR')}</span>
                  </div>
                )}

                {importLog.updated > 0 && (
                  <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
                      Contatos atualizados
                    </span>
                    <span className="font-medium text-blue-600">{importLog.updated.toLocaleString('pt-BR')}</span>
                  </div>
                )}

                {importLog.linked > 0 && (
                  <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      Vinculados ao evento
                    </span>
                    <span className="font-medium text-primary">{importLog.linked.toLocaleString('pt-BR')}</span>
                  </div>
                )}

                {importLog.already_linked > 0 && (
                  <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      Já estavam no evento
                    </span>
                    <span className="font-medium text-amber-600">{importLog.already_linked.toLocaleString('pt-BR')}</span>
                  </div>
                )}

                {(importLog.quarantined || 0) > 0 && (
                  <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Bloqueados por quarentena (mesma marca, 30 dias)
                    </span>
                    <span className="font-medium text-amber-600">{importLog.quarantined.toLocaleString('pt-BR')}</span>
                  </div>
                )}

                {importLog.errors > 0 && (
                  <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                    <span className="flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                      Erros no processamento
                    </span>
                    <span className="font-medium text-destructive">{importLog.errors.toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>

              {/* Error details */}
              {importLog.error_details && importLog.error_details.length > 0 && (
                <Card className="p-3 border-destructive/30 bg-destructive/5">
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs font-medium text-destructive">
                        Detalhes dos erros ({importLog.error_details.length}{importLog.error_details.length >= 200 ? '+' : ''} registros):
                      </p>
                    </div>
                    <ScrollArea className="max-h-48">
                      <div className="text-xs space-y-1">
                        {importLog.error_details.slice(0, 50).map((err, i) => {
                          // Parse structured errors: "Tel: X | Nome: Y | Erro: Z" or "Linha X: ..."
                          const parts = err.split(' | ');
                          if (parts.length >= 3) {
                            return (
                              <div key={i} className="flex gap-2 items-start py-1 border-b border-destructive/10 last:border-0">
                                <span className="text-destructive font-mono shrink-0">#{i + 1}</span>
                                <div className="min-w-0">
                                  <div className="flex gap-3 flex-wrap">
                                    <span className="text-muted-foreground">{parts[0]}</span>
                                    <span className="text-muted-foreground">{parts[1]}</span>
                                  </div>
                                  <p className="text-destructive font-medium mt-0.5">{parts[2]}</p>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={i} className="flex gap-2 items-start py-1 border-b border-destructive/10 last:border-0">
                              <span className="text-destructive font-mono shrink-0">#{i + 1}</span>
                              <p className="text-destructive">{err}</p>
                            </div>
                          );
                        })}
                        {importLog.error_details.length > 50 && (
                          <p className="text-muted-foreground pt-1">...e mais {importLog.error_details.length - 50} erros</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </Card>
              )}

              <div className="flex justify-end">
                <Button onClick={() => { setShowResultDialog(false); clearData(); }}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
