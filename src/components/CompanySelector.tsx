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
          className="flex items-center gap-2 max-w-48"
          disabled={switchingCompany}
        >
          <Building2 className="h-4 w-4" />
          <span className="truncate">{activeCompany.nome_empresa}</span>
          {userCompanies.length > 1 && (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      {userCompanies.length > 1 && (
        <DropdownMenuContent align="end" className="w-64 p-0">
          <ScrollArea className="max-h-80">
            <div className="p-1">
              {userCompanies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => handleCompanySwitch(company.id)}
                  className="flex flex-col items-start p-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium truncate">{company.nome_empresa}</span>
                    {company.id === activeCompany.id && (
                      <Badge variant="default" className="ml-2">Ativa</Badge>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </ScrollArea>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}