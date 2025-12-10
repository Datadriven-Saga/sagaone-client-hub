import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Phone, CheckCircle, XCircle, PhoneOff, MessageSquare } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

interface MotivoNaoParticipacao {
  id: string;
  descricao: string;
}

interface ContatoRealizadoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contatoId: string;
  prospeccaoId: string;
  onSuccess?: () => void;
}

type TipoContato = 'vai_participar' | 'registrar_contato' | 'tentativa_sem_sucesso' | 'nao_vai_participar';

export function ContatoRealizadoDialog({
  isOpen,
  onClose,
  contatoId,
  prospeccaoId,
  onSuccess
}: ContatoRealizadoDialogProps) {
  const [tipoContato, setTipoContato] = useState<TipoContato | ''>('');
  const [motivoId, setMotivoId] = useState<string>('');
  const [anotacao, setAnotacao] = useState('');
  const [motivos, setMotivos] = useState<MotivoNaoParticipacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMotivos, setLoadingMotivos] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMotivos = async () => {
      if (!isOpen) return;
      
      setLoadingMotivos(true);
      try {
        const { data, error } = await supabase
          .from('motivos_nao_participacao')
          .select('id, descricao')
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
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!tipoContato) {
      toast({
        title: "Selecione uma opção",
        description: "Escolha o tipo de contato realizado",
        variant: "destructive"
      });
      return;
    }

    if (!anotacao.trim()) {
      toast({
        title: "Anotação obrigatória",
        description: "Detalhe o contato realizado",
        variant: "destructive"
      });
      return;
    }

    if (tipoContato === 'nao_vai_participar' && !motivoId) {
      toast({
        title: "Motivo obrigatório",
        description: "Selecione o motivo da não participação",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Montar a descrição da anotação
      const tipoDescricao = {
        vai_participar: '✅ CLIENTE VAI PARTICIPAR',
        registrar_contato: '📞 CONTATO REALIZADO',
        tentativa_sem_sucesso: '📵 TENTATIVA SEM SUCESSO',
        nao_vai_participar: '❌ CLIENTE NÃO VAI PARTICIPAR'
      };

      let descricaoCompleta = `${tipoDescricao[tipoContato]}\n\n${anotacao}`;

      // Se não vai participar, adicionar o motivo
      if (tipoContato === 'nao_vai_participar' && motivoId) {
        const motivoSelecionado = motivos.find(m => m.id === motivoId);
        if (motivoSelecionado) {
          descricaoCompleta += `\n\nMotivo: ${motivoSelecionado.descricao}`;
        }
      }

      // Salvar anotação via edge function
      const { error } = await supabase.functions.invoke('prospeccao-anotacao', {
        body: {
          prospeccao_id: prospeccaoId,
          contato_id: contatoId,
          mensagem: descricaoCompleta
        }
      });

      // Atualizar status do contato baseado no tipo de contato
      type StatusLead = Database['public']['Enums']['status_lead'];
      
      let novoStatus: StatusLead | null = null;
      
      if (tipoContato === 'vai_participar') {
        novoStatus = 'Convidado';
      } else if (tipoContato === 'registrar_contato') {
        novoStatus = 'Em Espera';
      } else if (tipoContato === 'tentativa_sem_sucesso') {
        novoStatus = 'Em Espera';
      } else if (tipoContato === 'nao_vai_participar') {
        novoStatus = 'Descartado';
      }

      if (novoStatus) {
        const { error: updateError } = await supabase
          .from('contatos')
          .update({ status: novoStatus })
          .eq('id', contatoId);

        if (updateError) {
          console.error('Erro ao atualizar status:', updateError);
        }
      }

      if (error) throw error;

      toast({
        title: "Contato registrado",
        description: "O contato foi registrado com sucesso"
      });

      // Reset form
      setTipoContato('');
      setMotivoId('');
      setAnotacao('');
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Erro ao registrar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar contato. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTipoContato('');
    setMotivoId('');
    setAnotacao('');
    onClose();
  };

  const opcoes = [
    {
      value: 'vai_participar' as TipoContato,
      label: 'O cliente VAI PARTICIPAR',
      description: 'O cliente confirmou presença no evento',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      value: 'registrar_contato' as TipoContato,
      label: 'Registrar apenas contato',
      description: 'Contato realizado, sem definição ainda',
      icon: MessageSquare,
      color: 'text-blue-600'
    },
    {
      value: 'tentativa_sem_sucesso' as TipoContato,
      label: 'Tentativa sem sucesso',
      description: 'Não conseguiu contato (não atendeu, caixa postal, etc)',
      icon: PhoneOff,
      color: 'text-amber-600'
    },
    {
      value: 'nao_vai_participar' as TipoContato,
      label: 'O cliente NÃO VAI PARTICIPAR',
      description: 'Cliente informou que não participará',
      icon: XCircle,
      color: 'text-red-600'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg h-[80vh] max-h-[600px] flex flex-col p-0">
        {/* Header fixo */}
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contato Realizado
          </DialogTitle>
          <DialogDescription>
            Registre o resultado do contato com o cliente
          </DialogDescription>
        </DialogHeader>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-6 py-4">
          <div className="space-y-5">
            {/* Tipo de Contato */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Resultado do Contato</Label>
              <RadioGroup
                value={tipoContato}
                onValueChange={(value) => setTipoContato(value as TipoContato)}
                className="space-y-2"
              >
                {opcoes.map((opcao) => {
                  const Icon = opcao.icon;
                  return (
                    <div
                      key={opcao.value}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        tipoContato === opcao.value 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setTipoContato(opcao.value)}
                    >
                      <RadioGroupItem value={opcao.value} id={opcao.value} className="mt-0.5" />
                      <div className="flex-1">
                        <label
                          htmlFor={opcao.value}
                          className="flex items-center gap-2 font-medium text-sm cursor-pointer"
                        >
                          <Icon className={`w-4 h-4 ${opcao.color}`} />
                          {opcao.label}
                        </label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {opcao.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Motivo de Não Participação */}
            {tipoContato === 'nao_vai_participar' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Motivo da Não Participação *</Label>
                <Select value={motivoId} onValueChange={setMotivoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingMotivos ? (
                      <SelectItem value="loading" disabled>
                        Carregando...
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
            )}

            {/* Anotação */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Detalhes do Contato *
              </Label>
              <Textarea
                placeholder="Descreva os detalhes do contato realizado..."
                value={anotacao}
                onChange={(e) => setAnotacao(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {anotacao.length}/500 caracteres
              </p>
            </div>
          </div>
        </div>

        {/* Footer fixo */}
        <DialogFooter className="p-6 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !tipoContato}>
            {loading ? "Registrando..." : "Registrar Contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
