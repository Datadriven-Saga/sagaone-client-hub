import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Link2, Search, ShieldCheck, ShieldAlert, Edit, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccessType } from "@/hooks/useUserAccessType";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

type WebhookRow = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  agente: string | null;
  url: string | null;
  metodo: string;
  ativo: boolean;
  credencial_secret_name: string | null;
  credencial_header: string | null;
  owner_edge_function: string | null;
  last_used_at: string | null;
  updated_at: string;
};

const WebhooksPage = () => {
  const { tipoAcesso, loading: accessLoading } = useUserAccessType();
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string>("all");
  const [agente, setAgente] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [credentialsMap, setCredentialsMap] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<WebhookRow | null>(null);
  const [saving, setSaving] = useState(false);

  const isMaster = tipoAcesso === "Master";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("webhook_registry" as any)
      .select("*")
      .order("categoria")
      .order("nome");
    if (error) {
      toast.error("Erro ao carregar webhooks", { description: error.message });
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as WebhookRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isMaster) load();
  }, [isMaster]);

  useEffect(() => {
    // Verifica credenciais em lote
    const names = Array.from(
      new Set(
        rows
          .map((r) => r.credencial_secret_name)
          .filter((n): n is string => !!n),
      ),
    );
    if (names.length === 0) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "check-webhook-credential",
          { body: { names } },
        );
        if (error) throw error;
        setCredentialsMap((data as any)?.configured ?? {});
      } catch (err) {
        console.warn("check-webhook-credential falhou", err);
      }
    })();
  }, [rows]);

  const categorias = useMemo(
    () => Array.from(new Set(rows.map((r) => r.categoria))).sort(),
    [rows],
  );
  const agentes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.agente).filter(Boolean))).sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoria !== "all" && r.categoria !== categoria) return false;
      if (agente !== "all" && r.agente !== agente) return false;
      if (statusFilter === "ativo" && !r.ativo) return false;
      if (statusFilter === "inativo" && r.ativo) return false;
      if (statusFilter === "sem_credencial" && r.credencial_secret_name && credentialsMap[r.credencial_secret_name]) return false;
      if (
        q &&
        !r.nome.toLowerCase().includes(q) &&
        !r.slug.toLowerCase().includes(q) &&
        !(r.descricao ?? "").toLowerCase().includes(q) &&
        !(r.url ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, search, categoria, agente, statusFilter, credentialsMap]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("webhook_registry" as any)
      .update({
        nome: editing.nome,
        descricao: editing.descricao,
        url: editing.url,
        metodo: editing.metodo,
        ativo: editing.ativo,
        categoria: editing.categoria,
        agente: editing.agente,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Webhook atualizado");
    setEditing(null);
    load();
  };

  const toggleActive = async (row: WebhookRow, value: boolean) => {
    const { error } = await supabase
      .from("webhook_registry" as any)
      .update({ ativo: value })
      .eq("id", row.id);
    if (error) {
      toast.error("Erro ao alterar status", { description: error.message });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ativo: value } : r)));
  };

  if (accessLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }
  if (!isMaster) return <Navigate to="/administracao" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Link2 className="h-6 w-6" /> Webhooks Externos
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Central de todos os webhooks externos consumidos pelo sistema. Alterações
              aqui refletem imediatamente nas edge functions (leitura via
              <code className="mx-1 px-1 rounded bg-muted">webhook_registry</code>).
              Credenciais continuam armazenadas em Supabase Secrets — a tela apenas
              indica presença.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, slug, descrição ou URL"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-48">
              <Label className="text-xs">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs">Agente</Label>
              <Select value={agente} onValueChange={setAgente}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {agentes.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                  <SelectItem value="sem_credencial">Sem credencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground ml-auto">
              {filtered.length} de {rows.length}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="min-h-[30vh] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((row) => {
              const credOk = row.credencial_secret_name
                ? credentialsMap[row.credencial_secret_name]
                : null;
              return (
                <Card key={row.id} className={row.ativo ? "" : "opacity-60"}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{row.nome}</h3>
                          <Badge variant="outline">{row.categoria}</Badge>
                          {row.agente && <Badge variant="secondary">{row.agente}</Badge>}
                          <Badge variant="outline">{row.metodo}</Badge>
                          {row.credencial_secret_name ? (
                            credOk ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30" variant="outline">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                {row.credencial_secret_name}
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/30" variant="outline">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                {row.credencial_secret_name} faltando
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              sem credencial
                            </Badge>
                          )}
                        </div>
                        {row.descricao && (
                          <p className="text-sm text-muted-foreground mt-1">{row.descricao}</p>
                        )}
                        <div className="text-xs mt-2 flex items-center gap-2 text-muted-foreground">
                          <code className="px-1.5 py-0.5 rounded bg-muted text-[11px]">{row.slug}</code>
                          <span>·</span>
                          <span className="truncate max-w-[500px]" title={row.url ?? ""}>
                            {row.url || <em>não configurada</em>}
                          </span>
                          {row.last_used_at && (
                            <>
                              <span>·</span>
                              <span>último uso {new Date(row.last_used_at).toLocaleString("pt-BR")}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={row.ativo} onCheckedChange={(v) => toggleActive(row, v)} />
                        <Button size="sm" variant="outline" onClick={() => setEditing({ ...row })}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle>Editar webhook</SheetTitle>
                <SheetDescription>
                  Slug e credencial são fixados pelo código. URL, método, categoria,
                  agente e status podem ser editados.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-xs">Slug</Label>
                  <Input value={editing.slug} disabled />
                </div>
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={editing.nome}
                    onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    value={editing.descricao ?? ""}
                    onChange={(e) => setEditing({ ...editing, descricao: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={editing.url ?? ""}
                    onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Método</Label>
                    <Select
                      value={editing.metodo}
                      onValueChange={(v) => setEditing({ ...editing, metodo: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Input
                      value={editing.categoria}
                      onChange={(e) => setEditing({ ...editing, categoria: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Agente</Label>
                    <Input
                      value={editing.agente ?? ""}
                      onChange={(e) => setEditing({ ...editing, agente: e.target.value || null })}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Switch
                      checked={editing.ativo}
                      onCheckedChange={(v) => setEditing({ ...editing, ativo: v })}
                    />
                    <span className="text-sm">{editing.ativo ? "Ativo" : "Inativo"}</span>
                  </div>
                </div>
                <div className="rounded border p-3 text-xs bg-muted/40 space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" /> Credencial exigida
                  </div>
                  <div>
                    Secret: <code>{editing.credencial_secret_name || "—"}</code>
                  </div>
                  <div>
                    Header: <code>{editing.credencial_header || "—"}</code>
                  </div>
                  {editing.credencial_secret_name && (
                    <a
                      href={`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_PROJECT_ID}/settings/functions`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Gerenciar secret <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Salvar
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default WebhooksPage;