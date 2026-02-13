import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Store,
  RefreshCw,
  Plus,
  Edit,
  Save,
  X,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LojaGaia {
  id?: number;
  dealerid: string;
  loja_nome: string;
  uf: string;
  ativa: boolean;
  tb_histories: string;
  maia_id: string;
  chatwoot: string;
  [key: string]: any;
}

interface AgenteLojaProps {
  agenteNome?: string;
  agenteTelefone?: string;
}

const UF_OPTIONS = ["DF", "GO", "MG", "MT", "RO"];

function isStatusAtivo(status: any): boolean {
  if (typeof status === "boolean") return status;
  const s = String(status ?? "").toLowerCase().trim();
  return s === "true" || s === "ativo" || s === "1";
}

export function AgenteLojas({ agenteNome, agenteTelefone }: AgenteLojaProps) {
  const { toast } = useToast();
  const [lojas, setLojas] = useState<LojaGaia[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUF, setFilterUF] = useState<string>("all");

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingLoja, setEditingLoja] = useState<LojaGaia | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<LojaGaia>({
    dealerid: "",
    loja_nome: "",
    uf: "",
    ativa: true,
    status: "true",
    tb_histories: "tb_gaia_histories",
    maia_id: agenteTelefone || "",
    chatwoot: "",
    id_gestor: "",
  });

  const fetchLojas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: {
          endpoint: "verifca-lojas",
        },
      });

      if (error) throw new Error(error.message);

      const lojasArray = Array.isArray(data) ? data : data ? [data] : [];
      setLojas(lojasArray);
    } catch (err) {
      console.error("Erro ao buscar lojas:", err);
      toast({
        title: "Erro ao carregar lojas",
        description: "Não foi possível buscar as lojas do Gaia",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLojas();
  }, [fetchLojas]);

  const handleOpenAdd = () => {
    setEditingLoja(null);
    setFormData({
      dealerid: "",
      loja_nome: "",
      uf: "",
      ativa: true,
      status: "true",
      tb_histories: "tb_gaia_histories",
      maia_id: agenteTelefone || "",
      chatwoot: "",
      id_gestor: "",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (loja: LojaGaia) => {
    setEditingLoja(loja);
    setFormData({
      dealerid: loja.dealerid || "",
      loja_nome: loja.loja_nome || "",
      uf: loja.uf || "",
      ativa: isStatusAtivo(loja.ativa),
      status: isStatusAtivo(loja.ativa) ? "true" : "false",
      tb_histories: loja.tb_histories || "tb_gaia_histories",
      maia_id: loja.maia_id || agenteTelefone || "",
      chatwoot: loja.chatwoot || "",
      id_gestor: loja.idgestor || loja.id_gestor || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.dealerid || !formData.loja_nome || !formData.uf) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha dealerid, nome da loja e UF",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const isUpdate = !!editingLoja?.id;
      const endpoint = isUpdate ? "update-lojas-gaia" : "insere-loja";

      const payload: any = {
        dealerid: formData.dealerid,
        loja_nome: formData.loja_nome,
        uf: formData.uf,
        ativa: formData.status === "true",
        tb_histories: formData.tb_histories,
        maia_id: formData.maia_id,
        chatwoot: formData.chatwoot,
        id_gestor: formData.id_gestor || null,
      };

      // Include id only for update
      if (isUpdate && editingLoja?.id) {
        payload.id = editingLoja.id;
      }

      const { data, error } = await supabase.functions.invoke("external-webhook-proxy", {
        body: {
          endpoint,
          ...payload,
        },
      });

      if (error) throw new Error(error.message);

      toast({
        title: isUpdate ? "Loja atualizada" : "Loja inserida",
        description: `${formData.loja_nome} ${isUpdate ? "atualizada" : "inserida"} com sucesso`,
      });

      setShowModal(false);
      await fetchLojas();
    } catch (err) {
      console.error("Erro ao salvar loja:", err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a loja",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter lojas
  const filteredLojas = lojas.filter((loja) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !String(loja.loja_nome || "").toLowerCase().includes(term) &&
        !String(loja.dealerid || "").toLowerCase().includes(term) &&
        !String(loja.maia_id || "").toLowerCase().includes(term)
      )
        return false;
    }
    if (filterUF !== "all" && loja.uf?.toUpperCase() !== filterUF.toUpperCase()) return false;
    return true;
  });

  const uniqueUFs = [...new Set(lojas.map((l) => l.uf?.toUpperCase()).filter(Boolean))].sort();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Lojas Gaia
            </CardTitle>
            <CardDescription className="mt-1">
              Gerencie as lojas vinculadas ao agente Gaia
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchLojas} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Loja
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
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
            <SelectTrigger className="w-32">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas UF</SelectItem>
              {uniqueUFs.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLojas.length === 0 ? (
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
                  <TableHead>Histórico</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLojas.map((loja, idx) => (
                  <TableRow key={loja.id ?? idx}>
                    <TableCell className="font-mono text-xs">{loja.id ?? "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{loja.dealerid}</TableCell>
                    <TableCell className="font-medium">{loja.loja_nome}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{loja.uf}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isStatusAtivo(loja.ativa) ? "default" : "outline"}>
                        {isStatusAtivo(loja.ativa) ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{loja.maia_id}</TableCell>
                    <TableCell className="font-mono text-xs">{loja.chatwoot}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{loja.tb_histories}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(loja)}>
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
          {filteredLojas.length} loja(s) encontrada(s)
        </div>
      </CardContent>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLoja ? "Editar Loja" : "Nova Loja"}</DialogTitle>
            <DialogDescription>
              {editingLoja
                ? `Editando loja ${editingLoja.loja_nome} (ID: ${editingLoja.id})`
                : "Preencha os dados para inserir uma nova loja no Gaia"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dealer ID *</Label>
                <Input
                  value={formData.dealerid}
                  onChange={(e) => setFormData({ ...formData, dealerid: e.target.value })}
                  placeholder="Ex: 1234"
                />
              </div>
              <div>
                <Label>UF *</Label>
                <Select value={formData.uf} onValueChange={(v) => setFormData({ ...formData, uf: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nome da Loja *</Label>
              <Input
                value={formData.loja_nome}
                onChange={(e) => setFormData({ ...formData, loja_nome: e.target.value })}
                placeholder="Ex: Saga Jeep Brasília"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Maia ID</Label>
                <Input
                  value={formData.maia_id}
                  onChange={(e) => setFormData({ ...formData, maia_id: e.target.value })}
                  placeholder="Ex: 6298705432"
                />
              </div>
              <div>
                <Label>Chatwoot</Label>
                <Input
                  value={formData.chatwoot}
                  onChange={(e) => setFormData({ ...formData, chatwoot: e.target.value })}
                  placeholder="Ex: 103"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tabela Histórico</Label>
                <Input
                  value={formData.tb_histories}
                  onChange={(e) => setFormData({ ...formData, tb_histories: e.target.value })}
                  placeholder="tb_gaia_histories"
                />
              </div>
              <div>
                <Label>ID Gestor</Label>
                <Input
                  value={formData.id_gestor || ""}
                  onChange={(e) => setFormData({ ...formData, id_gestor: e.target.value })}
                  placeholder="Ex: 123"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  {editingLoja ? "Atualizar" : "Inserir"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
