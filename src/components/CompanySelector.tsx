import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CompanySelector() {
  const { activeCompany, userCompanies, loading, switchCompany } = useCompany();
  const [switchingCompany, setSwitchingCompany] = useState(false);

  if (loading) {
    return <Skeleton className="h-10 w-48" />;
  }

  if (!activeCompany || userCompanies.length === 0) {
    return null;
  }

  const handleCompanySwitch = async (companyId: string) => {
    if (companyId === activeCompany.id) return;
    
    setSwitchingCompany(true);
    await switchCompany(companyId);
    setSwitchingCompany(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 max-w-56"
          disabled={switchingCompany}
        >
          <Building2 className="h-4 w-4" />
          <span className="truncate">{activeCompany.nome_empresa}</span>
          {userCompanies.length > 1 && (
            <>
              <Badge variant="secondary" className="text-xs ml-1">
                {userCompanies.length}
              </Badge>
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      {userCompanies.length > 1 && (
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="max-h-[70vh] flex flex-col">
            <div className="p-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
              {userCompanies.length} empresas disponíveis
            </div>
            <ScrollArea className="flex-1">
              <div className="p-1">
                {userCompanies.map((company) => (
                  <DropdownMenuItem
                    key={company.id}
                    onClick={() => handleCompanySwitch(company.id)}
                    className="flex items-center justify-between p-2 cursor-pointer hover:bg-accent rounded-sm"
                  >
                    <span className="font-medium truncate text-sm pr-2" title={company.nome_empresa}>
                      {company.nome_empresa}
                    </span>
                    {company.id === activeCompany.id && (
                      <Badge variant="default" className="text-xs">Ativa</Badge>
                    )}
                  </DropdownMenuItem>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}