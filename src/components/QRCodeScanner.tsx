import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface QRCodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface QRCodeData {
  qr_token: string;
  convidado_nome: string;
  convidado_telefone: string;
  quem_convidou: string;
  vendedor: string;
}

export function QRCodeScanner({ isOpen, onClose, onSuccess }: QRCodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ nome: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const { toast } = useToast();
  const { activeCompany } = useCompany();

  useEffect(() => {
    if (isOpen && !success) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen, success]);

  const startScanner = async () => {
    // Evitar múltiplas inicializações
    if (isStartingRef.current || scannerRef.current) {
      return;
    }
    
    isStartingRef.current = true;
    setError(null);
    setScanning(true);
    setSuccess(false);
    setSuccessData(null);

    try {
      // Aguardar elemento ser renderizado
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const container = document.getElementById('qr-reader');
      if (!container) {
        throw new Error('Container não encontrado');
      }

      // Limpar container antes de iniciar
      container.innerHTML = '';

      // Listar câmeras disponíveis
      const cameras = await Html5Qrcode.getCameras();
      
      if (!cameras || cameras.length === 0) {
        throw new Error('Nenhuma câmera encontrada');
      }

      // Preferir câmera traseira (environment)
      let cameraId = cameras[0].id;
      for (const camera of cameras) {
        const label = camera.label.toLowerCase();
        if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('traseira')) {
          cameraId = camera.id;
          break;
        }
      }
      // Se houver mais de uma câmera, geralmente a última é a traseira
      if (cameras.length > 1) {
        cameraId = cameras[cameras.length - 1].id;
      }

      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        () => {} // Ignorar erros durante scan
      );
      
      isStartingRef.current = false;
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      isStartingRef.current = false;
      
      let errorMessage = 'Não foi possível acessar a câmera.';
      if (err.message?.includes('Permission')) {
        errorMessage = 'Permissão de câmera negada. Por favor, permita o acesso.';
      } else if (err.message?.includes('NotReadableError')) {
        errorMessage = 'Câmera em uso por outro aplicativo.';
      } else if (err.message?.includes('NotFoundError') || err.message?.includes('Nenhuma câmera')) {
        errorMessage = 'Nenhuma câmera encontrada neste dispositivo.';
      }
      
      setError(errorMessage);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    isStartingRef.current = false;
    
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
      }
    }
    setScanning(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (processing) return;
    setProcessing(true);
    
    await stopScanner();

    try {
      // Tentar parsear o JSON do QR Code
      let qrData: QRCodeData;
      
      try {
        qrData = JSON.parse(decodedText);
      } catch {
        throw new Error('QR Code inválido');
      }

      // Validar campos obrigatórios
      if (!qrData.qr_token) {
        throw new Error('QR Code inválido');
      }

      if (!qrData.convidado_nome || !qrData.convidado_telefone || !qrData.vendedor || !qrData.quem_convidou) {
        throw new Error('QR Code inválido - campos incompletos');
      }

      // Buscar contato pelo qr_token
      const { data: contato, error: contatoError } = await supabase
        .from('contatos')
        .select('id, status, empresa_id, nome, qr_token_used')
        .eq('qr_token', qrData.qr_token)
        .maybeSingle();

      if (contatoError) {
        console.error('Erro ao buscar contato:', contatoError);
        throw new Error('Erro ao validar QR Code');
      }

      if (!contato) {
        throw new Error('QR Code inválido');
      }

      // Verificar se já foi usado
      if (contato.qr_token_used) {
        toast({
          title: 'Convite já utilizado',
          description: 'Este convite já foi utilizado anteriormente.',
          variant: 'destructive',
        });
        setProcessing(false);
        startScanner();
        return;
      }

      // Verificar se pertence à empresa ativa
      if (activeCompany && contato.empresa_id !== activeCompany.id) {
        throw new Error('Contato não pertence a esta empresa');
      }

      // Atualizar status para Check-in e marcar token como usado
      const { error: updateError } = await supabase
        .from('contatos')
        .update({ 
          status: 'Check-in',
          qr_token_used: true,
          qr_token_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', contato.id);

      if (updateError) {
        throw updateError;
      }

      // Registrar log de movimentação
      const { data: prospeccaoData } = await supabase
        .from('prospeccoes')
        .select('id')
        .eq('empresa_id', contato.empresa_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prospeccaoData) {
        await supabase
          .from('logs_movimentacao_contatos')
          .insert({
            contato_id: contato.id,
            prospeccao_id: prospeccaoData.id,
            status_anterior: contato.status,
            status_novo: 'Check-in',
            observacoes: `Check-in via QR Code - Vendedor: ${qrData.vendedor}, Convidou: ${qrData.quem_convidou}`
          });
      }

      // Mostrar sucesso
      setSuccess(true);
      setSuccessData({ nome: qrData.convidado_nome });

      toast({
        title: 'Check-in realizado com sucesso!',
        description: `${qrData.convidado_nome} fez check-in.`,
      });

      // Aguardar 2 segundos e fechar
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error('Error processing QR code:', err);
      toast({
        title: 'QR Code inválido',
        description: 'Faça o processo novamente ou registre a visita de forma manual.',
        variant: 'destructive',
      });
      setProcessing(false);
      // Restart scanner for another attempt
      setTimeout(() => startScanner(), 500);
    }
  };

  const handleClose = () => {
    stopScanner();
    setError(null);
    setProcessing(false);
    setSuccess(false);
    setSuccessData(null);
    onClose();
  };

  const handleRetry = () => {
    setError(null);
    setProcessing(false);
    startScanner();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Ler QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {success && successData ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-600">Check-in realizado!</h3>
              <p className="text-muted-foreground mt-2">
                {successData.nome} fez check-in com sucesso.
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleRetry} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <div 
                id="qr-reader" 
                className="w-full aspect-square bg-muted rounded-lg overflow-hidden"
                style={{ minHeight: '300px' }}
              />
              <p className="text-sm text-muted-foreground text-center">
                Posicione o QR Code do convite na área de leitura
              </p>
            </>
          )}

          {processing && !success && (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm">Processando...</span>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
