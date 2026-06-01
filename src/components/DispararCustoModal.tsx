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
import { Loader2, DollarSign, Users, Send, X, AlertTriangle, RefreshCw, TrendingUp, PhoneCall, MessageCircle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
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
const VALOR_UNITARIO_LIGACAO_BRL = 1.15; // R$ 1,15 por minuto ligado

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
  const { activeCompany } = useCompany();
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

  // Ligação: R$ 1,15/min (BRL direto, sem dólar)
  // WhatsApp: US$ 0,06/envio (convertido via cotação)
  const custoTotalBRL = isLigacao
    ? totalContatos * VALOR_UNITARIO_LIGACAO_BRL
    : totalContatos * VALOR_UNITARIO_WHATSAPP_USD * cotacao.cotacao;
  const custoTotalUSD = isLigacao
    ? custoTotalBRL / (cotacao.cotacao || 1)
    : totalContatos * VALOR_UNITARIO_WHATSAPP_USD;
  const custoPorPessoaBRL = isLigacao
    ? VALOR_UNITARIO_LIGACAO_BRL
    : VALOR_UNITARIO_WHATSAPP_USD * cotacao.cotacao;
  const VALOR_UNITARIO_USD = isLigacao ? VALOR_UNITARIO_LIGACAO_BRL / (cotacao.cotacao || 1) : VALOR_UNITARIO_WHATSAPP_USD;

  const formatUSD = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

  const handleConfirm = async () => {
    if (!user) return;
    setConfirmando(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nome_completo, tipo_acesso')
        .eq('id', user.id)
        .maybeSingle();

      const userEmail = user.email || '';
      const userName = profileData?.nome_completo || userEmail;
      const userPerfil = profileData?.tipo_acesso || tipoAcesso || '';

      const { error: logError } = await supabase
        .from('logs_disparos')
        .insert({
          usuario_id: user.id,
          usuario_nome: userName,
          usuario_email: userEmail,
          usuario_perfil: userPerfil,
          prospeccao_id: prospeccaoId,
          empresa_id: activeCompany?.id ?? null,
          marca: activeCompany?.marca ?? null,
          uf: activeCompany?.uf ?? null,
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

  const canalDisplay = isLigacao ? 'IA Ligação' : 'IA WhatsApp';
  const CanalIcon = isLigacao ? PhoneCall : MessageCircle;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !confirmando) onClose(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            Simulação de Custos do Disparo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Info do evento */}
          <div className="bg-muted/50 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Evento</span>
              <span className="text-sm font-semibold truncate max-w-[280px]">{eventoNome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Canal</span>
              <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
                <CanalIcon className="w-3.5 h-3.5" />
                {canalDisplay}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total de Pessoas</span>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-lg font-bold">{totalContatos.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* Cotação - só carrega para WhatsApp */}
          {!isLigacao && cotacao.loading ? (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Buscando cotação do dólar...</span>
            </div>
          ) : !isLigacao && cotacao.error ? (
            <div className="bg-destructive/10 rounded-xl p-6 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive font-medium">{cotacao.error}</p>
              <Button variant="outline" size="sm" onClick={fetchCotacao}>
                <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              {/* Cotação do dólar - só para WhatsApp */}
              {!isLigacao && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Cotação USD/BRL</span>
                    </div>
                    <span className="text-xl font-bold text-primary">
                      {formatBRL(cotacao.cotacao)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Obtida em: {new Date(cotacao.data_cotacao).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}

              {/* Detalhamento de custos */}
              <div className="border rounded-xl overflow-hidden divide-y">
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    Valor unitário por {isLigacao ? 'minuto ligado' : 'envio'}
                  </span>
                  <span className="text-sm font-semibold">
                    {isLigacao ? formatBRL(VALOR_UNITARIO_LIGACAO_BRL) : formatUSD(VALOR_UNITARIO_WHATSAPP_USD)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm text-muted-foreground">Custo por pessoa (BRL)</span>
                  <span className="text-sm font-semibold">{formatBRL(custoPorPessoaBRL)}</span>
                </div>
                {!isLigacao && (
                  <div className="flex items-center justify-between p-4 bg-muted/40">
                    <span className="font-semibold">Custo Total (USD)</span>
                    <span className="text-lg font-bold">{formatUSD(custoTotalUSD)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-4 bg-primary/10">
                  <span className="font-semibold text-primary">Custo Total (BRL)</span>
                  <span className="text-2xl font-bold text-primary">{formatBRL(custoTotalBRL)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-3 sm:gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={confirmando}
            className="flex-1 h-12 text-base"
          >
            <X className="w-5 h-5 mr-2" />
            Cancelar Disparo
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={(!isLigacao && (cotacao.loading || !!cotacao.error)) || confirmando}
            className="flex-1 h-12 text-base"
          >
            {confirmando ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Send className="w-5 h-5 mr-2" />
            )}
            Confirmar Disparo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DispararCustoModal;
