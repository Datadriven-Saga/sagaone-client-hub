import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Store, RefreshCw, Plus, Edit, Save, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LojaPaty {
  id?: number | string;
  dealerid: string;
  loja_nome: string;
  uf: string;
  ativa: boolean | string;
  maia_id?: string;
  chatwoot?: string;
  tb_histories?: string;
  id_gestor?: string | number | null;
  [key: string]: any;
}

const UF_OPTIONS = ["DF", "GO", "MG", "MT", "RO"];

function isAtivo(v: any): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "ativo" || s === "1";
}

export function LojasTab() {
  const { toast } = useToast();
  const [lojas, setLojas] = useState<LojaPaty[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUF, setFilterUF] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LojaPaty | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<LojaPaty>({
    dealerid: "", loja_nome: "", uf: "", ativa: true,
    maia_id: "", chatwoot: "", tb_histories: "", id_gestor: "",
  });

  const fetchLojas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: { endpoint: "busca-paty-lojas-ids" },
      });
      if (error) throw new Error(error.message);
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      setLojas(arr);
    } catch (err) {
      console.error("Erro ao buscar lojas Paty:", err);
      toast({ title: "Erro ao carregar lojas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchLojas(); }, [fetchLojas]);

  const openAdd = () => {
    setEditing(null);
    setFormData({
      dealerid: "", loja_nome: "", uf: "", ativa: true,
      maia_id: "", chatwoot: "", tb_histories: "", id_gestor: "",
    });
    setShowModal(true);
  };

  const openEdit = (l: LojaPaty) => {
    setEditing(l);
    setFormData({
      ...l,
      ativa: isAtivo(l.ativa),
      id_gestor: l.id_gestor ?? l.idgestor ?? "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.dealerid || !formData.loja_nome || !formData.uf) {
      toast({ title: "Campos obrigatórios", description: "Preencha dealerid, nome e UF", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const payload: any = {
        ...(editing?.id ? { id: editing.id } : {}),
        dealerid: formData.dealerid,
        loja_nome: formData.loja_nome,
        uf: formData.uf,
        ativa: isAtivo(formData.ativa),
        maia_id: formData.maia_id ?? "",
        chatwoot: formData.chatwoot ?? "",
        tb_histories: formData.tb_histories ?? "",
        id_gestor: formData.id_gestor || null,
      };
      const { error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: { endpoint: "atualiza-paty-lojas-ids", ...payload },
      });
      if (error) throw new Error(error.message);
      toast({ title: editing ? "Loja atualizada" : "Loja inserida" });
      setShowModal(false);
      await fetchLojas();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = lojas.filter((l) => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (
        !String(l.loja_nome ?? "").toLowerCase().includes(t) &&
        !String(l.dealerid ?? "").toLowerCase().includes(t) &&
        !String(l.maia_id ?? "").toLowerCase().includes(t)
      ) return false;
    }
    if (filterUF !== "all" && l.uf?.toUpperCase() !== filterUF.toUpperCase()) return false;
    if (filterStatus !== "all") {
      const a = isAtivo(l.ativa);
      if (filterStatus === "ativo" && !a) return false;
      if (filterStatus === "inativo" && a) return false;
    }
    return true;
  });

  const ufs = [...new Set(lojas.map((l) => l.uf?.toUpperCase()).filter(Boolean))].sort();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Lojas Paty
            </CardTitle>
            <CardDescription className="mt-1">
              Gerencie as lojas vinculadas à Paty (Pós-Vendas)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchLojas} disabled={loading}>
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
              placeholder="Buscar por nome, dealer ID ou maia ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterUF} onValueChange={setFilterUF}>
            <SelectTrigger className="w-32"><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas UF</SelectItem>
              {ufs.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
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
                  <TableHead>ID</TableHead>
                  <TableHead>Dealer ID</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Maia ID</TableHead>
                  <TableHead>Chatwoot</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l, i) => (
                  <TableRow key={String(l.id ?? i)}>
                    <TableCell className="font-mono text-xs">{l.id ?? "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{l.dealerid}</TableCell>
                    <TableCell className="font-medium">{l.loja_nome}</TableCell>
                    <TableCell><Badge variant="secondary">{l.uf}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={isAtivo(l.ativa) ? "default" : "outline"}>
                        {isAtivo(l.ativa) ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.maia_id}</TableCell>
                    <TableCell className="font-mono text-xs">{l.chatwoot}</TableCell>
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

        <div className="text-xs text-muted-foreground">
          {filtered.length} loja(s) encontrada(s)
        </div>
      </CardContent>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Loja" : "Nova Loja"}</DialogTitle>
            <DialogDescription>
              {editing ? `Editando ${editing.loja_nome} (ID: ${editing.id})` : "Insira uma nova loja Paty"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dealer ID *</Label>
                <Input value={formData.dealerid} onChange={(e) => setFormData({ ...formData, dealerid: e.target.value })} />
              </div>
              <div>
                <Label>UF *</Label>
                <Select value={formData.uf} onValueChange={(v) => setFormData({ ...formData, uf: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nome da Loja *</Label>
              <Input value={formData.loja_nome} onChange={(e) => setFormData({ ...formData, loja_nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Maia ID</Label>
                <Input value={formData.maia_id ?? ""} onChange={(e) => setFormData({ ...formData, maia_id: e.target.value })} />
              </div>
              <div>
                <Label>Chatwoot</Label>
                <Input value={formData.chatwoot ?? ""} onChange={(e) => setFormData({ ...formData, chatwoot: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tabela Histórico</Label>
                <Input value={formData.tb_histories ?? ""} onChange={(e) => setFormData({ ...formData, tb_histories: e.target.value })} />
              </div>
              <div>
                <Label>ID Gestor</Label>
                <Input value={String(formData.id_gestor ?? "")} onChange={(e) => setFormData({ ...formData, id_gestor: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={isAtivo(formData.ativa) ? "true" : "false"} onValueChange={(v) => setFormData({ ...formData, ativa: v === "true" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Salvando...</> : <><Save className="h-4 w-4 mr-1" />{editing ? "Atualizar" : "Inserir"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
