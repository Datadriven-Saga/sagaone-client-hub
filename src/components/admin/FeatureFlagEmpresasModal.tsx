import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Building2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { FeatureFlag } from "@/hooks/useFeatureFlags";

interface Props {
  flag: FeatureFlag | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FlagEmpresa {
  id: string;
  empresa_id: string;
  is_enabled: boolean;
  empresa_nome: string;
}

interface Empresa {
  id: string;
  nome_empresa: string;
}

export function FeatureFlagEmpresasModal({ flag, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigned, setAssigned] = useState<FlagEmpresa[]>([]);
  const [allEmpresas, setAllEmpresas] = useState<Empresa[]>([]);
  const [search, setSearch] = useState("");
  const [showAddList, setShowAddList] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!flag) return;
    setLoading(true);
    try {
      // Load assigned empresas
      const { data: flagEmpresas, error: feError } = await supabase
        .from("feature_flag_empresas")
        .select("id, empresa_id, is_enabled")
        .eq("flag_id", flag.id);
      if (feError) throw feError;

      // Load all empresas
      const { data: empresas, error: eError } = await supabase
        .from("empresas")
        .select("id, nome_empresa")
        .order("nome_empresa");
      if (eError) throw eError;

      setAllEmpresas(empresas || []);

      // Merge names
      const merged = (flagEmpresas || []).map((fe: any) => {
        const emp = (empresas || []).find((e: any) => e.id === fe.empresa_id);
        return { ...fe, empresa_nome: emp?.nome_empresa || "Desconhecida" };
      }).sort((a: FlagEmpresa, b: FlagEmpresa) => a.empresa_nome.localeCompare(b.empresa_nome));

      setAssigned(merged);
    } catch (err: any) {
      toast.error("Erro ao carregar dados", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [flag]);

  useEffect(() => {
    if (open && flag) {
      loadData();
      setSearch("");
      setAddSearch("");
      setShowAddList(false);
    }
  }, [open, flag, loadData]);

  const handleToggle = async (item: FlagEmpresa) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("feature_flag_empresas")
        .update({ is_enabled: !item.is_enabled })
        .eq("id", item.id);
      if (error) throw error;
      setAssigned((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, is_enabled: !a.is_enabled } : a))
      );
    } catch (err: any) {
      toast.error("Erro ao atualizar", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (empresaId: string) => {
    if (!flag) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("feature_flag_empresas").insert({
        flag_id: flag.id,
        empresa_id: empresaId,
        is_enabled: true,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Loja adicionada");
      await loadData();
      setShowAddList(false);
      setAddSearch("");
    } catch (err: any) {
      toast.error("Erro ao adicionar", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (item: FlagEmpresa) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("feature_flag_empresas").delete().eq("id", item.id);
      if (error) throw error;
      setAssigned((prev) => prev.filter((a) => a.id !== item.id));
      toast.success("Loja removida");
    } catch (err: any) {
      toast.error("Erro ao remover", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const assignedIds = new Set(assigned.map((a) => a.empresa_id));
  const unassigned = allEmpresas.filter(
    (e) =>
      !assignedIds.has(e.id) &&
      (!addSearch || e.nome_empresa.toLowerCase().includes(addSearch.toLowerCase()))
  );

  const filteredAssigned = assigned.filter(
    (a) => !search || a.empresa_nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Lojas — {flag?.flag_label}
          </DialogTitle>
          <DialogDescription>
            Gerencie quais lojas têm esta feature habilitada. Apenas lojas atribuídas terão acesso.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {/* Actions bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar lojas atribuídas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddList(!showAddList)}
                variant={showAddList ? "secondary" : "default"}
              >
                <Plus className="h-4 w-4 mr-1" />
                Atribuir
              </Button>
            </div>

            <Badge variant="secondary" className="w-fit">
              {assigned.filter((a) => a.is_enabled).length}/{assigned.length} lojas ativas
            </Badge>

            {/* Add list */}
            {showAddList && (
              <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar loja para adicionar..."
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    className="pl-8 h-9"
                    autoFocus
                  />
                </div>
                <ScrollArea className="max-h-[180px]">
                  <div className="space-y-1">
                    {unassigned.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">
                        {addSearch ? "Nenhuma loja encontrada" : "Todas as lojas já foram atribuídas"}
                      </p>
                    ) : (
                      unassigned.slice(0, 50).map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => handleAdd(emp.id)}
                          disabled={saving}
                          className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors flex items-center justify-between"
                        >
                          <span className="truncate">{emp.nome_empresa}</span>
                          <Plus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Assigned list */}
            <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
              <div className="space-y-1">
                {filteredAssigned.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma loja atribuída
                  </p>
                ) : (
                  filteredAssigned.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-muted/40 transition-colors"
                    >
                      <span className="text-sm font-medium truncate flex-1">{item.empresa_nome}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Switch
                          checked={item.is_enabled}
                          onCheckedChange={() => handleToggle(item)}
                          disabled={saving}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(item)}
                          disabled={saving}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
