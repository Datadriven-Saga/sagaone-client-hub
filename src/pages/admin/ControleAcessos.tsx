import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

// All permission keys the system uses, with human-readable labels and categories
const PERMISSOES_SISTEMA: { key: string; label: string; categoria: string }[] = [
  // Templates
  { key: "canCreateTemplates", label: "Criar templates", categoria: "Templates" },
  // Eventos
  { key: "canCreateEventos", label: "Criar eventos", categoria: "Eventos" },
  { key: "canManageEvents", label: "Gerenciar eventos (editar/excluir geral)", categoria: "Eventos" },
  { key: "canManageEventos", label: "Gerenciar eventos (admin)", categoria: "Eventos" },
  // IA
  { key: "canCreateIALigacao", label: "Criar eventos IA Ligação", categoria: "IA" },
  { key: "canDispararIALigacao", label: "Disparar eventos IA Ligação", categoria: "IA" },
  { key: "canAccessAgentesIA", label: "Acessar Agentes IA", categoria: "IA" },
  // Disparo
  { key: "canDispararEventos", label: "Disparar eventos", categoria: "Disparos" },
  // Base / Contatos
  { key: "canUploadBase", label: "Subir base de leads", categoria: "Base / Contatos" },
  { key: "canAddClientes", label: "Adicionar clientes", categoria: "Base / Contatos" },
  { key: "canImportClientes", label: "Importar clientes", categoria: "Base / Contatos" },
  // Recepção / QR Code
  { key: "canAccessRecepcao", label: "Acessar Recepção", categoria: "Recepção" },
  { key: "canReadQRCode", label: "Ler QR Code / Check-in", categoria: "Recepção" },
  // Convites
  { key: "canGenerateInvites", label: "Gerar convites / QR Codes", categoria: "Convites" },
  // Kanban
  { key: "canAccessKanban", label: "Acessar Kanban de atendimentos", categoria: "Kanban" },
  // Admin
  { key: "canManageUsers", label: "Gerenciar usuários", categoria: "Administração" },
  { key: "canAccessAdminConfig", label: "Acessar configurações administrativas", categoria: "Administração" },
  { key: "canManageProspeccaoEquipes", label: "Gerenciar equipes de prospecção", categoria: "Administração" },
  // Financeiro
  { key: "canAccessFinancialReports", label: "Acessar relatórios financeiros", categoria: "Financeiro" },
];

// Group permissions by category
function groupByCategoria(perms: typeof PERMISSOES_SISTEMA) {
  const grouped: Record<string, typeof PERMISSOES_SISTEMA> = {};
  for (const p of perms) {
    if (!grouped[p.categoria]) grouped[p.categoria] = [];
    grouped[p.categoria].push(p);
  }
  return grouped;
}

const ControleAcessos = () => {
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [permissoesAtivas, setPermissoesAtivas] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Fetch distinct departments from departamentos table + profiles
  useEffect(() => {
    const fetchDepts = async () => {
      const { data: deptData } = await supabase
        .from("departamentos")
        .select("nome")
        .eq("ativo", true);

      const { data: profileDepts } = await supabase
        .from("profiles")
        .select("departamento")
        .not("departamento", "is", null);

      const set = new Set<string>();
      deptData?.forEach((d) => d.nome && set.add(d.nome));
      profileDepts?.forEach((p) => {
        const dept = (p as any).departamento;
        if (dept && typeof dept === "string" && dept.trim()) set.add(dept.trim());
      });

      const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
      setDepartamentos(sorted);
    };
    fetchDepts();
  }, []);

  // Load permissions for selected department
  const loadPermissoes = useCallback(async (dept: string) => {
    if (!dept) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("departamento_permissoes")
        .select("permissao, ativo")
        .eq("departamento", dept);

      if (error) throw error;

      const map: Record<string, boolean> = {};
      PERMISSOES_SISTEMA.forEach((p) => (map[p.key] = false));
      data?.forEach((row) => {
        map[row.permissao] = row.ativo;
      });
      setPermissoesAtivas(map);
    } catch (err) {
      console.error("Erro ao carregar permissões:", err);
      toast.error("Erro ao carregar permissões");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDept) loadPermissoes(selectedDept);
  }, [selectedDept, loadPermissoes]);

  const handleToggle = async (permissao: string, checked: boolean) => {
    if (!selectedDept) return;
    setSaving(permissao);
    try {
      // Upsert
      const { error } = await supabase
        .from("departamento_permissoes")
        .upsert(
          {
            departamento: selectedDept,
            permissao,
            ativo: checked,
          },
          { onConflict: "departamento,permissao" }
        );

      if (error) throw error;

      setPermissoesAtivas((prev) => ({ ...prev, [permissao]: checked }));
      toast.success(`Permissão ${checked ? "concedida" : "removida"}`);
    } catch (err) {
      console.error("Erro ao salvar permissão:", err);
      toast.error("Erro ao salvar permissão");
    } finally {
      setSaving(null);
    }
  };

  const grouped = groupByCategoria(PERMISSOES_SISTEMA);

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <ShieldCheck className="h-8 w-8" />
              Controle de Acessos
            </h1>
            <p className="text-muted-foreground">
              Defina quais permissões cada departamento possui no sistema
            </p>
          </div>

          {/* Department selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selecione o Departamento</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Escolha um departamento..." />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Permissions */}
          {selectedDept && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(grouped).map(([categoria, perms]) => (
                    <Card key={categoria}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          {categoria}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {perms.map((perm) => (
                          <div key={perm.key} className="flex items-center gap-3">
                            <Checkbox
                              id={`${selectedDept}-${perm.key}`}
                              checked={permissoesAtivas[perm.key] ?? false}
                              onCheckedChange={(checked) =>
                                handleToggle(perm.key, checked === true)
                              }
                              disabled={saving === perm.key}
                            />
                            <Label
                              htmlFor={`${selectedDept}-${perm.key}`}
                              className="text-sm cursor-pointer"
                            >
                              {perm.label}
                            </Label>
                            {saving === perm.key && (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {!selectedDept && (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Selecione um departamento para gerenciar suas permissões</p>
            </div>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default ControleAcessos;
