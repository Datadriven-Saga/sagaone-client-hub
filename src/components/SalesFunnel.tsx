import { Card } from "@/components/ui/card";

export interface FunnelStage {
  id: string;
  title: string;
  value: number;
  color: string;
}

interface SalesFunnelProps {
  stages: FunnelStage[];
  title?: string;
}

export const SalesFunnel = ({ stages, title = "Funil de Vendas" }: SalesFunnelProps) => {
  // Encontrar o valor máximo para calcular as proporções
  const maxValue = Math.max(...stages.map(stage => stage.value));
  
  // Calcular percentual de conversão entre estágios
  const getConversionRate = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) return 0;
    return Math.round((currentValue / previousValue) * 100);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-6 text-center">{title}</h3>
      
      <div className="flex flex-col items-center space-y-1 max-w-md mx-auto">
        {stages.map((stage, index) => {
          // Larguras fixas progressivamente menores para criar o formato de funil
          const funnelWidths = [100, 85, 70, 55, 40]; // Porcentagens de largura para cada nível
          const widthPercentage = funnelWidths[Math.min(index, funnelWidths.length - 1)];
          const previousStage = index > 0 ? stages[index - 1] : null;
          const conversionRate = previousStage ? getConversionRate(stage.value, previousStage.value) : 100;
          
          return (
            <div key={stage.id} className="w-full">
              {/* Estágio do funil */}
              <div className="flex items-center justify-center relative">
                <div
                  className="relative flex flex-col items-center justify-center text-foreground font-semibold shadow-sm transition-all duration-300 hover:shadow-md group border border-muted"
                  style={{
                    backgroundColor: stage.color,
                    width: `${widthPercentage}%`,
                    height: '80px',
                    borderRadius: '4px'
                  }}
                >
                  {/* Conteúdo do estágio */}
                  <div className="text-center text-white">
                    <div className="text-2xl font-bold">{stage.value.toLocaleString()}</div>
                    <div className="text-sm font-medium">{stage.title}</div>
                  </div>

                  {/* Tooltip hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                    {stage.title}: {stage.value.toLocaleString()}
                    {previousStage && (
                      <div>Taxa de conversão: {conversionRate}%</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Taxa de conversão entre estágios */}
              {index > 0 && (
                <div className="flex justify-center my-2">
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full border">
                    {conversionRate}%
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumo no final */}
      <div className="mt-6 pt-4 border-t border-muted">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center">
            <div className="text-muted-foreground">Total Inicial</div>
            <div className="font-semibold text-lg">{stages[0]?.value.toLocaleString() || 0}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Total Final</div>
            <div className="font-semibold text-lg text-green-600">
              {stages[stages.length - 1]?.value.toLocaleString() || 0}
            </div>
          </div>
        </div>
        
        {/* Taxa de conversão geral */}
        <div className="text-center mt-3">
          <div className="text-xs text-muted-foreground">Taxa de conversão geral</div>
          <div className="font-semibold text-sm">
            {stages.length > 0 && stages[0].value > 0 
              ? Math.round((stages[stages.length - 1].value / stages[0].value) * 100)
              : 0
            }%
          </div>
        </div>
      </div>
    </Card>
  );
};