import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

// Default permissions based on hardcoded logic in useUserAccessType
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

const ControleAcessos = () => {
  const [selectedTipo, setSelectedTipo] = useState<string>("");
  const [permissoesAtivas, setPermissoesAtivas] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadPermissoes = useCallback(async (tipo: string) => {
    if (!tipo) return;
    setLoading(true);
    try {
      // Start with defaults for this tipo
      const defaults = getDefaultPermissions(tipo as TipoAcesso);

      // Load overrides from DB
      const { data, error } = await supabase
        .from("departamento_permissoes")
        .select("permissao, ativo")
        .eq("departamento", tipo);

      if (error) throw error;

      // Merge: DB overrides defaults
      const merged = { ...defaults };
      data?.forEach((row) => {
        merged[row.permissao] = row.ativo;
      });
      setPermissoesAtivas(merged);
    } catch (err) {
      console.error("Erro ao carregar permissões:", err);
      toast.error("Erro ao carregar permissões");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTipo) loadPermissoes(selectedTipo);
  }, [selectedTipo, loadPermissoes]);

  const handleToggle = async (permissao: string, checked: boolean) => {
    if (!selectedTipo) return;
    setSaving(permissao);
    try {
      const { error } = await supabase
        .from("departamento_permissoes")
        .upsert(
          {
            departamento: selectedTipo,
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
              Defina quais permissões cada tipo de acesso possui no sistema
            </p>
          </div>

          {/* Tipo de Acesso selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selecione o Tipo de Acesso</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Escolha um tipo de acesso..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ACESSO.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Permissions */}
          {selectedTipo && (
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
                              id={`${selectedTipo}-${perm.key}`}
                              checked={permissoesAtivas[perm.key] ?? false}
                              onCheckedChange={(checked) =>
                                handleToggle(perm.key, checked === true)
                              }
                              disabled={saving === perm.key}
                            />
                            <Label
                              htmlFor={`${selectedTipo}-${perm.key}`}
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

          {!selectedTipo && (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Selecione um tipo de acesso para gerenciar suas permissões</p>
            </div>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default ControleAcessos;
