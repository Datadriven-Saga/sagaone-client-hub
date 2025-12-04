import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { useState } from "react";
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

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
      onDateRangeChange?.(value, endDate);
    } else {
      setEndDate(value);
      onDateRangeChange?.(startDate, value);
    }
  };

  // Não executar o useEffect para disparo inicial, já que o hook já tem valores padrão
  // useEffect(() => {
  //   onDateRangeChange?.(defaultDates.start, defaultDates.end);
  // }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (compact) {
    return (
      <Input
        placeholder={searchPlaceholder}
        onChange={(e) => onSearchChange?.(e.target.value)}
        className={cn("h-8", className)}
      />
    );
  }

  return (
    <Card className={cn("p-3", className)}>
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search Input */}
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={searchPlaceholder}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Date Range Filter */}
        {showDateFilter && (
          <>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                placeholder="Data início"
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="w-36 h-9"
              />
              <span className="text-muted-foreground text-sm">até</span>
              <Input
                type="date"
                placeholder="Data fim"
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="w-36 h-9"
              />
            </div>
          </>
        )}

        {/* Additional Filters */}
        {additionalFilters.map((filter) => (
          <Select key={filter.key} onValueChange={(value) => onFilterChange?.(filter.key, value)}>
            <SelectTrigger className="w-40 h-9">
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
    </Card>
  );
}