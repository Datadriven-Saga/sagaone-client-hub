import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/DateRangePicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { QuarentenaFilters as Filters } from "@/hooks/useQuarentenaData";
import { DateRange } from "react-day-picker";

interface Props {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  availableMarcas: string[];
  availableLojas: { id: string; nome: string }[];
}

export function QuarentenaFilters({ filters, onFiltersChange, availableMarcas, availableLojas }: Props) {
  const update = (partial: Partial<Filters>) => onFiltersChange({ ...filters, ...partial });

  const toggleMarca = (marca: string) => {
    const next = filters.marcas.includes(marca)
      ? filters.marcas.filter(m => m !== marca)
      : [...filters.marcas, marca];
    update({ marcas: next });
  };

  const toggleLoja = (id: string) => {
    const next = filters.lojas.includes(id)
      ? filters.lojas.filter(l => l !== id)
      : [...filters.lojas, id];
    update({ lojas: next });
  };

  const hasActiveFilters = filters.search || filters.marcas.length > 0 || filters.lojas.length > 0 || filters.status !== "all" || filters.dateRange?.from;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar telefone, evento, marca ou loja..."
            value={filters.search}
            onChange={e => update({ search: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Marca multi-select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[160px] justify-between">
              {filters.marcas.length > 0 ? `${filters.marcas.length} marca(s)` : "Marca"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-2" align="start">
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {availableMarcas.map(m => (
                  <label key={m} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={filters.marcas.includes(m)} onCheckedChange={() => toggleMarca(m)} />
                    {m}
                  </label>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Loja multi-select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[160px] justify-between">
              {filters.lojas.length > 0 ? `${filters.lojas.length} loja(s)` : "Loja"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-2" align="start">
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {availableLojas.map(l => (
                  <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={filters.lojas.includes(l.id)} onCheckedChange={() => toggleLoja(l.id)} />
                    {l.nome}
                  </label>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Status */}
        <Select value={filters.status} onValueChange={v => update({ status: v })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="expirado">Expirado</SelectItem>
            <SelectItem value="desativado">Desativado</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range */}
        <DateRangePicker
          date={filters.dateRange}
          onDateChange={(d) => update({ dateRange: d })}
          placeholder="Período"
        />
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.marcas.map(m => (
            <Badge key={m} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleMarca(m)}>
              {m} <X className="h-3 w-3" />
            </Badge>
          ))}
          {filters.lojas.map(id => {
            const loja = availableLojas.find(l => l.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleLoja(id)}>
                {loja?.nome || id} <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {filters.status !== "all" && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => update({ status: "all" })}>
              {filters.status} <X className="h-3 w-3" />
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onFiltersChange({ search: "", marcas: [], lojas: [], status: "all", dateRange: undefined })}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
