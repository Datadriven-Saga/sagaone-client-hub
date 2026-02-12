import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useMfaMaster } from "@/hooks/useMfaMaster";
import { PermissionModuleView } from "@/components/controle-acessos/PermissionModuleView";
import { PermissionProfileView } from "@/components/controle-acessos/PermissionProfileView";
import { PermissionCompareView } from "@/components/controle-acessos/PermissionCompareView";
import {
  PERMISSION_REGISTRY,
  TIPOS_ACESSO,
  getDefaultPermissions,
  resolvePermissions,
  type TipoAcesso,
} from "@/components/controle-acessos/PermissionRegistry";

const ControleAcessos = () => {
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isMaster } = useMfaMaster();

  const loadAllOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("departamento_permissoes")
        .select("departamento, permissao, ativo");

      if (error) throw error;

      const ov: Record<string, Record<string, boolean>> = {};
      data?.forEach((row) => {
        if (!ov[row.departamento]) ov[row.departamento] = {};
        ov[row.departamento][row.permissao] = row.ativo;
      });
      setOverrides(ov);
    } catch (err) {
      console.error("Erro ao carregar permissões:", err);
      toast.error("Erro ao carregar permissões");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllOverrides();
  }, [loadAllOverrides]);

  // Optimistic upsert
  const handleToggle = useCallback(async (permissao: string, tipo: string, ativo: boolean) => {
    const key = `${permissao}-${tipo}`;
    setSaving(key);

    // Optimistic update
    setOverrides(prev => {
      const next = { ...prev };
      if (!next[tipo]) next[tipo] = {};
      next[tipo] = { ...next[tipo], [permissao]: ativo };
      return next;
    });

    try {
      const { error } = await supabase
        .from("departamento_permissoes")
        .upsert(
          { departamento: tipo, permissao, ativo },
          { onConflict: "departamento,permissao" }
        );
      if (error) throw error;
    } catch (err) {
      // Revert
      setOverrides(prev => {
        const next = { ...prev };
        if (next[tipo]) {
          const { [permissao]: _, ...rest } = next[tipo];
          next[tipo] = rest;
        }
        return next;
      });
      console.error("Erro ao atualizar permissão:", err);
      toast.error("Erro ao atualizar permissão");
    } finally {
      setSaving(null);
    }
  }, []);

  // Clone all permissions from source to target
  const handleCloneProfile = useCallback(async (source: TipoAcesso, target: TipoAcesso) => {
    const sourceDefaults = getDefaultPermissions(source);
    const sourceOverrides = overrides[source] || {};
    const resolved: Record<string, boolean> = {};

    for (const perm of PERMISSION_REGISTRY) {
      resolved[perm.key] = sourceOverrides[perm.key] ?? sourceDefaults[perm.key];
    }

    // Batch upsert all permissions for target
    const rows = Object.entries(resolved).map(([permissao, ativo]) => ({
      departamento: target,
      permissao,
      ativo,
    }));

    // Optimistic
    setOverrides(prev => ({
      ...prev,
      [target]: { ...resolved },
    }));

    try {
      const { error } = await supabase
        .from("departamento_permissoes")
        .upsert(rows, { onConflict: "departamento,permissao" });
      if (error) throw error;
      toast.success(`Permissões de ${source} clonadas para ${target}`);
    } catch (err) {
      console.error("Erro ao clonar permissões:", err);
      toast.error("Erro ao clonar permissões");
      loadAllOverrides(); // Reload on error
    }
  }, [overrides, loadAllOverrides]);

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <ShieldCheck className="h-8 w-8" />
              Permission Flags
            </h1>
            <p className="text-muted-foreground">
              Gerencie todas as permissões do sistema organizadas por módulo, perfil ou comparação
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="modules" className="w-full">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="modules">Por Módulo</TabsTrigger>
                <TabsTrigger value="profile">Por Perfil</TabsTrigger>
                <TabsTrigger value="compare">Comparar</TabsTrigger>
              </TabsList>

              <TabsContent value="modules" className="mt-4">
                <PermissionModuleView
                  isMaster={isMaster}
                  overrides={overrides}
                  saving={saving}
                  onToggle={handleToggle}
                />
              </TabsContent>

              <TabsContent value="profile" className="mt-4">
                <PermissionProfileView
                  isMaster={isMaster}
                  overrides={overrides}
                  saving={saving}
                  onToggle={handleToggle}
                  onCloneProfile={handleCloneProfile}
                />
              </TabsContent>

              <TabsContent value="compare" className="mt-4">
                <PermissionCompareView
                  isMaster={isMaster}
                  overrides={overrides}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default ControleAcessos;
