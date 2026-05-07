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
  id?: number;
  marca: string;
  uf: string;
  dealer_id: number | string;
  movisis_id: number | string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

const UF_OPTIONS = ["DF", "GO", "MG", "MT", "RO"];
const MARCA_OPTIONS = ["HYUNDAI", "TOYOTA", "RAM", "JEEP", "FIAT", "CHEVROLET", "VOLKSWAGEN", "HONDA", "NISSAN", "FORD"];

export function LojasTab() {
  const { toast } = useToast();
  const [lojas, setLojas] = useState<LojaPaty[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUF, setFilterUF] = useState("all");
  const [filterMarca, setFilterMarca] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LojaPaty | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<LojaPaty>({
    marca: "", uf: "", dealer_id: "", movisis_id: "", ativo: true,
  });

  const fetchLojas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: { endpoint: "busca-paty-lojas-ids" },
      });
      if (error) throw new Error(error.message);
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      setLojas(arr as LojaPaty[]);
    } catch (err) {
      console.error("Erro ao buscar lojas Paty:", err);
      toast({ title: "Erro ao carregar lojas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchLojas(); }, [fetchLojas]);

  const openAdd = () => {
    console.log("[LojasTab] openAdd clicked");
    setEditing(null);
    setFormData({ marca: "", uf: "", dealer_id: "", movisis_id: "", ativo: true });
    setShowModal(true);
  };

  const openEdit = (l: LojaPaty) => {
    console.log("[LojasTab] openEdit clicked", l);
    setEditing(l);
    setFormData({ ...l });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.marca || !formData.uf || !formData.dealer_id || !formData.movisis_id) {
      toast({ title: "Campos obrigatórios", description: "Preencha marca, UF, dealer_id e movisis_id", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const payload: any = {
        ...(editing?.id ? { id: editing.id } : {}),
        marca: formData.marca,
        uf: formData.uf,
        dealer_id: Number(formData.dealer_id),
        movisis_id: Number(formData.movisis_id),
        ativo: !!formData.ativo,
      };
      const endpoint = editing?.id ? "atualiza-paty-lojas-ids" : "insere-paty-lojas-ids";
      const { error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: { endpoint, ...payload },
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
        !String(l.marca ?? "").toLowerCase().includes(t) &&
        !String(l.dealer_id ?? "").toLowerCase().includes(t) &&
        !String(l.movisis_id ?? "").toLowerCase().includes(t)
      ) return false;
    }
    if (filterUF !== "all" && l.uf?.toUpperCase() !== filterUF.toUpperCase()) return false;
    if (filterMarca !== "all" && l.marca?.toUpperCase() !== filterMarca.toUpperCase()) return false;
    if (filterStatus !== "all") {
      if (filterStatus === "ativo" && !l.ativo) return false;
      if (filterStatus === "inativo" && l.ativo) return false;
    }
    return true;
  });

  const ufs = [...new Set(lojas.map((l) => l.uf?.toUpperCase()).filter(Boolean))].sort();
  const marcas = [...new Set(lojas.map((l) => l.marca?.toUpperCase()).filter(Boolean))].sort();

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
              Mapeamento de Dealer ID ↔ Movisis ID por marca/UF (Pós-Vendas)
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
              placeholder="Buscar por marca, dealer ID ou movisis ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterMarca} onValueChange={setFilterMarca}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas marcas</SelectItem>
              {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterUF} onValueChange={setFilterUF}>
            <SelectTrigger className="w-28"><SelectValue placeholder="UF" /></SelectTrigger>
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
                  <TableHead>Marca</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Dealer ID</TableHead>
                  <TableHead>Movisis ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l, i) => (
                  <TableRow key={String(l.id ?? i)}>
                    <TableCell className="font-mono text-xs">{l.id ?? "-"}</TableCell>
                    <TableCell className="font-medium">{l.marca}</TableCell>
                    <TableCell><Badge variant="secondary">{l.uf}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{l.dealer_id}</TableCell>
                    <TableCell className="font-mono text-sm">{l.movisis_id}</TableCell>
                    <TableCell>
                      <Badge variant={l.ativo ? "default" : "outline"}>
                        {l.ativo ? "Ativo" : "Inativo"}
                      </Badge>
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

        <div className="text-xs text-muted-foreground">
          {filtered.length} loja(s) encontrada(s)
        </div>
      </CardContent>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Loja" : "Nova Loja"}</DialogTitle>
            <DialogDescription>
              {editing ? `Editando loja ID ${editing.id}` : "Insira um novo mapeamento Dealer ↔ Movisis"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Marca *</Label>
                <Select value={formData.marca} onValueChange={(v) => setFormData({ ...formData, marca: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {MARCA_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dealer ID *</Label>
                <Input
                  type="number"
                  value={String(formData.dealer_id ?? "")}
                  onChange={(e) => setFormData({ ...formData, dealer_id: e.target.value })}
                />
              </div>
              <div>
                <Label>Movisis ID *</Label>
                <Input
                  type="number"
                  value={String(formData.movisis_id ?? "")}
                  onChange={(e) => setFormData({ ...formData, movisis_id: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.ativo ? "true" : "false"} onValueChange={(v) => setFormData({ ...formData, ativo: v === "true" })}>
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
