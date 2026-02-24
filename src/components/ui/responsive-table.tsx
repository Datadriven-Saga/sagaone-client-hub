import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  /** Header label */
  header: string;
  /** Key in the data object or accessor function */
  accessor: keyof T | ((row: T) => React.ReactNode);
  /** Hide this column on mobile card view (still shown in table) */
  hideOnMobile?: boolean;
  /** Custom className for the table cell */
  className?: string;
  /** Priority label shown on card (defaults to header) */
  mobileLabel?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Called when a row / card is clicked */
  onRowClick?: (row: T) => void;
  /** Unique key extractor */
  keyExtractor: (row: T) => string;
  /** Custom mobile card renderer — overrides default card layout */
  renderMobileCard?: (row: T, index: number) => React.ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state icon */
  emptyIcon?: React.ReactNode;
  /** Additional class for wrapper */
  className?: string;
  /** Sticky header on desktop */
  stickyHeader?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCellValue<T>(row: T, accessor: ColumnDef<T>["accessor"]): React.ReactNode {
  if (typeof accessor === "function") return accessor(row);
  return row[accessor] as React.ReactNode;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ResponsiveTable<T>({
  data,
  columns,
  onRowClick,
  keyExtractor,
  renderMobileCard,
  emptyMessage = "Nenhum registro encontrado",
  emptyIcon,
  className,
  stickyHeader = false,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {emptyIcon && (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            {emptyIcon}
          </div>
        )}
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // ── Mobile: Cards ──────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {data.map((row, index) => {
          if (renderMobileCard) return renderMobileCard(row, index);

          const visibleColumns = columns.filter((c) => !c.hideOnMobile);
          const [primary, ...rest] = visibleColumns;

          return (
            <div
              key={keyExtractor(row)}
              className={cn(
                "bg-card border rounded-xl p-4 space-y-2",
                onRowClick && "cursor-pointer active:bg-muted/50 transition-colors"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {/* Primary field — larger */}
              {primary && (
                <p className="font-medium text-foreground truncate text-base">
                  {getCellValue(row, primary.accessor)}
                </p>
              )}

              {/* Remaining fields as label-value pairs */}
              {rest.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {rest.map((col) => (
                    <div key={String(col.header)} className="min-w-0">
                      <span className="text-muted-foreground text-xs">
                        {col.mobileLabel || col.header}
                      </span>
                      <p className="text-foreground truncate">
                        {getCellValue(row, col.accessor) ?? "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Desktop: Table ─────────────────────────────────────────────────────────

  return (
    <div className={cn("overflow-x-auto border rounded-lg", className)}>
      <Table>
        <TableHeader className={stickyHeader ? "sticky top-0 bg-background z-10" : undefined}>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={String(col.header)} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={keyExtractor(row)}
              className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell key={String(col.header)} className={col.className}>
                  {getCellValue(row, col.accessor) ?? "-"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
