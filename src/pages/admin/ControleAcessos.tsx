import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const TIPOS_ACESSO = [
  "SDR",
  "Vendedor",
  "CRM",
  "Recepcionista",
  "Gerente de Leads",
  "Gerente de Loja",
  "Coordenadora de Leads",
  "Diretor",
  "TI",
  "Administrador",
  "Proprietário",
] as const;

type TipoAcesso = (typeof TIPOS_ACESSO)[number];

interface PermissaoInfo {
  key: string;
  label: string;
  categoria: string;
}

const PERMISSOES_SISTEMA: PermissaoInfo[] = [
  { key: "canCreateTemplates", label: "Criar templates", categoria: "Templates" },
  { key: "canCreateEventos", label: "Criar eventos", categoria: "Eventos" },
  { key: "canManageEvents", label: "Gerenciar eventos (editar/excluir geral)", categoria: "Eventos" },
  { key: "canManageEventos", label: "Gerenciar eventos (admin)", categoria: "Eventos" },
  { key: "canCreateIALigacao", label: "Criar eventos IA Ligação", categoria: "IA" },
  { key: "canDispararIALigacao", label: "Disparar eventos IA Ligação", categoria: "IA" },
  { key: "canAccessAgentesIA", label: "Acessar Agentes IA", categoria: "IA" },
  { key: "canDispararEventos", label: "Disparar eventos", categoria: "Disparos" },
  { key: "canUploadBase", label: "Subir base de leads", categoria: "Base / Contatos" },
  { key: "canAddClientes", label: "Adicionar clientes", categoria: "Base / Contatos" },
  { key: "canImportClientes", label: "Importar clientes", categoria: "Base / Contatos" },
  { key: "canAccessRecepcao", label: "Acessar Recepção", categoria: "Recepção" },
  { key: "canReadQRCode", label: "Ler QR Code / Check-in", categoria: "Recepção" },
  { key: "canGenerateInvites", label: "Gerar convites / QR Codes", categoria: "Convites" },
  { key: "canAccessKanban", label: "Acessar Kanban de atendimentos", categoria: "Kanban" },
  { key: "canManageUsers", label: "Gerenciar usuários", categoria: "Administração" },
  { key: "canAccessAdminConfig", label: "Acessar configurações administrativas", categoria: "Administração" },
  { key: "canManageProspeccaoEquipes", label: "Gerenciar equipes de prospecção", categoria: "Administração" },
  { key: "canAccessFinancialReports", label: "Acessar relatórios financeiros", categoria: "Financeiro" },
];

function getDefaultPermissions(tipo: TipoAcesso): Record<string, boolean> {
  const isAdmin = tipo === "Administrador";
  const isTI = tipo === "TI";
  const isAdminOrTI = isAdmin || isTI;
  const isDiretor = tipo === "Diretor";
  const isGerenteLeads = tipo === "Gerente de Leads";
  const isGerenteLoja = tipo === "Gerente de Loja";
  const isCoordenadoraLeads = tipo === "Coordenadora de Leads";
  const isCRM = tipo === "CRM";
  const isRecepcionista = tipo === "Recepcionista";
  const isProprietario = tipo === "Proprietário";

  return {
    canCreateTemplates: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canCreateEventos: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canManageEvents: !isRecepcionista,
    canManageEventos: isAdminOrTI,
    canCreateIALigacao: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads,
    canDispararIALigacao: isAdminOrTI,
    canAccessAgentesIA: false,
    canDispararEventos: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canUploadBase: isAdmin || isTI || isCRM || isGerenteLeads || isCoordenadoraLeads || isGerenteLoja,
    canAddClientes: isAdmin || isCRM,
    canImportClientes: isAdmin || isTI || isCRM,
    canAccessRecepcao: isAdmin || isRecepcionista,
    canReadQRCode: isAdmin || isRecepcionista,
    canGenerateInvites: !isRecepcionista,
    canAccessKanban: !isRecepcionista,
    canManageUsers: isAdminOrTI,
    canAccessAdminConfig: isAdminOrTI,
    canManageProspeccaoEquipes: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM || isGerenteLoja,
    canAccessFinancialReports: isAdmin || isTI || isDiretor || isProprietario,
  };
}

function groupByCategoria(perms: PermissaoInfo[]) {
  const grouped: Record<string, PermissaoInfo[]> = {};
  for (const p of perms) {
    if (!grouped[p.categoria]) grouped[p.categoria] = [];
    grouped[p.categoria].push(p);
  }
  return grouped;
}

// Build a map: permissao -> Set of tipos that have it active
function buildPermissaoTiposMap(
  overrides: Record<string, Record<string, boolean>>
): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  for (const perm of PERMISSOES_SISTEMA) {
    map[perm.key] = new Set<string>();
  }
  for (const tipo of TIPOS_ACESSO) {
    const defaults = getDefaultPermissions(tipo);
    const tipoOverrides = overrides[tipo] || {};
    for (const perm of PERMISSOES_SISTEMA) {
      const active = tipoOverrides[perm.key] ?? defaults[perm.key];
      if (active) {
        map[perm.key].add(tipo);
      }
    }
  }
  return map;
}

const ControleAcessos = () => {
  const [permTiposMap, setPermTiposMap] = useState<Record<string, Set<string>>>({});
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const navigate = useNavigate();

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
      setPermTiposMap(buildPermissaoTiposMap(ov));
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

  const handleAdd = async (permissao: string, tipo: string) => {
    setSaving(`${permissao}-${tipo}`);
    try {
      const { error } = await supabase
        .from("departamento_permissoes")
        .upsert(
          { departamento: tipo, permissao, ativo: true },
          { onConflict: "departamento,permissao" }
        );
      if (error) throw error;

      setOverrides((prev) => {
        const next = { ...prev };
        if (!next[tipo]) next[tipo] = {};
        next[tipo][permissao] = true;
        return next;
      });
      setPermTiposMap((prev) => {
        const next = { ...prev };
        next[permissao] = new Set(prev[permissao]);
        next[permissao].add(tipo);
        return next;
      });
      toast.success(`${tipo} adicionado à permissão`);
    } catch (err) {
      console.error("Erro ao adicionar permissão:", err);
      toast.error("Erro ao adicionar permissão");
    } finally {
      setSaving(null);
    }
  };

  const handleRemove = async (permissao: string, tipo: string) => {
    setSaving(`${permissao}-${tipo}`);
    try {
      const { error } = await supabase
        .from("departamento_permissoes")
        .upsert(
          { departamento: tipo, permissao, ativo: false },
          { onConflict: "departamento,permissao" }
        );
      if (error) throw error;

      setOverrides((prev) => {
        const next = { ...prev };
        if (!next[tipo]) next[tipo] = {};
        next[tipo][permissao] = false;
        return next;
      });
      setPermTiposMap((prev) => {
        const next = { ...prev };
        next[permissao] = new Set(prev[permissao]);
        next[permissao].delete(tipo);
        return next;
      });
      toast.success(`${tipo} removido da permissão`);
    } catch (err) {
      console.error("Erro ao remover permissão:", err);
      toast.error("Erro ao remover permissão");
    } finally {
      setSaving(null);
    }
  };

  const grouped = groupByCategoria(PERMISSOES_SISTEMA);

  const getAvailableTipos = (permissao: string) => {
    const current = permTiposMap[permissao] || new Set();
    return TIPOS_ACESSO.filter((t) => !current.has(t));
  };

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="mb-2 -ml-2 gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <ShieldCheck className="h-8 w-8" />
              Controle de Acessos
            </h1>
            <p className="text-muted-foreground">
              Gerencie quais tipos de acesso possuem cada permissão do sistema
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([categoria, perms]) => (
                <Card key={categoria}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {categoria}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {perms.map((perm) => {
                      const activeTipos = Array.from(permTiposMap[perm.key] || []);
                      const available = getAvailableTipos(perm.key);

                      return (
                        <div key={perm.key} className="border rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium text-foreground">{perm.label}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {activeTipos.length === 0 && (
                              <span className="text-xs text-muted-foreground italic">
                                Nenhum tipo de acesso atribuído
                              </span>
                            )}
                            {activeTipos.map((tipo) => (
                              <Badge
                                key={tipo}
                                variant="secondary"
                                className="gap-1 pr-1"
                              >
                                {tipo}
                                <button
                                  onClick={() => handleRemove(perm.key, tipo)}
                                  disabled={saving === `${perm.key}-${tipo}`}
                                  className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                                >
                                  {saving === `${perm.key}-${tipo}` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </button>
                              </Badge>
                            ))}

                            {available.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                                    <Plus className="h-3 w-3" />
                                    Adicionar
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2" align="start">
                                  <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {available.map((tipo) => (
                                      <button
                                        key={tipo}
                                        onClick={() => handleAdd(perm.key, tipo)}
                                        disabled={saving === `${perm.key}-${tipo}`}
                                        className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                                      >
                                        {tipo}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default ControleAcessos;
