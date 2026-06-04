import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Armchair, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type Log = {
  id: string;
  acao: "create" | "renew" | "activate" | "deactivate";
  empresa_id: string | null;
  prospeccao_id: string | null;
  profile_id: string | null;
  email: string | null;
  executado_por: string | null;
  metadata: any;
  created_at: string;
  empresas?: { nome_empresa: string } | null;
  prospeccoes?: { titulo: string } | null;
  executor?: { nome_completo: string } | null;
  alvo?: { nome_completo: string } | null;
};

const ACAO_LABEL: Record<Log["acao"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "Criação", variant: "default" },
  renew: { label: "Renovação", variant: "secondary" },
  activate: { label: "Ativação", variant: "outline" },
  deactivate: { label: "Desativação", variant: "destructive" },
};

export default function LogsCadeiras() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [acaoFilter, setAcaoFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("logs_cadeiras")
      .select(`
        id, acao, empresa_id, prospeccao_id, profile_id, email, executado_por, metadata, created_at,
        empresas:empresa_id(nome_empresa),
        prospeccoes:prospeccao_id(titulo),
        executor:executado_por(nome_completo),
        alvo:profile_id(nome_completo)
      `)
      .order("created_at", { ascending: false })
      .limit(500);
    if (acaoFilter !== "all") q = q.eq("acao", acaoFilter);
    const { data, error } = await q;
    if (error) {
      toast.error("Erro ao carregar logs: " + error.message);
    } else {
      setLogs((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acaoFilter]);

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (l.email || "").toLowerCase().includes(s) ||
      (l.empresas?.nome_empresa || "").toLowerCase().includes(s) ||
      (l.prospeccoes?.titulo || "").toLowerCase().includes(s) ||
      (l.alvo?.nome_completo || "").toLowerCase().includes(s) ||
      (l.executor?.nome_completo || "").toLowerCase().includes(s)
    );
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Armchair className="h-6 w-6" />
              Logs de Cadeiras
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Auditoria de criação, renovação, ativação e desativação de cadeiras de terceiros.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Ação</label>
                <Select value={acaoFilter} onValueChange={setAcaoFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="create">Criação</SelectItem>
                    <SelectItem value="renew">Renovação</SelectItem>
                    <SelectItem value="activate">Ativação</SelectItem>
                    <SelectItem value="deactivate">Desativação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Buscar</label>
                <Input
                  placeholder="email, loja, evento, terceiro, executor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Nenhum log encontrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Terceiro</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Executado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const a = ACAO_LABEL[l.acao];
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell><Badge variant={a.variant}>{a.label}</Badge></TableCell>
                        <TableCell>{l.alvo?.nome_completo || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{l.email || "—"}</TableCell>
                        <TableCell>{l.empresas?.nome_empresa || "—"}</TableCell>
                        <TableCell>{l.prospeccoes?.titulo || "—"}</TableCell>
                        <TableCell>{l.executor?.nome_completo || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}