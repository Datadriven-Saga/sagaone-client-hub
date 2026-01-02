import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface MotivoInsucesso {
  id: string;
  descricao: string;
}

interface DescarteLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  contatoId: string;
  contatoNome: string;
  onConfirm: (motivoId: string, justificativa: string) => void;
}

export function DescarteLeadModal({
  isOpen,
  onClose,
  contatoId,
  contatoNome,
  onConfirm
}: DescarteLeadModalProps) {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [motivoId, setMotivoId] = useState<string>('');
  const [justificativa, setJustificativa] = useState('');
  const [motivos, setMotivos] = useState<MotivoInsucesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMotivos, setLoadingMotivos] = useState(true);

  useEffect(() => {
    const fetchMotivos = async () => {
      if (!isOpen || !activeCompany?.id) return;
      
      setLoadingMotivos(true);
      try {
        const { data, error } = await supabase
          .from('motivos_insucesso')
          .select('id, descricao')
          .eq('empresa_id', activeCompany.id)
          .eq('ativo', true)
          .order('ordem');

        if (error) throw error;
        setMotivos(data || []);
      } catch (error) {
        console.error('Erro ao buscar motivos:', error);
      } finally {
        setLoadingMotivos(false);
      }
    };

    fetchMotivos();
  }, [isOpen, activeCompany?.id]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMotivoId('');
      setJustificativa('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!motivoId) {
      toast({
        title: "Selecione um motivo",
        description: "É obrigatório selecionar um motivo de insucesso",
        variant: "destructive"
      });
      return;
    }

    if (justificativa.trim().length < 10) {
      toast({
        title: "Justificativa muito curta",
        description: "A justificativa deve ter pelo menos 10 caracteres",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      onConfirm(motivoId, justificativa.trim());
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMotivoId('');
    setJustificativa('');
    onClose();
  };

  const isValid = motivoId && justificativa.trim().length >= 10;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Descartar Lead
          </DialogTitle>
          <DialogDescription>
            Você está prestes a descartar o lead <strong>{contatoNome}</strong>. 
            Por favor, informe o motivo e uma justificativa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Motivo de Insucesso *</Label>
            <Select value={motivoId} onValueChange={setMotivoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {loadingMotivos ? (
                  <SelectItem value="loading" disabled>
                    Carregando...
                  </SelectItem>
                ) : motivos.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    Nenhum motivo cadastrado
                  </SelectItem>
                ) : (
                  motivos.map((motivo) => (
                    <SelectItem key={motivo.id} value={motivo.id}>
                      {motivo.descricao}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Justificativa * <span className="text-muted-foreground font-normal">(mínimo 10 caracteres)</span>
            </Label>
            <Textarea
              placeholder="Descreva o motivo do descarte..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              maxLength={500}
              rows={4}
              className={justificativa.length > 0 && justificativa.length < 10 ? 'border-destructive' : ''}
            />
            <p className={`text-xs text-right ${justificativa.length > 0 && justificativa.length < 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {justificativa.length}/500 caracteres
              {justificativa.length > 0 && justificativa.length < 10 && (
                <span className="ml-2">(faltam {10 - justificativa.length} caracteres)</span>
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit} 
            disabled={loading || !isValid}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Descartando...
              </>
            ) : (
              'Confirmar Descarte'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
