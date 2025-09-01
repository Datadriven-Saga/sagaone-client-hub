import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { useState } from "react";

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
}

export function FilterBar({
  onSearchChange,
  onDateRangeChange,
  onFilterChange,
  searchPlaceholder = "Buscar...",
  additionalFilters = [],
  showDateFilter = true
}: FilterBarProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
      if (endDate) {
        onDateRangeChange?.(value, endDate);
      }
    } else {
      setEndDate(value);
      if (startDate) {
        onDateRangeChange?.(startDate, value);
      }
    }
  };

  return (
    <Card className="p-3">
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