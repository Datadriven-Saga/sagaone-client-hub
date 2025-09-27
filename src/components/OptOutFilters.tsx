import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import type { OptOutFilters as OptOutFiltersType } from "@/pages/ControleOptOut";

interface OptOutFiltersProps {
  filters: OptOutFiltersType;
  onFiltersChange: (filters: OptOutFiltersType) => void;
}

export function OptOutFilters({ filters, onFiltersChange }: OptOutFiltersProps) {
  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome_empresa")
        .order("nome_empresa");
      if (error) throw error;
      return data;
    },
  });

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      canal: "",
      empresa: "",
      dataInicio: "",
      dataFim: "",
    });
  };

  const hasActiveFilters = 
    filters.canal || 
    filters.empresa || 
    filters.dataInicio || 
    filters.dataFim;

  return (
    <div className="border-t pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Filtros Avançados</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Canal Filter */}
        <div>
          <Label htmlFor="canal-filter" className="text-sm">Canal</Label>
          <Select
            value={filters.canal}
            onValueChange={(value) => 
              onFiltersChange({ ...filters, canal: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os canais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os canais</SelectItem>
              <SelectItem value="Whatsapp">WhatsApp</SelectItem>
              <SelectItem value="E-mail">E-mail</SelectItem>
              <SelectItem value="SMS">SMS</SelectItem>
              <SelectItem value="Ligação">Ligação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Empresa Filter */}
        <div>
          <Label htmlFor="empresa-filter" className="text-sm">Empresa</Label>
          <Select
            value={filters.empresa}
            onValueChange={(value) => 
              onFiltersChange({ ...filters, empresa: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as empresas</SelectItem>
              {empresas?.map((empresa) => (
                <SelectItem key={empresa.id} value={empresa.id}>
                  {empresa.nome_empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data Início */}
        <div>
          <Label htmlFor="data-inicio" className="text-sm">Data Início</Label>
          <Input
            id="data-inicio"
            type="date"
            value={filters.dataInicio}
            onChange={(e) =>
              onFiltersChange({ ...filters, dataInicio: e.target.value })
            }
          />
        </div>

        {/* Data Fim */}
        <div>
          <Label htmlFor="data-fim" className="text-sm">Data Fim</Label>
          <Input
            id="data-fim"
            type="date"
            value={filters.dataFim}
            onChange={(e) =>
              onFiltersChange({ ...filters, dataFim: e.target.value })
            }
          />
        </div>
      </div>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-2">
          {filters.canal && (
            <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm">
              <span>Canal: {filters.canal}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => onFiltersChange({ ...filters, canal: "" })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          {filters.empresa && (
            <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm">
              <span>
                Empresa: {empresas?.find(e => e.id === filters.empresa)?.nome_empresa || filters.empresa}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => onFiltersChange({ ...filters, empresa: "" })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          {filters.dataInicio && (
            <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm">
              <span>A partir de: {filters.dataInicio}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => onFiltersChange({ ...filters, dataInicio: "" })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          {filters.dataFim && (
            <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm">
              <span>Até: {filters.dataFim}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 ml-1"
                onClick={() => onFiltersChange({ ...filters, dataFim: "" })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}