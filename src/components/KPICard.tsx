import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  description?: string;
  subtitle?: string;
  trend?: 'up' | 'down';
}

export function KPICard({ title, value, icon: Icon, change, description, subtitle, trend }: KPICardProps) {
  return (
    <Card>
      <CardContent className="p-3 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm font-medium text-muted-foreground mb-0.5 md:mb-1 truncate">
              {title}
            </p>
            <p className="text-lg md:text-2xl font-bold text-foreground">
              {value}
            </p>
            {(description || subtitle) && (
              <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 truncate">
                {description || subtitle}
              </p>
            )}
          </div>
          <div className="p-2 md:p-3 rounded-full bg-primary/10 flex-shrink-0">
            <Icon className="h-4 w-4 md:h-6 md:w-6 text-primary" />
          </div>
        </div>
        
        {(change || trend) && (
          <div className="flex items-center mt-4 text-sm">
            {trend === 'up' || change?.type === 'increase' ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            {change ? (
              <>
                <span className={change.type === 'increase' ? 'text-green-600' : 'text-red-600'}>
                  {change.value > 0 ? '+' : ''}{change.value}%
                </span>
                <span className="text-muted-foreground ml-1">
                  vs. mês anterior
                </span>
              </>
            ) : (
              <span className={trend === 'up' ? 'text-green-600' : 'text-red-600'}>
                Tendência {trend === 'up' ? 'positiva' : 'negativa'}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}