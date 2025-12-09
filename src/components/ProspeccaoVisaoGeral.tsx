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
  Filter
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
  novos: number;
  distribuidosSemAcao: number;
  contatados: number;
  semContato: number;
  convidados: number;
  confirmados: number;
  checkIns: number;
  vendas: number;
  descartados: number;
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
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Funil de Vendas</h3>
        </div>

        <div className="space-y-2">
          {/* Novos */}
          <div 
            className="rounded-lg py-2 px-6 text-center text-white"
            style={{ width: '100%', backgroundColor: '#EF4444' }}
          >
            <div className="text-lg font-bold">{funnelData.novos.toLocaleString('pt-BR')}</div>
            <div className="text-xs opacity-90">Novos</div>
          </div>

          {/* Distribuídos sem ação */}
          <div 
            className="rounded-lg py-2 px-6 text-center text-white mx-auto"
            style={{ width: '92%', backgroundColor: '#F97316' }}
          >
            <div className="text-lg font-bold">{funnelData.distribuidosSemAcao.toLocaleString('pt-BR')}</div>
            <div className="text-xs opacity-90">Distribuídos sem ação</div>
          </div>

          {/* Contatados / Sem contato */}
          <div className="flex gap-3 mx-auto" style={{ width: '84%' }}>
            <div 
              className="flex-1 rounded-lg py-2 px-4 text-center text-white"
              style={{ backgroundColor: '#F97316' }}
            >
              <div className="text-base font-bold">{funnelData.contatados.toLocaleString('pt-BR')}</div>
              <div className="text-xs opacity-90">Contatados</div>
            </div>
            <div 
              className="flex-1 rounded-lg py-2 px-4 text-center text-white"
              style={{ backgroundColor: '#F97316' }}
            >
              <div className="text-base font-bold">{funnelData.semContato.toLocaleString('pt-BR')}</div>
              <div className="text-xs opacity-90">Sem contato</div>
            </div>
          </div>

          {/* Convidados */}
          <div 
            className="rounded-lg py-2 px-4 text-center text-white mx-auto"
            style={{ width: '70%', backgroundColor: '#84CC16' }}
          >
            <div className="text-base font-bold">{funnelData.convidados.toLocaleString('pt-BR')}</div>
            <div className="text-xs opacity-90">Convidados</div>
          </div>

          {/* Confirmados */}
          <div 
            className="rounded-lg py-2 px-4 text-center text-white mx-auto"
            style={{ width: '55%', backgroundColor: '#22C55E' }}
          >
            <div className="text-base font-bold">{funnelData.confirmados.toLocaleString('pt-BR')}</div>
            <div className="text-xs opacity-90">Confirmados</div>
          </div>

          {/* Check-Ins */}
          <div 
            className="rounded-lg py-2 px-4 text-center text-white mx-auto"
            style={{ width: '40%', backgroundColor: '#16A34A' }}
          >
            <div className="text-base font-bold">{funnelData.checkIns.toLocaleString('pt-BR')}</div>
            <div className="text-xs opacity-90">Check-Ins</div>
          </div>

          {/* Vendas + Balde Descartados */}
          <div className="flex items-end justify-center gap-4">
            {/* Vendas */}
            <div 
              className="rounded-lg py-2 px-4 text-center text-white"
              style={{ width: '28%', backgroundColor: '#3B82F6' }}
            >
              <div className="text-base font-bold">{funnelData.vendas.toLocaleString('pt-BR')}</div>
              <div className="text-xs opacity-90">Vendas</div>
            </div>

            {/* Balde Descartados */}
            <div className="flex flex-col items-center">
              <div 
                className="relative flex items-center justify-center"
                style={{ width: '70px', height: '60px' }}
              >
                {/* Balde SVG */}
                <svg 
                  viewBox="0 0 64 64" 
                  className="w-full h-full"
                  fill="none"
                >
                  {/* Borda superior do balde */}
                  <ellipse cx="32" cy="12" rx="26" ry="6" fill="#6B7280" />
                  <ellipse cx="32" cy="12" rx="22" ry="4" fill="#9CA3AF" />
                  
                  {/* Corpo do balde */}
                  <path 
                    d="M6 12 L12 54 C12 58 21 60 32 60 C43 60 52 58 52 54 L58 12" 
                    fill="#6B7280" 
                  />
                  <path 
                    d="M10 12 L15 52 C15 55 22 57 32 57 C42 57 49 55 49 52 L54 12" 
                    fill="#9CA3AF" 
                  />
                  
                  {/* Base do balde */}
                  <ellipse cx="32" cy="54" rx="18" ry="4" fill="#6B7280" />
                </svg>
                
                {/* Número dentro do balde */}
                <div className="absolute inset-0 flex items-center justify-center pt-3">
                  <span className="text-white font-bold text-sm drop-shadow-md">
                    {funnelData.descartados.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground mt-1">Descartados</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
