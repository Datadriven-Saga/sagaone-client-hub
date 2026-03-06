import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { FeatureFlag } from "@/hooks/useFeatureFlags";

interface Props {
  flag: FeatureFlag | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Empresa {
  id: string;
  nome_empresa: string;
  marca: string | null;
  cidade: string | null;
  uf: string | null;
}

export function FeatureFlagEmpresasModal({ flag, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allEmpresas, setAllEmpresas] = useState<Empresa[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters
  const [filterNome, setFilterNome] = useState("");
  const [filterMarca, setFilterMarca] = useState("all");
  const [filterUF, setFilterUF] = useState("all");

  const loadData = useCallback(async () => {
    if (!flag) return;
    setLoading(true);
    try {
      const [{ data: empresas, error: eError }, { data: flagEmpresas, error: feError }] = await Promise.all([
        supabase.from("empresas").select("id, nome_empresa, marca, cidade, uf").order("nome_empresa"),
        supabase.from("feature_flag_empresas").select("empresa_id").eq("flag_id", flag.id).eq("is_enabled", true),
      ]);
      if (eError) throw eError;
      if (feError) throw feError;

      setAllEmpresas(empresas || []);
      const ids = new Set((flagEmpresas || []).map((fe: any) => fe.empresa_id));
      setAssignedIds(ids);
      setSelectedIds(Array.from(ids));
    } catch (err: any) {
      toast.error("Erro ao carregar dados", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [flag]);

  useEffect(() => {
    if (open && flag) {
      loadData();
      setFilterNome("");
      setFilterMarca("all");
      setFilterUF("all");
    }
  }, [open, flag, loadData]);

  const uniqueMarcas = useMemo(
    () => [...new Set(allEmpresas.map((e) => e.marca).filter(Boolean) as string[])].sort(),
    [allEmpresas]
  );

  const uniqueUFs = useMemo(
    () => [...new Set(allEmpresas.map((e) => e.uf).filter(Boolean) as string[])].sort(),
    [allEmpresas]
  );

  const filteredEmpresas = useMemo(() => {
    return allEmpresas.filter((e) => {
      if (filterNome && !e.nome_empresa.toLowerCase().includes(filterNome.toLowerCase())) return false;
      if (filterMarca !== "all" && e.marca !== filterMarca) return false;
      if (filterUF !== "all" && e.uf !== filterUF) return false;
      return true;
    });
  }, [allEmpresas, filterNome, filterMarca, filterUF]);

  const handleToggleEmpresa = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const filteredIds = filteredEmpresas.map((e) => e.id);
    const allSelected = filteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleConfirm = async () => {
    if (!flag) return;
    setSaving(true);
    try {
      const toAdd = selectedIds.filter((id) => !assignedIds.has(id));
      const toRemove = Array.from(assignedIds).filter((id) => !selectedIds.includes(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("feature_flag_empresas")
          .delete()
          .eq("flag_id", flag.id)
          .in("empresa_id", toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map((empresa_id) => ({
          flag_id: flag.id,
          empresa_id,
          is_enabled: true,
          created_by: user?.id,
        }));
        const { error } = await supabase.from("feature_flag_empresas").insert(rows);
        if (error) throw error;
      }

      toast.success(`${selectedIds.length} loja(s) atribuída(s)`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const allFilteredSelected =
    filteredEmpresas.length > 0 && filteredEmpresas.every((e) => selectedIds.includes(e.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Lojas — {flag?.flag_label}
          </DialogTitle>
          <DialogDescription>
            Selecione as lojas que terão esta feature habilitada.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 flex-shrink-0">
              <div className="space-y-1">
                <Label className="text-xs">Buscar por Nome</Label>
                <Input
                  placeholder="Filtrar por nome..."
                  value={filterNome}
                  onChange={(e) => setFilterNome(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marca</Label>
                <Select value={filterMarca} onValueChange={setFilterMarca}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {uniqueMarcas.map((marca) => (
                      <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UF</Label>
                <Select value={filterUF} onValueChange={setFilterUF}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {uniqueUFs.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Counter + Select all */}
            <div className="flex items-center justify-between pb-2 border-b flex-shrink-0">
              <span className="text-sm text-muted-foreground">
                {filteredEmpresas.length} empresa(s) encontrada(s)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {allFilteredSelected ? "Desmarcar todas" : "Selecionar todas"}
                </Button>
                <Badge variant="secondary">{selectedIds.length} selecionada(s)</Badge>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto mt-2 space-y-1 min-h-0">
              {filteredEmpresas.map((empresa) => (
                <div
                  key={empresa.id}
                  className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedIds.includes(empresa.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => handleToggleEmpresa(empresa.id)}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                      selectedIds.includes(empresa.id)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-input"
                    }`}
                  >
                    {selectedIds.includes(empresa.id) && (
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{empresa.nome_empresa}</div>
                    <div className="text-xs text-muted-foreground">
                      {empresa.marca} • {empresa.cidade} - {empresa.uf}
                    </div>
                  </div>
                </div>
              ))}
              {filteredEmpresas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma empresa encontrada</p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
