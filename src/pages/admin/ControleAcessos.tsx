import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft, Check, X } from "lucide-react";
import { useState } from "react";
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

// Mirror the hardcoded logic from useUserAccessType.ts
function getPermissoesForTipo(tipo: TipoAcesso): Record<string, boolean> {
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
    canAccessAgentesIA: false, // requires departamento TI + admin/TI
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
  const navigate = useNavigate();

  const permissoes = selectedTipo ? getPermissoesForTipo(selectedTipo as TipoAcesso) : null;
  const grouped = groupByCategoria(PERMISSOES_SISTEMA);

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header with back button */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/administracao")}
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
              Visualize quais permissões cada tipo de acesso possui no sistema
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

          {/* Permissions display */}
          {selectedTipo && permissoes && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(grouped).map(([categoria, perms]) => (
                <Card key={categoria}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {categoria}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {perms.map((perm) => {
                      const ativo = permissoes[perm.key] ?? false;
                      return (
                        <div key={perm.key} className="flex items-center gap-3">
                          {ativo ? (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-destructive/60 shrink-0" />
                          )}
                          <span className={`text-sm ${ativo ? "text-foreground" : "text-muted-foreground"}`}>
                            {perm.label}
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!selectedTipo && (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Selecione um tipo de acesso para visualizar suas permissões</p>
            </div>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default ControleAcessos;
