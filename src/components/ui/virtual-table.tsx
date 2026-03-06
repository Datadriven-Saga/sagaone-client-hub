import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface VirtualColumnDef<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: VirtualColumnDef<T>[];
  onRowClick?: (row: T) => void;
  keyExtractor: (row: T) => string;
  rowHeight?: number;
  maxHeight?: number;
  className?: string;
}

function getCellValue<T>(row: T, accessor: VirtualColumnDef<T>["accessor"]): React.ReactNode {
  if (typeof accessor === "function") return accessor(row);
  return row[accessor] as React.ReactNode;
}

export function VirtualTable<T>({
  data,
  columns,
  onRowClick,
  keyExtractor,
  rowHeight = 48,
  maxHeight = 600,
  className,
}: VirtualTableProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  return (
    <div className={cn("overflow-hidden border rounded-lg", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={String(col.header)} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      </Table>
      <div
        ref={parentRef}
        style={{ maxHeight, overflow: "auto" }}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            return (
              <div
                key={keyExtractor(row)}
                className={cn(
                  "flex items-center border-b px-4",
                  onRowClick && "cursor-pointer hover:bg-muted/50"
                )}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <div
                    key={String(col.header)}
                    className={cn("flex-1 truncate text-sm py-2", col.className)}
                  >
                    {getCellValue(row, col.accessor) ?? "-"}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
