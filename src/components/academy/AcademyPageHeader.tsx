import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

interface AcademyPageHeaderProps {
  title: string;
  description?: string;
  backPath?: string;
  showBackButton?: boolean;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function AcademyPageHeader({
  title,
  description,
  backPath = "/treinamentos",
  showBackButton = true,
  icon,
  actions,
}: AcademyPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backPath)}
            className="h-9 w-9 flex-shrink-0 -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-xl bg-sagaone-login-card/10 flex-shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
