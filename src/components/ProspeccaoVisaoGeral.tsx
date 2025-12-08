import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { 
  CheckCircle, 
  RefreshCw, 
  Hourglass, 
  XCircle, 
  Trash2, 
  Upload, 
  History, 
  Users,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProspeccaoMetrics {
  ativosNaProspeccao: number;
  disponiveisDistribuicao: number;
  emEspera: number;
  descartados: number;
  paraExclusao: number;
}

interface FunnelData {
  distribuidosSemAcao: number;
  contatados: number;
  semContato: number;
  convidados: number;
  confirmados: number;
  checkIns: number;
}

interface ProspeccaoVisaoGeralProps {
  metrics: ProspeccaoMetrics;
  funnelData: FunnelData;
  onImportarLeads: () => void;
  onHistoricoImportacao: () => void;
  onClientesPorUsuario: () => void;
  onMetricClick?: (metricType: string) => void;
}

export const ProspeccaoVisaoGeral: React.FC<ProspeccaoVisaoGeralProps> = ({
  metrics,
  funnelData,
  onImportarLeads,
  onHistoricoImportacao,
  onClientesPorUsuario,
  onMetricClick
}) => {
  const metricCards = [
    {
      id: 'ativos',
      label: 'Ativos na Prospecção',
      value: metrics.ativosNaProspeccao,
      icon: CheckCircle,
      highlight: true,
      bgColor: 'bg-primary',
      textColor: 'text-white'
    },
    {
      id: 'disponiveis',
      label: 'Disponíveis para Distribuição',
      value: metrics.disponiveisDistribuicao,
      icon: RefreshCw,
      highlight: false,
      bgColor: 'bg-card',
      textColor: 'text-foreground'
    },
    {
      id: 'emEspera',
      label: 'Em Espera',
      value: metrics.emEspera,
      icon: Hourglass,
      highlight: false,
      bgColor: 'bg-card',
      textColor: 'text-foreground'
    },
    {
      id: 'descartados',
      label: 'Descartados',
      value: metrics.descartados,
      icon: XCircle,
      highlight: false,
      bgColor: 'bg-card',
      textColor: 'text-foreground'
    },
    {
      id: 'paraExclusao',
      label: 'Para Exclusão',
      value: metrics.paraExclusao,
      icon: Trash2,
      highlight: false,
      bgColor: 'bg-card',
      textColor: 'text-foreground'
    }
  ];

  const actionButtons = [
    {
      id: 'importar',
      label: 'Importação de Leads',
      icon: Upload,
      onClick: onImportarLeads
    },
    {
      id: 'historico',
      label: 'Histórico de Importação',
      icon: History,
      onClick: onHistoricoImportacao
    },
    {
      id: 'clientes',
      label: 'Clientes por Usuário',
      icon: Users,
      onClick: onClientesPorUsuario
    }
  ];

  // Calculate funnel widths (percentage based on max value)
  const maxFunnelValue = Math.max(
    funnelData.distribuidosSemAcao,
    funnelData.contatados + funnelData.semContato,
    funnelData.convidados,
    funnelData.confirmados,
    funnelData.checkIns,
    1
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Metrics and Actions */}
      <div className="space-y-2">
        {/* Metric Cards */}
        {metricCards.map((card) => (
          <Card
            key={card.id}
            className={cn(
              "py-2 px-3 cursor-pointer transition-all hover:shadow-md flex items-center justify-between",
              card.bgColor,
              card.highlight && "shadow-lg"
            )}
            onClick={() => onMetricClick?.(card.id)}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center",
                card.highlight ? "bg-white/20" : "bg-primary/10"
              )}>
                <card.icon className={cn(
                  "w-4 h-4",
                  card.highlight ? "text-white" : "text-primary"
                )} />
              </div>
              <span className={cn("text-sm font-medium", card.textColor)}>
                {card.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-lg font-bold", card.textColor)}>
                {card.value.toLocaleString('pt-BR')}
              </span>
              <ChevronRight className={cn("w-4 h-4", card.textColor)} />
            </div>
          </Card>
        ))}

        {/* Action Buttons */}
        <div className="mt-4 space-y-2">
          {actionButtons.map((action) => (
            <Card
              key={action.id}
              className="py-2 px-3 cursor-pointer transition-all hover:shadow-md hover:bg-muted/50 flex items-center justify-between"
              onClick={action.onClick}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <action.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {action.label}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      </div>

      {/* Right Column - Funnel */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Funil de Clientes Ativos</h3>
        </div>

        <div className="space-y-2">
          {/* Distribuídos sem ação */}
          <div 
            className="bg-primary rounded-lg py-2 px-6 text-center text-white"
            style={{ width: '100%' }}
          >
            <div className="text-lg font-bold">{funnelData.distribuidosSemAcao.toLocaleString('pt-BR')}</div>
            <div className="text-xs opacity-90">Distribuídos sem ação</div>
          </div>

          {/* Contatados / Sem contato */}
          <div className="flex gap-3 mx-auto" style={{ width: '85%' }}>
            <div className="flex-1 bg-primary/80 rounded-lg py-2 px-4 text-center text-white">
              <div className="text-base font-bold">{funnelData.contatados.toLocaleString('pt-BR')}</div>
              <div className="text-xs opacity-90">Contatados</div>
            </div>
            <div className="flex-1 bg-primary/60 rounded-lg py-2 px-4 text-center text-white">
              <div className="text-base font-bold">{funnelData.semContato.toLocaleString('pt-BR')}</div>
              <div className="text-xs opacity-90">Sem contato</div>
            </div>
          </div>

          {/* Convidados */}
          <div 
            className="bg-primary/50 rounded-lg py-2 px-4 text-center text-white mx-auto"
            style={{ width: '70%' }}
          >
            <div className="text-base font-bold">{funnelData.convidados.toLocaleString('pt-BR')}</div>
            <div className="text-xs opacity-90">Convidados</div>
          </div>

          {/* Confirmados */}
          <div 
            className="bg-primary/40 rounded-lg py-2 px-4 text-center text-foreground mx-auto"
            style={{ width: '55%' }}
          >
            <div className="text-base font-bold">{funnelData.confirmados.toLocaleString('pt-BR')}</div>
            <div className="text-xs">Confirmados</div>
          </div>

          {/* Check-Ins */}
          <div 
            className="bg-primary/30 rounded-lg py-2 px-4 text-center text-foreground mx-auto"
            style={{ width: '40%' }}
          >
            <div className="text-base font-bold">{funnelData.checkIns.toLocaleString('pt-BR')}</div>
            <div className="text-xs">Check-Ins</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
