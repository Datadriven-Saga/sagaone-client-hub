import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, Users, Send, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { useToast } from "@/components/ui/use-toast";

interface DispararCustoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  prospeccaoId: string;
  eventoNome: string;
  canal: string;
  totalContatos: number;
}

interface CotacaoData {
  cotacao: number;
  data_cotacao: string;
  loading: boolean;
  error: string | null;
}

const VALOR_UNITARIO_WHATSAPP_USD = 0.06;
const VALOR_UNITARIO_LIGACAO_USD = 1.15;

const DispararCustoModal: React.FC<DispararCustoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  prospeccaoId,
  eventoNome,
  canal,
  totalContatos,
}) => {
  const { user } = useAuth();
  const { tipoAcesso } = useUserAccessType();
  const { toast } = useToast();
  const [cotacao, setCotacao] = useState<CotacaoData>({
    cotacao: 0,
    data_cotacao: '',
    loading: true,
    error: null,
  });
  const [confirmando, setConfirmando] = useState(false);

  const fetchCotacao = async () => {
    setCotacao(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { data, error } = await supabase.functions.invoke('cotacao-dolar');
      if (error) throw error;
      setCotacao({
        cotacao: data.cotacao,
        data_cotacao: data.data_cotacao,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Erro ao buscar cotação:', err);
      setCotacao(prev => ({
        ...prev,
        loading: false,
        error: 'Não foi possível obter a cotação do dólar.',
      }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCotacao();
    }
  }, [isOpen]);

  const isLigacao = String(canal).toLowerCase().includes('liga') || canal === 'Ligação' || canal === 'ligacao';
  const VALOR_UNITARIO_USD = isLigacao ? VALOR_UNITARIO_LIGACAO_USD : VALOR_UNITARIO_WHATSAPP_USD;
  const custoTotalUSD = totalContatos * VALOR_UNITARIO_USD;
  const custoPorPessoaBRL = VALOR_UNITARIO_USD * cotacao.cotacao;
  const custoTotalBRL = custoTotalUSD * cotacao.cotacao;

  const formatUSD = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

  const handleConfirm = async () => {
    if (!user) return;
    setConfirmando(true);
    try {
      // Buscar nome e email do usuário
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nome_completo, tipo_acesso')
        .eq('id', user.id)
        .maybeSingle();

      const userEmail = user.email || '';
      const userName = profileData?.nome_completo || userEmail;
      const userPerfil = profileData?.tipo_acesso || tipoAcesso || '';

      // Registrar log de disparo
      const { error: logError } = await supabase
        .from('logs_disparos')
        .insert({
          usuario_id: user.id,
          usuario_nome: userName,
          usuario_email: userEmail,
          usuario_perfil: userPerfil,
          prospeccao_id: prospeccaoId,
          evento_nome: eventoNome,
          canal: canal,
          total_contatos: totalContatos,
          cotacao_dolar: cotacao.cotacao,
          cotacao_data: cotacao.data_cotacao || new Date().toISOString(),
          custo_total_usd: custoTotalUSD,
          custo_total_brl: custoTotalBRL,
          valor_unitario_usd: VALOR_UNITARIO_USD,
        });

      if (logError) {
        console.error('Erro ao registrar log de disparo:', logError);
        toast({
          title: "Erro",
          description: "Não foi possível registrar o log de disparo. O disparo foi cancelado.",
          variant: "destructive",
        });
        setConfirmando(false);
        return;
      }

      // Log registrado com sucesso, prosseguir com disparo
      onConfirm();
    } catch (err) {
      console.error('Erro ao confirmar disparo:', err);
      toast({
        title: "Erro",
        description: "Erro inesperado ao confirmar disparo.",
        variant: "destructive",
      });
    } finally {
      setConfirmando(false);
    }
  };

  const canalDisplay = String(canal).toLowerCase().includes('liga') || canal === 'Ligação' || canal === 'ligacao'
    ? 'IA Ligação'
    : 'IA WhatsApp';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !confirmando) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5 text-primary" />
            Simulação de Custos do Disparo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info do evento */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Evento</span>
              <span className="text-sm font-medium truncate max-w-[200px]">{eventoNome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Canal</span>
              <Badge variant="outline">{canalDisplay}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total de Pessoas</span>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">{totalContatos.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* Cotação */}
          {cotacao.loading ? (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Buscando cotação do dólar...</span>
            </div>
          ) : cotacao.error ? (
            <div className="bg-destructive/10 rounded-lg p-4 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-destructive mx-auto" />
              <p className="text-sm text-destructive">{cotacao.error}</p>
              <Button variant="outline" size="sm" onClick={fetchCotacao}>
                <RefreshCw className="w-4 h-4 mr-1" /> Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              {/* Cotação do dólar */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cotação USD/BRL</span>
                  <span className="text-lg font-bold text-primary">
                    {formatBRL(cotacao.cotacao)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Obtida em: {new Date(cotacao.data_cotacao).toLocaleString('pt-BR')}
                </p>
              </div>

              {/* Detalhamento de custos */}
              <div className="border rounded-lg divide-y">
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Valor unitário por {isLigacao ? 'ligação' : 'envio'}</span>
                  <span className="text-sm font-medium">{formatUSD(VALOR_UNITARIO_USD)}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Custo por pessoa (BRL)</span>
                  <span className="text-sm font-medium">{formatBRL(custoPorPessoaBRL)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30">
                  <span className="text-sm font-semibold">Custo Total (USD)</span>
                  <span className="text-base font-bold">{formatUSD(custoTotalUSD)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-primary/5">
                  <span className="text-sm font-semibold text-primary">Custo Total (BRL)</span>
                  <span className="text-lg font-bold text-primary">{formatBRL(custoTotalBRL)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={confirmando}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-1" />
            Cancelar Disparo
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={cotacao.loading || !!cotacao.error || confirmando}
            className="flex-1"
          >
            {confirmando ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-1" />
            )}
            Confirmar Disparo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DispararCustoModal;
