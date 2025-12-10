import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CheckSquare, Square, Filter, X, ChevronDown } from "lucide-react";

interface Company {
  id: string;
  nome_empresa: string;
  marca?: string;
  uf?: string;
  cnpj?: string;
  crm_id?: string;
}

interface EmpresasSelectorProps {
  companies: Company[];
  selectedCompanies: string[];
  onSelectionChange: (selected: string[]) => void;
}

export function EmpresasSelector({ companies, selectedCompanies, onSelectionChange }: EmpresasSelectorProps) {
  const [filters, setFilters] = useState({
    nome: "",
    marca: "",
    uf: "",
    cnpj: "",
    crmId: ""
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const nomeInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Autofocus on nome field when filters are shown
  useEffect(() => {
    if (showFilters && nomeInputRef.current) {
      nomeInputRef.current.focus();
    }
  }, [showFilters]);

  // Check if scrollable and update indicator
  const checkScrollable = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = scrollContainerRef.current;
      const isScrollable = scrollHeight > clientHeight;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
      setShowScrollIndicator(isScrollable && !isAtBottom);
    }
  }, []);

  useEffect(() => {
    checkScrollable();
    const resizeObserver = new ResizeObserver(checkScrollable);
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [checkScrollable, companies, filters]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = scrollContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
      setShowScrollIndicator(!isAtBottom);
    }
  };

  const handleScrollIndicatorClick = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.scrollHeight * 0.2;
      container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    }
  };

  // Filtrar empresas com base nos critérios
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchNome = company.nome_empresa?.toLowerCase().includes(filters.nome.toLowerCase()) ?? true;
      const matchMarca = company.marca?.toLowerCase().includes(filters.marca.toLowerCase()) ?? true;
      const matchUf = company.uf?.toLowerCase().includes(filters.uf.toLowerCase()) ?? true;
      const matchCnpj = company.cnpj?.toLowerCase().includes(filters.cnpj.toLowerCase()) ?? true;
      const matchCrmId = company.crm_id?.toLowerCase().includes(filters.crmId.toLowerCase()) ?? true;
      
      return matchNome && matchMarca && matchUf && matchCnpj && matchCrmId;
    });
  }, [companies, filters]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      nome: "",
      marca: "",
      uf: "",
      cnpj: "",
      crmId: ""
    });
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredCompanies.map(c => c.id);
    const newSelection = Array.from(new Set([...selectedCompanies, ...filteredIds]));
    onSelectionChange(newSelection);
  };

  const unselectAllFiltered = () => {
    const filteredIds = new Set(filteredCompanies.map(c => c.id));
    const newSelection = selectedCompanies.filter(id => !filteredIds.has(id));
    onSelectionChange(newSelection);
  };

  const hasActiveFilters = Object.values(filters).some(value => value.trim() !== "");
  const allFilteredSelected = filteredCompanies.length > 0 && filteredCompanies.every(c => selectedCompanies.includes(c.id));

  return (
    <Card className="p-4 flex flex-col max-h-[400px]">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Cabeçalho com controles - fixo */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresas com Acesso * ({selectedCompanies.length} selecionadas)
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filtros
            </Button>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <Card className="p-3 bg-muted/50 mb-4 flex-shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Filtrar empresas</Label>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="filter-nome" className="text-xs">Nome</Label>
                  <Input
                    id="filter-nome"
                    ref={nomeInputRef}
                    placeholder="Nome da empresa..."
                    value={filters.nome}
                    onChange={(e) => handleFilterChange("nome", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="filter-marca" className="text-xs">Marca</Label>
                  <Input
                    id="filter-marca"
                    placeholder="Marca..."
                    value={filters.marca}
                    onChange={(e) => handleFilterChange("marca", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="filter-uf" className="text-xs">UF</Label>
                  <Input
                    id="filter-uf"
                    placeholder="SP, RJ..."
                    value={filters.uf}
                    onChange={(e) => handleFilterChange("uf", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="filter-cnpj" className="text-xs">CNPJ</Label>
                  <Input
                    id="filter-cnpj"
                    placeholder="00.000.000/0000-00"
                    value={filters.cnpj}
                    onChange={(e) => handleFilterChange("cnpj", e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="filter-crm-id" className="text-xs">CRM ID</Label>
                  <Input
                    id="filter-crm-id"
                    placeholder="ID do CRM..."
                    value={filters.crmId}
                    onChange={(e) => handleFilterChange("crmId", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Contador de empresas */}
        <div className="text-sm text-muted-foreground mb-2 flex-shrink-0">
          Mostrando {filteredCompanies.length} de {companies.length} empresas
        </div>

        {/* Lista de empresas - área de scroll com indicador */}
        <div className="relative flex-1 min-h-0">
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto border rounded p-3"
          >
            {filteredCompanies.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                {hasActiveFilters ? "Nenhuma empresa encontrada com os filtros aplicados" : "Nenhuma empresa disponível"}
              </div>
            ) : (
              filteredCompanies.map((company) => (
                <div key={company.id} className="flex items-start space-x-2 p-2 hover:bg-muted/50 rounded">
                  <Checkbox
                    id={`company-${company.id}`}
                    checked={selectedCompanies.includes(company.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onSelectionChange([...selectedCompanies, company.id]);
                      } else {
                        onSelectionChange(selectedCompanies.filter((id: string) => id !== company.id));
                      }
                    }}
                  />
                  <div className="grid gap-1 leading-none flex-1 min-w-0">
                    <label
                      htmlFor={`company-${company.id}`}
                      className="text-sm font-medium leading-none cursor-pointer truncate"
                      title={company.nome_empresa}
                    >
                      {company.nome_empresa}
                    </label>
                    {(company.marca || company.uf || company.crm_id) && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {company.marca && <div>Marca: {company.marca}</div>}
                        {company.uf && <div>UF: {company.uf}</div>}
                        {company.crm_id && <div>CRM ID: {company.crm_id}</div>}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Scroll indicator */}
          {showScrollIndicator && (
            <button
              type="button"
              onClick={handleScrollIndicatorClick}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-primary/50 flex items-center justify-center cursor-pointer transition-opacity duration-300 hover:bg-primary/70"
              aria-label="Rolar para baixo"
            >
              <ChevronDown className="w-5 h-5 text-primary-foreground/50" />
            </button>
          )}
        </div>

        {/* Rodapé fixo com botões */}
        <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t flex-shrink-0">
          {filteredCompanies.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={allFilteredSelected ? unselectAllFiltered : selectAllFiltered}
            >
              {allFilteredSelected ? (
                <>
                  <Square className="h-4 w-4 mr-1" />
                  Desmarcar Filtradas
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Selecionar Filtradas
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
