import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface EmConstrucaoProps {
  titulo: string;
  grupo: string;
}

export default function EmConstrucao({ titulo, grupo }: EmConstrucaoProps) {
  return (
    <DashboardLayout title={titulo}>
      <div className="p-6">
        <Card className="max-w-2xl mx-auto mt-12">
          <CardContent className="flex flex-col items-center text-center gap-4 py-16">
            <div className="rounded-full bg-muted p-6">
              <Construction className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-wider text-muted-foreground">
                Algoritmos · {grupo}
              </p>
              <h1 className="text-3xl font-bold">{titulo}</h1>
              <p className="text-muted-foreground max-w-md">
                Esta página está em construção. Em breve você terá acesso a este algoritmo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}