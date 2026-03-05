import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export function ClientesSkeleton() {
  return (
    <div className="space-y-3 animate-in fade-in-50 duration-500">
      {/* Filtros skeleton */}
      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-12" />
          </Card>
        ))}
      </div>

      {/* Distribution cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </Card>
        ))}
      </div>

      {/* Table skeleton */}
      <Card className="p-3 sm:p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        
        {/* Table header */}
        <div className="border rounded-lg overflow-hidden">
          <div className="border-b px-4 py-3 flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="border-b px-4 py-4 flex items-center gap-4"
              style={{ opacity: 1 - i * 0.08 }}
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-1">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </Card>
    </div>
  );
}
