import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface ProspeccaoGlobalFilters {
  prospeccaoId: string;
  dataInicio: string;
  dataFim: string;
  responsavelId: string;
  status: string;
  dadosLead: string;
}

interface Prospeccao {
  id: string;
  titulo: string;
}

interface Responsavel {
  id: string;
  nome_completo: string;
  tipo_acesso: string | null;
}

interface ProspeccaoGlobalFilterProps {
  prospeccoes: Prospeccao[];
  responsaveis: Responsavel[];
  filters: ProspeccaoGlobalFilters;
  onFiltersChange: (filters: ProspeccaoGlobalFilters) => void;
  className?: string;
}

const statusOptions = [
  { value: "Novo", label: "Novo" },
  { value: "Atribuído", label: "Atribuído" },
  { value: "Em Espera", label: "Em Espera" },
  { value: "Convidado", label: "Convidado" },
  { value: "Agendado", label: "Agendado" },
  { value: "Confirmado", label: "Confirmado" },
  { value: "Check-in", label: "Check-in" },
  { value: "Venda", label: "Venda" },
  { value: "Descartado", label: "Descartado" },
  { value: "Desperdício", label: "Desperdício" },
  { value: "Opt Out", label: "Opt Out" },
];

export function ProspeccaoGlobalFilter({
  prospeccoes,
  responsaveis,
  filters,
  onFiltersChange,
  className
}: ProspeccaoGlobalFilterProps) {
  const [open, setOpen] = useState(false);

  const updateFilter = (key: keyof ProspeccaoGlobalFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilter = (key: keyof ProspeccaoGlobalFilters) => {
    const defaultValue = key === 'prospeccaoId' || key === 'responsavelId' || key === 'status' ? 'todos' : '';
    onFiltersChange({
      ...filters,
      [key]: defaultValue
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      prospeccaoId: "todos",
      dataInicio: "",
      dataFim: "",
      responsavelId: "todos",
      status: "todos",
      dadosLead: ""
    });
  };

  const getActiveFilters = () => {
    const active: { key: keyof ProspeccaoGlobalFilters; label: string; value: string }[] = [];
    
    if (filters.prospeccaoId !== "todos") {
      const prospeccao = prospeccoes.find(p => p.id === filters.prospeccaoId);
      active.push({ key: 'prospeccaoId', label: 'Evento', value: prospeccao?.titulo || filters.prospeccaoId });
    }
    if (filters.status !== "todos") {
      active.push({ key: 'status', label: 'Status', value: filters.status });
    }
    if (filters.responsavelId !== "todos") {
      const responsavel = responsaveis.find(r => r.id === filters.responsavelId);
      active.push({ key: 'responsavelId', label: 'Vendedor', value: responsavel?.nome_completo || filters.responsavelId });
    }
    if (filters.dataInicio) {
      active.push({ key: 'dataInicio', label: 'Início', value: filters.dataInicio });
    }
    if (filters.dataFim) {
      active.push({ key: 'dataFim', label: 'Fim', value: filters.dataFim });
    }
    if (filters.dadosLead) {
      active.push({ key: 'dadosLead', label: 'Busca', value: filters.dadosLead });
    }
    
    return active;
  };

  const activeFilters = getActiveFilters();
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Linha de filtros aplicados */}
      <div className="flex items-center gap-2 min-h-[28px]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 gap-1.5 text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[480px] p-4" align="start">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Filtros</h4>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters}
                      className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Limpar todos
                    </Button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Prospecção/Evento */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Prospecção/Evento</label>
                  <Select 
                    value={filters.prospeccaoId} 
                    onValueChange={(value) => updateFilter('prospeccaoId', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {prospeccoes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select 
                    value={filters.status} 
                    onValueChange={(value) => updateFilter('status', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {statusOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Vendedor/Responsável */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Vendedor/Responsável</label>
                  <Select 
                    value={filters.responsavelId} 
                    onValueChange={(value) => updateFilter('responsavelId', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {responsaveis.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Período - Data Início */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Data Início</label>
                  <Input
                    type="date"
                    value={filters.dataInicio}
                    onChange={(e) => updateFilter('dataInicio', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Período - Data Fim */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
                  <Input
                    type="date"
                    value={filters.dataFim}
                    onChange={(e) => updateFilter('dataFim', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Dados do Lead */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Dados do Lead</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Nome, telefone, e-mail, ID, produto..."
                      value={filters.dadosLead}
                      onChange={(e) => updateFilter('dadosLead', e.target.value)}
                      className="h-8 text-xs pl-7"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Badges dos filtros aplicados */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeFilters.map((filter) => (
              <Badge 
                key={filter.key} 
                variant="secondary" 
                className="h-6 gap-1 pl-2 pr-1 text-xs font-normal"
              >
                <span className="text-muted-foreground">{filter.label}:</span>
                <span className="max-w-[120px] truncate">{filter.value}</span>
                <button
                  onClick={() => clearFilter(filter.key)}
                  className="ml-0.5 hover:bg-muted rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
