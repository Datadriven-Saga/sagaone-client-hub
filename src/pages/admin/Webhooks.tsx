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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Link2, Search, ShieldCheck, ShieldAlert, Edit, ExternalLink, Plus, Trash2 } from "lucide-react";
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

type NewWebhook = {
  slug: string;
  nome: string;
  descricao: string;
  categoria: string;
  agente: string;
  url: string;
  metodo: string;
  credencial_secret_name: string;
  credencial_header: string;
  ativo: boolean;
};

const emptyNew: NewWebhook = {
  slug: "",
  nome: "",
  descricao: "",
  categoria: "outros",
  agente: "",
  url: "",
  metodo: "POST",
  credencial_secret_name: "",
  credencial_header: "",
  ativo: true,
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
  const [creating, setCreating] = useState(false);
  const [newRow, setNewRow] = useState<NewWebhook>(emptyNew);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; single?: WebhookRow } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Master tem acesso total; Admin/TI mantidos para operar suporte quando necessário.
  const isMaster =
    tipoAcesso === "Master" ||
    tipoAcesso === "Administrador" ||
    tipoAcesso === "TI";

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
    setSelectedIds(new Set());
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
    const { data, error } = await supabase
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
      .select("id,url,metodo,ativo,categoria,agente,nome,descricao")
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    const updated = Array.isArray(data) ? data[0] : null;
    if (!updated) {
      toast.error("Webhook não foi alterado", { description: "Nenhuma linha foi atualizada no banco." });
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

  const handleCreate = async () => {
    const slug = newRow.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    if (!slug || !newRow.nome.trim()) {
      toast.error("Slug e nome são obrigatórios");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("webhook_registry" as any).insert({
      slug,
      nome: newRow.nome.trim(),
      descricao: newRow.descricao.trim() || null,
      categoria: newRow.categoria.trim() || "outros",
      agente: newRow.agente.trim() || null,
      url: newRow.url.trim() || null,
      metodo: newRow.metodo,
      ativo: newRow.ativo,
      credencial_secret_name: newRow.credencial_secret_name.trim() || null,
      credencial_header: newRow.credencial_header.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar webhook", { description: error.message });
      return;
    }
    toast.success("Webhook criado");
    setCreating(false);
    setNewRow(emptyNew);
    load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await supabase
      .from("webhook_registry" as any)
      .delete()
      .in("id", confirmDelete.ids);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success(
      confirmDelete.ids.length === 1 ? "Webhook excluído" : `${confirmDelete.ids.length} webhooks excluídos`,
    );
    setConfirmDelete(null);
    load();
  };

  const toggleSelect = (id: string, value: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = (value: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (value) filtered.forEach((r) => next.add(r.id));
      else filtered.forEach((r) => next.delete(r.id));
      return next;
    });
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
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  setConfirmDelete({ ids: Array.from(selectedIds) })
                }
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir ({selectedIds.size})
              </Button>
            )}
            <Button size="sm" onClick={() => { setNewRow(emptyNew); setCreating(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo webhook
            </Button>
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
            {filtered.length > 0 && (
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={(v) => toggleSelectAll(Boolean(v))}
                />
                <span>
                  {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
                  {selectedIds.size > 0 && ` (${selectedIds.size} selecionado${selectedIds.size > 1 ? "s" : ""})`}
                </span>
              </div>
            )}
            {filtered.map((row) => {
              const credOk = row.credencial_secret_name
                ? credentialsMap[row.credencial_secret_name]
                : null;
              return (
                <Card key={row.id} className={row.ativo ? "" : "opacity-60"}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Checkbox
                          className="mt-1"
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={(v) => toggleSelect(row.id, Boolean(v))}
                        />
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
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={row.ativo} onCheckedChange={(v) => toggleActive(row, v)} />
                        <Button size="sm" variant="outline" onClick={() => setEditing({ ...row })}>
                          <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete({ ids: [row.id], single: row })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Sheet open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Novo webhook</SheetTitle>
            <SheetDescription>
              Cadastre um novo endpoint externo. O slug é o identificador usado nas
              edge functions para resolver a URL dinamicamente.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs">Slug *</Label>
              <Input
                value={newRow.slug}
                onChange={(e) => setNewRow({ ...newRow, slug: e.target.value })}
                placeholder="meu_webhook_novo"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Somente letras minúsculas, números, _ e -.
              </p>
            </div>
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input
                value={newRow.nome}
                onChange={(e) => setNewRow({ ...newRow, nome: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={newRow.descricao}
                onChange={(e) => setNewRow({ ...newRow, descricao: e.target.value })}
                rows={3}
                placeholder="Para que serve e o que envia/recebe"
              />
            </div>
            <div>
              <Label className="text-xs">URL</Label>
              <Input
                value={newRow.url}
                onChange={(e) => setNewRow({ ...newRow, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Método</Label>
                <Select
                  value={newRow.metodo}
                  onValueChange={(v) => setNewRow({ ...newRow, metodo: v })}
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
                  value={newRow.categoria}
                  onChange={(e) => setNewRow({ ...newRow, categoria: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Agente</Label>
                <Input
                  value={newRow.agente}
                  onChange={(e) => setNewRow({ ...newRow, agente: e.target.value })}
                  placeholder="paty, maia, ..."
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  checked={newRow.ativo}
                  onCheckedChange={(v) => setNewRow({ ...newRow, ativo: v })}
                />
                <span className="text-sm">{newRow.ativo ? "Ativo" : "Inativo"}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Secret da credencial</Label>
                <Input
                  value={newRow.credencial_secret_name}
                  onChange={(e) => setNewRow({ ...newRow, credencial_secret_name: e.target.value })}
                  placeholder="SAGA_ONE"
                />
              </div>
              <div>
                <Label className="text-xs">Header da credencial</Label>
                <Input
                  value={newRow.credencial_header}
                  onChange={(e) => setNewRow({ ...newRow, credencial_header: e.target.value })}
                  placeholder="saga_one_supabase"
                />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Criar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {confirmDelete?.ids.length === 1 ? "webhook" : `${confirmDelete?.ids.length} webhooks`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.single ? (
                <>
                  Isso removerá permanentemente <b>{confirmDelete.single.nome}</b>{" "}
                  (<code>{confirmDelete.single.slug}</code>). Edge functions que
                  resolvem esse slug passarão a falhar com 400.
                </>
              ) : (
                "Ação irreversível. Edge functions que resolvem estes slugs passarão a falhar."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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