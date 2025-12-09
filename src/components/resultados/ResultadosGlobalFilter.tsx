import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Prospeccao {
  id: string;
  titulo: string;
  data_inicio: string | null;
  data_fim: string | null;
}

interface ResultadosGlobalFilterProps {
  prospeccoes: Prospeccao[];
  selectedProspeccoes: string[];
  onSelectedProspeccoesChange: (ids: string[]) => void;
  className?: string;
}

export function ResultadosGlobalFilter({
  prospeccoes,
  selectedProspeccoes,
  onSelectedProspeccoesChange,
  className
}: ResultadosGlobalFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProspeccoes = prospeccoes.filter(p =>
    p.titulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleProspeccao = (id: string) => {
    if (selectedProspeccoes.includes(id)) {
      onSelectedProspeccoesChange(selectedProspeccoes.filter(pId => pId !== id));
    } else {
      onSelectedProspeccoesChange([...selectedProspeccoes, id]);
    }
  };

  const selectAll = () => {
    onSelectedProspeccoesChange(prospeccoes.map(p => p.id));
  };

  const clearAll = () => {
    onSelectedProspeccoesChange([]);
  };

  const getSelectedLabel = () => {
    if (selectedProspeccoes.length === 0) return null;
    if (selectedProspeccoes.length === 1) {
      return prospeccoes.find(p => p.id === selectedProspeccoes[0])?.titulo || "1 evento";
    }
    return `${selectedProspeccoes.length} eventos`;
  };

  const hasActiveFilters = selectedProspeccoes.length > 0;

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      <div className="flex items-center gap-2 min-h-[28px] flex-wrap">
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
                  {selectedProspeccoes.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-4" align="start">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Selecionar Eventos</h4>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectAll}
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Todos
                  </Button>
                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearAll}
                      className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Limpar
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

              <Input
                type="text"
                placeholder="Buscar evento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 text-xs"
              />

              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {filteredProspeccoes.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Nenhum evento encontrado
                  </div>
                ) : (
                  filteredProspeccoes.map((prospeccao) => {
                    const isSelected = selectedProspeccoes.includes(prospeccao.id);
                    return (
                      <div
                        key={prospeccao.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                        onClick={() => toggleProspeccao(prospeccao.id)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{prospeccao.titulo}</div>
                          {prospeccao.data_inicio && (
                            <div className="text-xs text-muted-foreground">
                              {new Date(prospeccao.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Badges dos eventos selecionados */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge 
              variant="secondary" 
              className="h-6 gap-1 pl-2 pr-1 text-xs font-normal"
            >
              <span className="text-muted-foreground">Eventos:</span>
              <span className="max-w-[200px] truncate">{getSelectedLabel()}</span>
              <button
                onClick={clearAll}
                className="ml-0.5 hover:bg-muted rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}