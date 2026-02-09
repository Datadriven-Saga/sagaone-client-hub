import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
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
  // ── Templates ──
  { key: "canCreateTemplates", label: "Criar templates", categoria: "Templates" },
  { key: "canEditTemplates", label: "Editar templates", categoria: "Templates" },
  { key: "canDeleteTemplates", label: "Excluir templates", categoria: "Templates" },
  { key: "canViewTemplates", label: "Visualizar templates", categoria: "Templates" },

  // ── Eventos / Prospecção ──
  { key: "canCreateEventos", label: "Criar eventos", categoria: "Eventos" },
  { key: "canEditEventos", label: "Editar eventos", categoria: "Eventos" },
  { key: "canDeleteEventos", label: "Excluir eventos", categoria: "Eventos" },
  { key: "canManageEvents", label: "Gerenciar eventos (editar/excluir geral)", categoria: "Eventos" },
  { key: "canManageEventos", label: "Gerenciar eventos (admin)", categoria: "Eventos" },
  { key: "canViewEventos", label: "Visualizar eventos", categoria: "Eventos" },

  // ── IA ──
  { key: "canCreateIALigacao", label: "Criar eventos IA Ligação", categoria: "IA" },
  { key: "canDispararIALigacao", label: "Disparar eventos IA Ligação", categoria: "IA" },
  { key: "canAccessAgentesIA", label: "Acessar Agentes IA", categoria: "IA" },
  { key: "canEditAgentesIA", label: "Editar Agentes IA", categoria: "IA" },
  { key: "canDeleteAgentesIA", label: "Excluir Agentes IA", categoria: "IA" },
  { key: "canToggleIALigacao", label: "Ativar/Desativar IA Ligação", categoria: "IA" },

  // ── Disparos ──
  { key: "canDispararEventos", label: "Disparar eventos", categoria: "Disparos" },
  { key: "canRedispararEventos", label: "Redisparar eventos", categoria: "Disparos" },

  // ── Base / Contatos ──
  { key: "canUploadBase", label: "Subir base de leads", categoria: "Base / Contatos" },
  { key: "canAddClientes", label: "Adicionar clientes", categoria: "Base / Contatos" },
  { key: "canEditClientes", label: "Editar clientes", categoria: "Base / Contatos" },
  { key: "canDeleteClientes", label: "Excluir clientes", categoria: "Base / Contatos" },
  { key: "canImportClientes", label: "Importar clientes", categoria: "Base / Contatos" },
  { key: "canViewClientes", label: "Visualizar clientes", categoria: "Base / Contatos" },
  { key: "canDeleteContatos", label: "Excluir contatos", categoria: "Base / Contatos" },
  { key: "canEditContatos", label: "Editar contatos", categoria: "Base / Contatos" },

  // ── Recepção ──
  { key: "canAccessRecepcao", label: "Acessar Recepção", categoria: "Recepção" },
  { key: "canReadQRCode", label: "Ler QR Code / Check-in", categoria: "Recepção" },

  // ── Convites ──
  { key: "canGenerateInvites", label: "Gerar convites / QR Codes", categoria: "Convites" },

  // ── Kanban ──
  { key: "canAccessKanban", label: "Acessar Kanban de atendimentos", categoria: "Kanban" },
  { key: "canEditAtendimentos", label: "Editar atendimentos", categoria: "Kanban" },
  { key: "canDeleteAtendimentos", label: "Excluir atendimentos", categoria: "Kanban" },

  // ── Prospecção ──
  { key: "canManageProspeccaoEquipes", label: "Gerenciar equipes de prospecção", categoria: "Prospecção" },
  { key: "canCreateProspeccao", label: "Criar prospecção", categoria: "Prospecção" },
  { key: "canEditProspeccao", label: "Editar prospecção", categoria: "Prospecção" },
  { key: "canDeleteProspeccao", label: "Excluir prospecção", categoria: "Prospecção" },
  { key: "canViewProspeccao", label: "Visualizar prospecção", categoria: "Prospecção" },

  // ── Administração ──
  { key: "canManageUsers", label: "Gerenciar usuários", categoria: "Administração" },
  { key: "canCreateUsers", label: "Criar usuários", categoria: "Administração" },
  { key: "canEditUsers", label: "Editar usuários", categoria: "Administração" },
  { key: "canDeleteUsers", label: "Excluir usuários", categoria: "Administração" },
  { key: "canAccessAdminConfig", label: "Acessar configurações administrativas", categoria: "Administração" },
  { key: "canAccessAdministracao", label: "Acessar menu Administração", categoria: "Administração" },
  { key: "canAccessControleAcessos", label: "Acessar Controle de Acessos", categoria: "Administração" },
  { key: "canManageEmpresas", label: "Gerenciar empresas", categoria: "Administração" },
  { key: "canEditEmpresas", label: "Editar empresas", categoria: "Administração" },

  // ── Financeiro ──
  { key: "canAccessFinancialReports", label: "Acessar relatórios financeiros", categoria: "Financeiro" },
  { key: "canViewDashboard", label: "Visualizar dashboard", categoria: "Financeiro" },
  { key: "canExportRelatorios", label: "Exportar relatórios", categoria: "Financeiro" },

  // ── Resultados ──
  { key: "canAccessResultados", label: "Acessar Resultados", categoria: "Resultados" },
  { key: "canViewMetricas", label: "Visualizar métricas", categoria: "Resultados" },
  { key: "canSyncResultados", label: "Sincronizar resultados", categoria: "Resultados" },

  // ── Academy / Treinamentos ──
  { key: "canAccessAcademy", label: "Acessar Academy / Treinamentos", categoria: "Academy" },
  { key: "canManageAcademy", label: "Gerenciar treinamentos (admin)", categoria: "Academy" },
  { key: "canCreateTreinamentos", label: "Criar treinamentos", categoria: "Academy" },
  { key: "canEditTreinamentos", label: "Editar treinamentos", categoria: "Academy" },
  { key: "canDeleteTreinamentos", label: "Excluir treinamentos", categoria: "Academy" },
  { key: "canAssignTreinamentos", label: "Atribuir treinamentos", categoria: "Academy" },
  { key: "canViewProgressoEquipe", label: "Visualizar progresso da equipe", categoria: "Academy" },

  // ── Configurações ──
  { key: "canAccessConfiguracoes", label: "Acessar configurações", categoria: "Configurações" },
  { key: "canEditConfiguracoes", label: "Editar configurações", categoria: "Configurações" },
  { key: "canManageDepartamentos", label: "Gerenciar departamentos", categoria: "Configurações" },
  { key: "canManageMotivos", label: "Gerenciar motivos", categoria: "Configurações" },
  { key: "canManageOrigens", label: "Gerenciar origens", categoria: "Configurações" },
  { key: "canManageTemperaturas", label: "Gerenciar temperaturas", categoria: "Configurações" },
  { key: "canManageWhatsApp", label: "Gerenciar configurações WhatsApp", categoria: "Configurações" },
  { key: "canManageMensagens", label: "Gerenciar mensagens padrão", categoria: "Configurações" },
  { key: "canManageDocumentos", label: "Gerenciar documentos", categoria: "Configurações" },

  // ── Navegação / Menus ──
  { key: "canAccessNotificacoes", label: "Acessar notificações", categoria: "Navegação" },
  { key: "canAccessMinhaConta", label: "Acessar Minha Conta", categoria: "Navegação" },
  { key: "canAccessAjuda", label: "Acessar Ajuda", categoria: "Navegação" },
  { key: "canAccessRelatorios", label: "Acessar Relatórios", categoria: "Navegação" },

  // ── Vendas ──
  { key: "canCreateVendas", label: "Registrar vendas", categoria: "Vendas" },
  { key: "canEditVendas", label: "Editar vendas", categoria: "Vendas" },
  { key: "canDeleteVendas", label: "Excluir vendas", categoria: "Vendas" },
  { key: "canViewVendas", label: "Visualizar vendas", categoria: "Vendas" },

  // ── Personas ──
  { key: "canAccessPersonas", label: "Acessar Personas", categoria: "Personas" },
  { key: "canCreatePersonas", label: "Criar personas", categoria: "Personas" },
  { key: "canEditPersonas", label: "Editar personas", categoria: "Personas" },
  { key: "canDeletePersonas", label: "Excluir personas", categoria: "Personas" },

  // ── Gatilhos ──
  { key: "canAccessGatilhos", label: "Acessar Gatilhos", categoria: "Gatilhos" },
  { key: "canCreateGatilhos", label: "Criar gatilhos", categoria: "Gatilhos" },
  { key: "canEditGatilhos", label: "Editar gatilhos", categoria: "Gatilhos" },
  { key: "canDeleteGatilhos", label: "Excluir gatilhos", categoria: "Gatilhos" },
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
  const isGerente = isGerenteLeads || isGerenteLoja || isCoordenadoraLeads;

  return {
    canCreateTemplates: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canEditTemplates: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canDeleteTemplates: isAdminOrTI,
    canViewTemplates: !isRecepcionista,
    canCreateEventos: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canEditEventos: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canDeleteEventos: isAdminOrTI,
    canManageEvents: !isRecepcionista,
    canManageEventos: isAdminOrTI,
    canViewEventos: !isRecepcionista,
    canCreateIALigacao: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads,
    canDispararIALigacao: isAdminOrTI,
    canAccessAgentesIA: false,
    canEditAgentesIA: isAdminOrTI,
    canDeleteAgentesIA: isAdminOrTI,
    canToggleIALigacao: isAdminOrTI,
    canDispararEventos: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canRedispararEventos: isAdminOrTI,
    canUploadBase: isAdmin || isTI || isCRM || isGerenteLeads || isCoordenadoraLeads || isGerenteLoja,
    canAddClientes: isAdmin || isCRM,
    canEditClientes: isAdmin || isCRM || isGerenteLeads || isCoordenadoraLeads,
    canDeleteClientes: isAdminOrTI,
    canImportClientes: isAdmin || isTI || isCRM,
    canViewClientes: true,
    canDeleteContatos: isAdminOrTI,
    canEditContatos: !isRecepcionista,
    canAccessRecepcao: isAdmin || isRecepcionista,
    canReadQRCode: isAdmin || isRecepcionista,
    canGenerateInvites: !isRecepcionista,
    canAccessKanban: !isRecepcionista,
    canEditAtendimentos: !isRecepcionista,
    canDeleteAtendimentos: isAdminOrTI,
    canManageProspeccaoEquipes: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM || isGerenteLoja,
    canCreateProspeccao: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canEditProspeccao: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canDeleteProspeccao: isAdminOrTI,
    canViewProspeccao: true,
    canManageUsers: isAdminOrTI,
    canCreateUsers: isAdminOrTI,
    canEditUsers: isAdminOrTI || isGerente,
    canDeleteUsers: isAdminOrTI,
    canAccessAdminConfig: isAdminOrTI,
    canAccessAdministracao: isAdmin || isGerente,
    canAccessControleAcessos: isAdmin,
    canManageEmpresas: isAdminOrTI,
    canEditEmpresas: isAdmin,
    canAccessFinancialReports: isAdmin || isTI || isDiretor || isProprietario,
    canViewDashboard: true,
    canExportRelatorios: isAdmin || isTI || isDiretor || isProprietario,
    canAccessResultados: !isRecepcionista,
    canViewMetricas: !isRecepcionista,
    canSyncResultados: isAdminOrTI,
    canAccessAcademy: isAdminOrTI,
    canManageAcademy: isAdminOrTI || isGerente || isDiretor,
    canCreateTreinamentos: isAdminOrTI,
    canEditTreinamentos: isAdminOrTI,
    canDeleteTreinamentos: isAdminOrTI,
    canAssignTreinamentos: isAdminOrTI || isGerente || isDiretor,
    canViewProgressoEquipe: isAdminOrTI || isGerente || isDiretor,
    canAccessConfiguracoes: isAdminOrTI,
    canEditConfiguracoes: isAdminOrTI,
    canManageDepartamentos: isAdminOrTI,
    canManageMotivos: isAdminOrTI,
    canManageOrigens: isAdminOrTI,
    canManageTemperaturas: isAdminOrTI,
    canManageWhatsApp: isAdminOrTI,
    canManageMensagens: isAdminOrTI,
    canManageDocumentos: isAdminOrTI,
    canAccessNotificacoes: true,
    canAccessMinhaConta: true,
    canAccessAjuda: true,
    canAccessRelatorios: !isRecepcionista,
    canCreateVendas: !isRecepcionista,
    canEditVendas: isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM,
    canDeleteVendas: isAdminOrTI,
    canViewVendas: !isRecepcionista,
    canAccessPersonas: isAdminOrTI,
    canCreatePersonas: isAdminOrTI,
    canEditPersonas: isAdminOrTI,
    canDeletePersonas: isAdminOrTI,
    canAccessGatilhos: isAdminOrTI,
    canCreateGatilhos: isAdminOrTI,
    canEditGatilhos: isAdminOrTI,
    canDeleteGatilhos: isAdminOrTI,
  };
}

const CATEGORIAS = [...new Set(PERMISSOES_SISTEMA.map((p) => p.categoria))];
const ITEMS_PER_PAGE = 3;
const TOTAL_PAGES = Math.ceil(CATEGORIAS.length / ITEMS_PER_PAGE);

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

const PermissaoRow = ({
  perm,
  activeTipos,
  available,
  saving,
  onAdd,
  onRemove,
}: {
  perm: PermissaoInfo;
  activeTipos: string[];
  available: string[];
  saving: string | null;
  onAdd: (permissao: string, tipo: string) => void;
  onRemove: (permissao: string, tipo: string) => void;
}) => (
  <div className="border rounded-lg p-4 space-y-3">
    <p className="text-sm font-medium text-foreground">{perm.label}</p>
    <div className="flex flex-wrap items-center gap-2">
      {activeTipos.length === 0 && (
        <span className="text-xs text-muted-foreground italic">
          Nenhum tipo de acesso atribuído
        </span>
      )}
      {activeTipos.map((tipo) => (
        <Badge key={tipo} variant="secondary" className="gap-1 pr-1">
          {tipo}
          <button
            onClick={() => onRemove(perm.key, tipo)}
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
                  onClick={() => onAdd(perm.key, tipo)}
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

const ControleAcessos = () => {
  const [permTiposMap, setPermTiposMap] = useState<Record<string, Set<string>>>({});
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
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

  // Optimistic update helper
  const applyChange = useCallback((permissao: string, tipo: string, ativo: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (!next[tipo]) next[tipo] = {};
      next[tipo] = { ...next[tipo], [permissao]: ativo };
      return next;
    });
    setPermTiposMap((prev) => {
      const next = { ...prev };
      next[permissao] = new Set(prev[permissao]);
      if (ativo) {
        next[permissao].add(tipo);
      } else {
        next[permissao].delete(tipo);
      }
      return next;
    });
  }, []);

  const handleToggle = useCallback(async (permissao: string, tipo: string, ativo: boolean) => {
    const key = `${permissao}-${tipo}`;
    setSaving(key);

    // Optimistic update immediately
    applyChange(permissao, tipo, ativo);

    try {
      const { error } = await supabase
        .from("departamento_permissoes")
        .upsert(
          { departamento: tipo, permissao, ativo },
          { onConflict: "departamento,permissao" }
        );
      if (error) throw error;
      toast.success(ativo ? `${tipo} adicionado` : `${tipo} removido`);
    } catch (err) {
      // Revert on error
      applyChange(permissao, tipo, !ativo);
      console.error("Erro ao atualizar permissão:", err);
      toast.error("Erro ao atualizar permissão");
    } finally {
      setSaving(null);
    }
  }, [applyChange]);

  const visibleCategorias = useMemo(
    () => CATEGORIAS.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE),
    [currentPage]
  );

  const visiblePerms = useMemo(() => {
    const catSet = new Set(visibleCategorias);
    return PERMISSOES_SISTEMA.filter((p) => catSet.has(p.categoria));
  }, [visibleCategorias]);

  const grouped = useMemo(() => {
    const g: Record<string, PermissaoInfo[]> = {};
    for (const p of visiblePerms) {
      if (!g[p.categoria]) g[p.categoria] = [];
      g[p.categoria].push(p);
    }
    return g;
  }, [visiblePerms]);

  const getAvailableTipos = useCallback(
    (permissao: string) => {
      const current = permTiposMap[permissao] || new Set();
      return TIPOS_ACESSO.filter((t) => !current.has(t));
    },
    [permTiposMap]
  );

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
              Gerencie todas as permissões do sistema por tipo de acesso
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {Object.entries(grouped).map(([categoria, perms]) => (
                  <Card key={categoria}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {categoria}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {perms.map((perm) => (
                        <PermissaoRow
                          key={perm.key}
                          perm={perm}
                          activeTipos={Array.from(permTiposMap[perm.key] || [])}
                          available={getAvailableTipos(perm.key)}
                          saving={saving}
                          onAdd={(p, t) => handleToggle(p, t, true)}
                          onRemove={(p, t) => handleToggle(p, t, false)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Categorias {currentPage * ITEMS_PER_PAGE + 1}–
                  {Math.min((currentPage + 1) * ITEMS_PER_PAGE, CATEGORIAS.length)} de{" "}
                  {CATEGORIAS.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  {Array.from({ length: TOTAL_PAGES }, (_, i) => (
                    <Button
                      key={i}
                      variant={i === currentPage ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === TOTAL_PAGES - 1}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="gap-1"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default ControleAcessos;
