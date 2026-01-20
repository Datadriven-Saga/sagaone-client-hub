import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function EventoBaseSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Métricas skeleton - 5 cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className={i === 0 ? '' : 'border-muted'}>
            <CardContent className="p-4 text-center space-y-2">
              <Skeleton className="h-9 w-16 mx-auto" />
              <Skeleton className="h-4 w-24 mx-auto" />
              {i > 0 && <Skeleton className="h-3 w-16 mx-auto" />}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros skeleton */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-10 flex-1 min-w-[200px]" />
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-[120px]" />
            <Skeleton className="h-10 w-[120px]" />
            <Skeleton className="h-10 w-[100px]" />
            <Skeleton className="h-10 w-[130px]" />
            <Skeleton className="h-10 w-[130px]" />
          </div>

          {/* Info card skeleton */}
          <div className="p-3 rounded-lg bg-muted/30 border">
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Botões de disparo skeleton */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-28" />
          </div>
        </CardContent>
      </Card>

      {/* Tabela skeleton */}
      <Card>
        <CardContent className="p-0">
          {/* Header da tabela */}
          <div className="border-b px-4 py-3 flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>

          {/* Linhas da tabela */}
          {[...Array(8)].map((_, i) => (
            <div 
              key={i} 
              className="border-b px-4 py-4 flex items-center gap-4"
              style={{ 
                opacity: 1 - (i * 0.08),
                animationDelay: `${i * 50}ms`
              }}
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-6 rounded-full" />
              <Skeleton className="h-6 w-8 rounded-full" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Paginação skeleton */}
      <div className="flex justify-center items-center gap-2">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-9" />
      </div>
    </div>
  );
}
