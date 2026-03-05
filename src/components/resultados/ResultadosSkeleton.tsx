import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function ResultadosLigacaoSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Agent selector skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-10" />
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards skeleton */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center space-y-2">
              <Skeleton className="h-4 w-4 mx-auto rounded-full" />
              <Skeleton className="h-8 w-16 mx-auto" />
              <Skeleton className="h-3 w-20 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel skeleton */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 flex-1" style={{ maxWidth: `${100 - i * 15}%` }} />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Table skeleton */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 flex gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="border-b px-4 py-4 flex items-center gap-4"
              style={{ opacity: 1 - i * 0.1 }}
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function ResultadosResumoSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ResultadosGenericSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
