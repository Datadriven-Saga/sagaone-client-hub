import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  actionText?: string;
  actionUrl?: string;
  onAction?: () => void;
}

export function DashboardCard({ 
  title, 
  icon: Icon, 
  children, 
  actionText = "Ver detalhes",
  actionUrl,
  onAction 
}: DashboardCardProps) {
  return (
    <Card 
      className="hover:shadow-card transition-shadow cursor-pointer" 
      onClick={onAction}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}