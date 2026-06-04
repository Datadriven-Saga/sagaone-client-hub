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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Armchair, RefreshCw, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type Log = {
  id: string;
  acao: "create" | "renew" | "activate" | "deactivate" | "limit_change";
  empresa_id: string | null;
  prospeccao_id: string | null;
  profile_id: string | null;
  email: string | null;
  executado_por: string | null;
  metadata: any;
  created_at: string;
  empresas?: { nome_empresa: string } | null;
  prospeccoes?: { titulo: string } | null;
  executor?: { nome_completo: string; tipo_acesso?: string | null } | null;
  alvo?: { nome_completo: string } | null;
};

const ACAO_LABEL: Record<Log["acao"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "Criação", variant: "default" },
  renew: { label: "Renovação", variant: "secondary" },
  activate: { label: "Ativação", variant: "outline" },
  deactivate: { label: "Desativação", variant: "destructive" },
  limit_change: { label: "Limite alterado", variant: "secondary" },
};

type SeatUsage = {
  empresa_id: string;
  nome_empresa: string;
  max_seats: number;
  in_use: number;
};

export default function LogsCadeiras() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [acaoFilter, setAcaoFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [usage, setUsage] = useState<SeatUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageSearch, setUsageSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [executorEmails, setExecutorEmails] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("logs_cadeiras")
      .select(`
        id, acao, empresa_id, prospeccao_id, profile_id, email, executado_por, metadata, created_at,
        empresas:empresa_id(nome_empresa),
        prospeccoes:prospeccao_id(titulo),
        executor:executado_por(nome_completo, tipo_acesso),
        alvo:profile_id(nome_completo)
      `)
      .order("created_at", { ascending: false })
      .limit(500);
    if (acaoFilter !== "all") q = q.eq("acao", acaoFilter);
    const { data, error } = await q;
    if (error) {
      toast.error("Erro ao carregar logs: " + error.message);
    } else {
      const rows = (data as any) || [];
      setLogs(rows);
      const ids = Array.from(
        new Set(rows.map((r: any) => r.executado_por).filter(Boolean))
      ) as string[];
      if (ids.length) {
        const { data: emails } = await supabase.rpc("get_users_emails", { user_ids: ids });
        const map: Record<string, string> = {};
        (emails || []).forEach((e: any) => { map[e.user_id] = e.email; });
        setExecutorEmails(map);
      } else {
        setExecutorEmails({});
      }
    }
    setLoading(false);
  };

  const loadUsage = async () => {
    setUsageLoading(true);
    const { data, error } = await supabase.rpc("list_seat_usage");
    if (error) {
      toast.error("Erro ao carregar limites: " + error.message);
    } else {
      setUsage((data as any) || []);
    }
    setUsageLoading(false);
  };

  const saveLimit = async (empresa_id: string) => {
    const raw = editing[empresa_id];
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(empresa_id);
    const { error } = await supabase.rpc("set_seat_limit", {
      p_empresa_id: empresa_id,
      p_max_seats: v,
    });
    setSaving(null);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Limite atualizado");
    setEditing((p) => {
      const n = { ...p };
      delete n[empresa_id];
      return n;
    });
    await Promise.all([loadUsage(), load()]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acaoFilter]);

  useEffect(() => {
    loadUsage();
  }, []);

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const execEmail = l.executado_por ? executorEmails[l.executado_por] : "";
    return (
      (l.email || "").toLowerCase().includes(s) ||
      (l.empresas?.nome_empresa || "").toLowerCase().includes(s) ||
      (l.prospeccoes?.titulo || "").toLowerCase().includes(s) ||
      (l.alvo?.nome_completo || "").toLowerCase().includes(s) ||
      (l.executor?.nome_completo || "").toLowerCase().includes(s) ||
      (l.executor?.tipo_acesso || "").toLowerCase().includes(s) ||
      (execEmail || "").toLowerCase().includes(s)
    );
  });

  const filteredUsage = usage.filter((u) =>
    !usageSearch.trim()
      ? true
      : u.nome_empresa.toLowerCase().includes(usageSearch.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Armchair className="h-6 w-6" />
              Cadeiras de Terceiros
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Limites por loja e histórico de criação, renovação e ativação/desativação.
            </p>
          </div>
        </div>

        <Tabs defaultValue="limites" className="w-full">
          <TabsList>
            <TabsTrigger value="limites">Limites por loja</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="limites" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Limite de cadeiras por loja</CardTitle>
                <Button variant="outline" size="sm" onClick={loadUsage} disabled={usageLoading}>
                  <RefreshCw className={"h-4 w-4 mr-2 " + (usageLoading ? "animate-spin" : "")} />
                  Atualizar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Buscar loja..."
                  value={usageSearch}
                  onChange={(e) => setUsageSearch(e.target.value)}
                />
                {usageLoading ? (
                  <div className="p-10 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loja</TableHead>
                        <TableHead className="w-32">Em uso</TableHead>
                        <TableHead className="w-40">Limite</TableHead>
                        <TableHead className="w-32">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsage.map((u) => {
                        const dirty = editing[u.empresa_id] !== undefined && Number(editing[u.empresa_id]) !== u.max_seats;
                        const exceeded = u.in_use > u.max_seats;
                        return (
                          <TableRow key={u.empresa_id}>
                            <TableCell>{u.nome_empresa}</TableCell>
                            <TableCell>
                              <Badge variant={exceeded ? "destructive" : "outline"}>
                                {u.in_use}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                value={editing[u.empresa_id] ?? String(u.max_seats)}
                                onChange={(e) =>
                                  setEditing((p) => ({ ...p, [u.empresa_id]: e.target.value }))
                                }
                                className="h-8 w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!dirty || saving === u.empresa_id}
                                onClick={() => saveLimit(u.empresa_id)}
                              >
                                {saving === u.empresa_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <><Save className="h-3 w-3 mr-1" /> Salvar</>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredUsage.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                            Nenhuma loja encontrada.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="space-y-4">
            <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Filtros</CardTitle>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
                Atualizar
              </Button>
            </div>
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
                    <SelectItem value="limit_change">Limite alterado</SelectItem>
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
                        <TableCell>
                          <Badge variant={a?.variant || "outline"}>{a?.label || l.acao}</Badge>
                          {l.acao === "limit_change" && l.metadata && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {l.metadata.old ?? "—"} → {l.metadata.new ?? "—"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{l.alvo?.nome_completo || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{l.email || "—"}</TableCell>
                        <TableCell>{l.empresas?.nome_empresa || "—"}</TableCell>
                        <TableCell>{l.prospeccoes?.titulo || "—"}</TableCell>
                        <TableCell>
                          <div>{l.executor?.nome_completo || "—"}</div>
                          {(l.executado_por && (executorEmails[l.executado_por] || l.executor?.tipo_acesso)) && (
                            <div className="text-xs text-muted-foreground">
                              {[executorEmails[l.executado_por], l.executor?.tipo_acesso].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}