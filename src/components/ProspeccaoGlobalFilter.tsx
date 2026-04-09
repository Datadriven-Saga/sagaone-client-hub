import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface ProspeccaoGlobalFilters {
  prospeccaoIds: string[];
  dataInicio: string;
  dataFim: string;
  responsavelId: string;
  status: string;
  dadosLead: string;
  showAllEvents: boolean;
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
  showSearchBar?: boolean;
}

const statusOptions = [
  { value: "Novo", label: "Novos" },
  { value: "Atribuído", label: "Atribuídos" },
  { value: "Em Espera", label: "Em Espera" },
  { value: "Convidado", label: "Convidados" },
  { value: "Agendado", label: "Agendados" },
  { value: "Confirmado", label: "Confirmados" },
  { value: "Check-in", label: "Check-ins" },
  { value: "Venda", label: "Vendas" },
  { value: "Descartado", label: "Descartados" },
  { value: "Desperdício", label: "Desperdício" },
  { value: "Opt Out", label: "Opt Out" },
];

export function ProspeccaoGlobalFilter({
  prospeccoes,
  responsaveis,
  filters,
  onFiltersChange,
  className,
  showSearchBar = true
}: ProspeccaoGlobalFilterProps) {
  const [open, setOpen] = useState(false);
  const [eventSearchTerm, setEventSearchTerm] = useState("");

  const updateFilter = (key: keyof ProspeccaoGlobalFilters, value: string) => {
    if (key === 'showAllEvents') {
      onFiltersChange({
        ...filters,
        showAllEvents: value === 'true'
      });
    } else {
      onFiltersChange({
        ...filters,
        [key]: value
      });
    }
  };

  const clearFilter = (key: keyof ProspeccaoGlobalFilters) => {
    if (key === 'prospeccaoIds') {
      onFiltersChange({ ...filters, prospeccaoIds: [] });
    } else {
      const defaultValue = key === 'responsavelId' || key === 'status' ? 'todos' : '';
      onFiltersChange({ ...filters, [key]: defaultValue });
    }
  };

  const clearFilters = () => {
    onFiltersChange({
      prospeccaoIds: [],
      dataInicio: "",
      dataFim: "",
      responsavelId: "todos",
      status: "todos",
      dadosLead: "",
      showAllEvents: filters.showAllEvents
    });
  };

  const toggleProspeccao = (id: string) => {
    const current = filters.prospeccaoIds;
    if (current.includes(id)) {
      onFiltersChange({ ...filters, prospeccaoIds: current.filter(pId => pId !== id) });
    } else {
      onFiltersChange({ ...filters, prospeccaoIds: [...current, id] });
    }
  };

  const selectAllProspeccoes = () => {
    onFiltersChange({ ...filters, prospeccaoIds: prospeccoes.map(p => p.id) });
  };

  const clearProspeccoes = () => {
    onFiltersChange({ ...filters, prospeccaoIds: [] });
  };

  const filteredEventList = prospeccoes.filter(p =>
    p.titulo.toLowerCase().includes(eventSearchTerm.toLowerCase())
  );

  const getEventLabel = () => {
    if (filters.prospeccaoIds.length === 0) return null;
    if (filters.prospeccaoIds.length === 1) {
      return prospeccoes.find(p => p.id === filters.prospeccaoIds[0])?.titulo || "1 evento";
    }
    return `${filters.prospeccaoIds.length} eventos`;
  };

  const getActiveFilters = () => {
    const active: { key: keyof ProspeccaoGlobalFilters; label: string; value: string }[] = [];
    
    if (filters.prospeccaoIds.length > 0) {
      active.push({ key: 'prospeccaoIds', label: 'Eventos', value: getEventLabel() || '' });
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
  const advancedFilters = activeFilters.filter(f => f.key !== 'dadosLead');
  const hasAdvancedFilters = advancedFilters.length > 0;

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      <div className="flex items-center gap-2 min-h-[36px] flex-wrap">
        {showSearchBar && (
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={
                /^\d+$/.test(filters.dadosLead) 
                  ? "Buscando por telefone/ID..." 
                  : /^[a-zA-ZÀ-ÿ\s]+$/.test(filters.dadosLead) && filters.dadosLead.length > 0
                    ? "Buscando por nome..."
                    : "Buscar (digite números ou nome)"
              }
              value={filters.dadosLead}
              onChange={(e) => updateFilter('dadosLead', e.target.value)}
              className="h-8 text-sm pl-8 pr-8"
            />
            {filters.dadosLead && (
              <button
                onClick={() => clearFilter('dadosLead')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-muted rounded"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 gap-1.5 text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {hasAdvancedFilters && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {advancedFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[480px] p-4" align="start">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Filtros</h4>
                <div className="flex items-center gap-2">
                  {hasAdvancedFilters && (
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
                {/* Prospecção/Evento - Multi-select com checkboxes */}
                <div className="flex flex-col gap-1 col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Prospecção/Evento</label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllProspeccoes}
                        className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                      >
                        Todos
                      </Button>
                      {filters.prospeccaoIds.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearProspeccoes}
                          className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input
                    type="text"
                    placeholder="Buscar evento..."
                    value={eventSearchTerm}
                    onChange={(e) => setEventSearchTerm(e.target.value)}
                    className="h-7 text-xs"
                  />
                  <div className="space-y-0.5 max-h-[160px] overflow-y-auto border rounded-md p-1">
                    {filteredEventList.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-2">
                        Nenhum evento encontrado
                      </div>
                    ) : (
                      filteredEventList.map((p) => {
                        const isSelected = filters.prospeccaoIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer"
                            onClick={() => toggleProspeccao(p.id)}
                          >
                            <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                            <span className="text-xs truncate">{p.titulo}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
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
                      {responsaveis
                        .filter(r => r.nome_completo)
                        .sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || ''))
                        .map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nome_completo}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data Início */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Data Início</label>
                  <Input
                    type="date"
                    value={filters.dataInicio}
                    onChange={(e) => updateFilter('dataInicio', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Data Fim */}
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

                {/* Toggle Mostrar Eventos Passados */}
                <div className="flex items-center justify-between col-span-2 pt-2 border-t">
                  <Label htmlFor="show-all-events" className="text-xs font-medium text-muted-foreground cursor-pointer">
                    Mostrar eventos encerrados
                  </Label>
                  <Switch
                    id="show-all-events"
                    checked={filters.showAllEvents}
                    onCheckedChange={(checked) => updateFilter('showAllEvents', checked ? 'true' : 'false')}
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Badges dos filtros aplicados */}
        {hasAdvancedFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {advancedFilters.map((filter) => (
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
