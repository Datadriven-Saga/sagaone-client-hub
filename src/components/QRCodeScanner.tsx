import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface QRCodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function QRCodeScanner({ isOpen, onClose, onSuccess }: QRCodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();
  const { activeCompany } = useCompany();

  useEffect(() => {
    if (isOpen) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    setError(null);
    setScanning(true);

    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScanSuccess,
        () => {} // Ignore errors during scanning
      );
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setScanning(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (processing) return;
    setProcessing(true);
    
    await stopScanner();

    try {
      // Validate QR code format
      // Expected format: URL with contatoId and action parameters
      // Example: https://app.domain.com/checkin?contatoId=xxx&prospeccaoId=yyy
      const url = new URL(decodedText);
      const contatoId = url.searchParams.get('contatoId');
      const prospeccaoId = url.searchParams.get('prospeccaoId');

      if (!contatoId || !prospeccaoId) {
        throw new Error('QR Code inválido');
      }

      // Verify the contact exists and belongs to the active company
      const { data: contato, error: contatoError } = await supabase
        .from('contatos')
        .select('id, status, empresa_id')
        .eq('id', contatoId)
        .maybeSingle();

      if (contatoError || !contato) {
        throw new Error('Contato não encontrado');
      }

      if (activeCompany && contato.empresa_id !== activeCompany.id) {
        throw new Error('Contato não pertence a esta empresa');
      }

      // Update contact status to Check-in
      const { error: updateError } = await supabase
        .from('contatos')
        .update({ 
          status: 'Check-in',
          updated_at: new Date().toISOString()
        })
        .eq('id', contatoId);

      if (updateError) {
        throw updateError;
      }

      // Log the status change
      await supabase
        .from('logs_movimentacao_contatos')
        .insert({
          contato_id: contatoId,
          prospeccao_id: prospeccaoId,
          status_anterior: contato.status,
          status_novo: 'Check-in',
          observacoes: 'Check-in via leitura de QR Code'
        });

      toast({
        title: 'Check-in realizado!',
        description: 'O status do lead foi alterado para Check-in.',
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error processing QR code:', err);
      toast({
        title: 'QR Code inválido',
        description: 'Faça o processo novamente ou registre a visita de forma manual.',
        variant: 'destructive',
      });
      setProcessing(false);
      // Restart scanner for another attempt
      startScanner();
    }
  };

  const handleClose = () => {
    stopScanner();
    setError(null);
    setProcessing(false);
    onClose();
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
          {error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={startScanner} className="mt-4">
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <div 
                id="qr-reader" 
                className="w-full aspect-square bg-muted rounded-lg overflow-hidden"
              />
              <p className="text-sm text-muted-foreground text-center">
                Posicione o QR Code do convite na área de leitura
              </p>
            </>
          )}

          {processing && (
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
