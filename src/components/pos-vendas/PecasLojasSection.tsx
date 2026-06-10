import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, RefreshCw, Plus, Edit, Save, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePatyAgentes } from "@/hooks/pos-vendas/usePosVendasData";
import { usePatyPecasLojas, type PecasLoja } from "@/hooks/pos-vendas/usePecasData";

const EMPTY: PecasLoja = {
  cnpj: "", nome_loja: "", dias_adicionais: 0, agente_telefone: "",
  horario_funcionamento: "", endereco_loja: "", ativo: true,
};

export function PecasLojasSection() {
  const { toast } = useToast();
  const { agentes } = usePatyAgentes();
  const { lojas, loading, reload, upsert } = usePatyPecasLojas();

  const [search, setSearch] = useState("");
  const [filterAgente, setFilterAgente] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PecasLoja | null>(null);
  const [form, setForm] = useState<PecasLoja>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (l: PecasLoja) => { setEditing(l); setForm({ ...EMPTY, ...l }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.cnpj.trim()) {
      toast({ title: "CNPJ obrigatório", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      await upsert({ ...form, cnpj: form.cnpj.replace(/\D/g, "") });
      toast({ title: editing ? "Loja atualizada" : "Loja inserida" });
      setShowModal(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => lojas.filter((l) => {
    if (search) {
      const t = search.toLowerCase();
      if (!String(l.cnpj ?? "").toLowerCase().includes(t) &&
          !String(l.nome_loja ?? "").toLowerCase().includes(t)) return false;
    }
    if (filterAgente !== "all" && (l.agente_telefone ?? "") !== filterAgente) return false;
    if (filterStatus === "ativo" && !l.ativo) return false;
    if (filterStatus === "inativo" && l.ativo) return false;
    return true;
  }), [lojas, search, filterAgente, filterStatus]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Lojas (Peças)
            </CardTitle>
            <CardDescription className="mt-1">
              Configuração por CNPJ: dias adicionais na previsão, endereço, horário e agente Paty responsável.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Loja
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por CNPJ ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterAgente} onValueChange={setFilterAgente}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Agente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos agentes</SelectItem>
              {agentes.filter(a => a.telefone).map(a => (
                <SelectItem key={a.id} value={a.telefone!}>
                  {a.nome}
                  {(a.marca || a.uf) ? ` · ${[a.marca, a.uf].filter(Boolean).join(" / ")}` : ""}
                  {a.telefone ? ` · ${a.telefone}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Store className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma loja encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-muted">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Dias +</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l, i) => (
                  <TableRow key={String(l.id ?? l.cnpj ?? i)}>
                    <TableCell className="font-mono text-xs">{l.cnpj}</TableCell>
                    <TableCell className="font-medium">{l.nome_loja ?? "-"}</TableCell>
                    <TableCell>{l.dias_adicionais ?? 0}</TableCell>
                    <TableCell className="font-mono text-xs">{l.agente_telefone ?? "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{l.endereco_loja ?? "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{l.horario_funcionamento ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={l.ativo ? "default" : "outline"}>{l.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(l)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-xs text-muted-foreground">{filtered.length} loja(s) encontrada(s)</div>
      </CardContent>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Loja" : "Nova Loja"}</DialogTitle>
            <DialogDescription>
              {editing ? `Editando CNPJ ${editing.cnpj}` : "Cadastrar nova configuração de loja"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CNPJ *</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                disabled={!!editing}
                placeholder="Somente números"
              />
            </div>
            <div>
              <Label>Nome da loja</Label>
              <Input value={form.nome_loja ?? ""} onChange={(e) => setForm({ ...form, nome_loja: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dias adicionais</Label>
                <Input
                  type="number"
                  min={0}
                  value={String(form.dias_adicionais ?? 0)}
                  onChange={(e) => setForm({ ...form, dias_adicionais: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Agente</Label>
                <Select
                  value={form.agente_telefone ?? ""}
                  onValueChange={(v) => setForm({ ...form, agente_telefone: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {agentes.filter(a => a.telefone).map(a => (
                      <SelectItem key={a.id} value={a.telefone!}>
                        {a.nome}
                        {(a.marca || a.uf) ? ` · ${[a.marca, a.uf].filter(Boolean).join(" / ")}` : ""}
                        {a.telefone ? ` · ${a.telefone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Textarea
                rows={2}
                value={form.endereco_loja ?? ""}
                onChange={(e) => setForm({ ...form, endereco_loja: e.target.value })}
              />
            </div>
            <div>
              <Label>Horário de funcionamento</Label>
              <Input
                value={form.horario_funcionamento ?? ""}
                onChange={(e) => setForm({ ...form, horario_funcionamento: e.target.value })}
                placeholder="Ex: Seg a Sex 08h-18h, Sab 08h-12h"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Salvando...</> : <><Save className="h-4 w-4 mr-1" />Salvar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}