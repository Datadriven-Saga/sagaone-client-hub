import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Calendar, Filter, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  onSearchChange?: (value: string) => void;
  onDateRangeChange?: (startDate: string, endDate: string) => void;
  onFilterChange?: (key: string, value: string) => void;
  searchPlaceholder?: string;
  additionalFilters?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
  showDateFilter?: boolean;
  className?: string;
  compact?: boolean;
}

export function FilterBar({
  onSearchChange,
  onDateRangeChange,
  onFilterChange,
  searchPlaceholder = "Buscar...",
  additionalFilters = [],
  showDateFilter = true,
  className,
  compact = false
}: FilterBarProps) {
  const isDesktop = useBreakpoint("md");
  // Data padrão: primeiro dia do mês atual até hoje
  const getDefaultDates = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      start: firstDayOfMonth.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  };

  const defaultDates = getDefaultDates();
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [searchValue, setSearchValue] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
      onDateRangeChange?.(value, endDate);
    } else {
      setEndDate(value);
      onDateRangeChange?.(startDate, value);
    }
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearchChange?.(value);
  };

  const handleFilter = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    onFilterChange?.(key, value);
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (searchValue.trim()) {
      chips.push({
        key: "__search",
        label: `"${searchValue}"`,
        onClear: () => handleSearch(""),
      });
    }
    additionalFilters.forEach((f) => {
      const v = filterValues[f.key];
      if (v && v !== "todos") {
        const opt = f.options.find((o) => o.value === v);
        chips.push({
          key: f.key,
          label: `${f.label}: ${opt?.label ?? v}`,
          onClear: () => handleFilter(f.key, "todos"),
        });
      }
    });
    return chips;
  }, [searchValue, filterValues, additionalFilters]);

  const clearAll = () => {
    if (searchValue) handleSearch("");
    additionalFilters.forEach((f) => {
      if (filterValues[f.key] && filterValues[f.key] !== "todos") {
        handleFilter(f.key, "todos");
      }
    });
  };

  // Não executar o useEffect para disparo inicial, já que o hook já tem valores padrão
  // useEffect(() => {
  //   onDateRangeChange?.(defaultDates.start, defaultDates.end);
  // }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (compact) {
    return (
      <Input
        placeholder={searchPlaceholder}
        onChange={(e) => handleSearch(e.target.value)}
        className={cn("h-8", className)}
      />
    );
  }

  // ─── Mobile: Sheet + chips ─────────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <Card className={cn("p-3 space-y-2", className)}>
        <div className="flex gap-2 items-center">
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-10 flex-1 min-w-0"
          />
          {(showDateFilter || additionalFilters.length > 0) && (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 relative"
                  aria-label="Abrir filtros"
                >
                  <Filter className="h-4 w-4" />
                  {activeChips.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                      {activeChips.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 py-4">
                  {showDateFilter && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Período
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => handleDateChange('start', e.target.value)}
                          className="flex-1 h-10"
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => handleDateChange('end', e.target.value)}
                          className="flex-1 h-10"
                        />
                      </div>
                    </div>
                  )}
                  {additionalFilters.map((filter) => (
                    <div key={filter.key} className="space-y-2">
                      <label className="text-sm font-medium">{filter.label}</label>
                      <Select
                        value={filterValues[filter.key] ?? ""}
                        onValueChange={(value) => handleFilter(filter.key, value)}
                      >
                        <SelectTrigger className="w-full h-10">
                          <SelectValue placeholder={filter.label} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          {filter.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <SheetFooter className="flex-row gap-2">
                  {activeChips.length > 0 && (
                    <Button variant="outline" className="flex-1" onClick={clearAll}>
                      Limpar
                    </Button>
                  )}
                  <SheetClose asChild>
                    <Button className="flex-1">Aplicar</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          )}
        </div>

        {activeChips.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {activeChips.map((chip) => (
              <Badge
                key={chip.key}
                variant="secondary"
                className="shrink-0 gap-1 pr-1 h-7"
              >
                <span className="truncate max-w-[140px]">{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onClear}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {activeChips.length >= 2 && (
              <button
                type="button"
                onClick={clearAll}
                className="shrink-0 text-xs text-muted-foreground underline px-2"
              >
                Limpar tudo
              </button>
            )}
          </div>
        )}
      </Card>
    );
  }

  // ─── Desktop: inline row ───────────────────────────────────────────────────
  return (
    <Card className={cn("p-3", className)}>
      <div className="flex flex-col md:flex-row flex-wrap gap-2 md:gap-3 items-stretch md:items-center">
        {/* Search Input */}
        <div className="flex-1 min-w-0 md:min-w-[200px]">
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-10 md:h-9"
          />
        </div>

        {/* Date Range Filter */}
        {showDateFilter && (
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-muted-foreground hidden md:block" />
            <Input
              type="date"
              placeholder="Data início"
              value={startDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="flex-1 min-w-[120px] md:w-36 h-10 md:h-9"
            />
            <span className="text-muted-foreground text-xs md:text-sm">até</span>
            <Input
              type="date"
              placeholder="Data fim"
              value={endDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="flex-1 min-w-[120px] md:w-36 h-10 md:h-9"
            />
          </div>
        )}

        {/* Additional Filters */}
        <div className="flex flex-wrap gap-2">
          {additionalFilters.map((filter) => (
            <Select
              key={filter.key}
              value={filterValues[filter.key] ?? ""}
              onValueChange={(value) => handleFilter(filter.key, value)}
            >
              <SelectTrigger className="flex-1 min-w-[120px] md:w-40 h-10 md:h-9">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>
    </Card>
  );
}