import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
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
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ nome: string } | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const hasProcessedRef = useRef(false);
  const { toast } = useToast();
  const { activeCompany } = useCompany();

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    // Evitar processamento duplicado
    if (hasProcessedRef.current || processing) return;
    hasProcessedRef.current = true;
    setProcessing(true);

    console.log('QR Code scanned:', decodedText);

    try {
      // Tentar parsear o JSON do QR Code
      let qrData: QRCodeData;
      
      try {
        qrData = JSON.parse(decodedText);
      } catch {
        throw new Error('QR Code inválido - formato incorreto');
      }

      // Validar campos obrigatórios
      if (!qrData.qr_token) {
        throw new Error('QR Code inválido - token ausente');
      }

      if (!qrData.convidado_nome || !qrData.convidado_telefone || !qrData.vendedor || !qrData.quem_convidou) {
        throw new Error('QR Code inválido - campos incompletos');
      }

      console.log('QR Data parsed:', qrData);

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
        throw new Error('QR Code não encontrado no sistema');
      }

      // Verificar se já foi usado
      if (contato.qr_token_used) {
        toast({
          title: 'Convite já utilizado',
          description: 'Este convite já foi utilizado anteriormente.',
          variant: 'destructive',
        });
        hasProcessedRef.current = false;
        setProcessing(false);
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
        description: err.message || 'Faça o processo novamente ou registre a visita de forma manual.',
        variant: 'destructive',
      });
      hasProcessedRef.current = false;
      setProcessing(false);
    }
  }, [activeCompany, toast, onSuccess, onClose, processing]);

  useEffect(() => {
    if (isOpen && !success && !scannerRef.current) {
      // Aguardar o elemento estar no DOM
      const timer = setTimeout(() => {
        const element = document.getElementById('qr-reader');
        if (!element) {
          console.error('QR reader element not found');
          return;
        }

        try {
          const scanner = new Html5QrcodeScanner(
            'qr-reader',
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              rememberLastUsedCamera: true,
              supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            },
            /* verbose= */ false
          );

          scanner.render(
            handleScanSuccess,
            (errorMessage) => {
              // Ignorar erros de scan - são normais quando não há QR code na frente
              console.log('Scan error (normal):', errorMessage);
            }
          );

          scannerRef.current = scanner;
          console.log('Scanner initialized successfully');
        } catch (err) {
          console.error('Error initializing scanner:', err);
          setError('Não foi possível inicializar o scanner. Verifique as permissões da câmera.');
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isOpen, success, handleScanSuccess]);

  const cleanupScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
        console.log('Scanner cleared');
      } catch (err) {
        console.error('Error clearing scanner:', err);
      }
      scannerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    cleanupScanner();
    setError(null);
    setProcessing(false);
    setSuccess(false);
    setSuccessData(null);
    hasProcessedRef.current = false;
    onClose();
  }, [cleanupScanner, onClose]);

  const handleRetry = useCallback(() => {
    cleanupScanner();
    setError(null);
    setProcessing(false);
    hasProcessedRef.current = false;
    
    // Re-initialize after cleanup
    setTimeout(() => {
      const element = document.getElementById('qr-reader');
      if (!element) return;

      try {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          },
          false
        );

        scanner.render(handleScanSuccess, () => {});
        scannerRef.current = scanner;
      } catch (err) {
        console.error('Error reinitializing scanner:', err);
        setError('Não foi possível reiniciar o scanner.');
      }
    }, 300);
  }, [cleanupScanner, handleScanSuccess]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, [cleanupScanner]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Ler QR Code
          </DialogTitle>
          <DialogDescription>
            Posicione o QR Code do convite na área de leitura
          </DialogDescription>
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
            <div 
              id="qr-reader" 
              className="w-full min-h-[350px] bg-muted rounded-lg overflow-hidden"
            />
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
