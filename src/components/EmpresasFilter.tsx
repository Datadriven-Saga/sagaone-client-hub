import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";

interface FilterCriteria {
  nome: string;
  marca: string;
  uf: string;
  cnpj: string;
  crmId: string;
}

interface EmpresasFilterProps {
  onFilterChange: (filters: FilterCriteria) => void;
  className?: string;
}

export function EmpresasFilter({ onFilterChange, className = "" }: EmpresasFilterProps) {
  const [filters, setFilters] = useState<FilterCriteria>({
    nome: "",
    marca: "",
    uf: "",
    cnpj: "",
    crmId: ""
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (field: keyof FilterCriteria, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    const emptyFilters = {
      nome: "",
      marca: "",
      uf: "",
      cnpj: "",
      crmId: ""
    };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const hasActiveFilters = Object.values(filters).some(value => value.trim() !== "");

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Label className="font-semibold">Filtros</Label>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Recolher" : "Expandir"}
            </Button>
          </div>
        </div>

        {/* Filtros sempre visíveis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="filter-nome">Nome da Empresa</Label>
            <Input
              id="filter-nome"
              placeholder="Filtrar por nome..."
              value={filters.nome}
              onChange={(e) => handleFilterChange("nome", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-marca">Marca</Label>
            <Input
              id="filter-marca"
              placeholder="Filtrar por marca..."
              value={filters.marca}
              onChange={(e) => handleFilterChange("marca", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-uf">UF</Label>
            <Input
              id="filter-uf"
              placeholder="SP, RJ, MG..."
              value={filters.uf}
              onChange={(e) => handleFilterChange("uf", e.target.value)}
            />
          </div>
        </div>

        {/* Filtros expandidos */}
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="filter-cnpj">CNPJ</Label>
              <Input
                id="filter-cnpj"
                placeholder="00.000.000/0000-00"
                value={filters.cnpj}
                onChange={(e) => handleFilterChange("cnpj", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-crm-id">CRM ID</Label>
              <Input
                id="filter-crm-id"
                placeholder="ID do CRM..."
                value={filters.crmId}
                onChange={(e) => handleFilterChange("crmId", e.target.value)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}