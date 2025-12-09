import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProspeccaoGlobalFilters {
  prospeccaoId: string;
  dataInicio: string;
  dataFim: string;
  responsavelId: string;
  status: string;
  telefone: string;
  nomeCliente: string;
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
  const updateFilter = (key: keyof ProspeccaoGlobalFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      prospeccaoId: "todos",
      dataInicio: "",
      dataFim: "",
      responsavelId: "todos",
      status: "todos",
      telefone: "",
      nomeCliente: ""
    });
  };

  const hasActiveFilters = 
    filters.prospeccaoId !== "todos" ||
    filters.dataInicio !== "" ||
    filters.dataFim !== "" ||
    filters.responsavelId !== "todos" ||
    filters.status !== "todos" ||
    filters.telefone !== "" ||
    filters.nomeCliente !== "";

  return (
    <Card className={cn("p-3", className)}>
      <div className="flex flex-wrap gap-3 items-end">
        {/* Prospecção/Evento - Dobro da largura */}
        <div className="flex flex-col gap-1 min-w-[360px]">
          <label className="text-xs font-medium text-muted-foreground">Prospecção/Evento</label>
          <Select 
            value={filters.prospeccaoId} 
            onValueChange={(value) => updateFilter('prospeccaoId', value)}
          >
            <SelectTrigger className="h-9">
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
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select 
            value={filters.status} 
            onValueChange={(value) => updateFilter('status', value)}
          >
            <SelectTrigger className="h-9">
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
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-medium text-muted-foreground">Vendedor/Responsável</label>
          <Select 
            value={filters.responsavelId} 
            onValueChange={(value) => updateFilter('responsavelId', value)}
          >
            <SelectTrigger className="h-9">
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
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={filters.dataInicio}
              onChange={(e) => updateFilter('dataInicio', e.target.value)}
              className="w-36 h-9"
            />
          </div>
        </div>

        {/* Período - Data Fim */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
          <Input
            type="date"
            value={filters.dataFim}
            onChange={(e) => updateFilter('dataFim', e.target.value)}
            className="w-36 h-9"
          />
        </div>

        {/* Telefone do Cliente */}
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground">Telefone</label>
          <Input
            type="text"
            placeholder="Ex: 61999..."
            value={filters.telefone}
            onChange={(e) => updateFilter('telefone', e.target.value)}
            className="h-9"
          />
        </div>

        {/* Nome do Cliente */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-muted-foreground">Nome do Cliente</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nome..."
              value={filters.nomeCliente}
              onChange={(e) => updateFilter('nomeCliente', e.target.value)}
              className="h-9 pl-8"
            />
          </div>
        </div>

        {/* Limpar Filtros */}
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-9 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>
    </Card>
  );
}
