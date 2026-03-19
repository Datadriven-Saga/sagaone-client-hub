/**
 * Permission Registry - Central registry for all system permissions.
 * 
 * Adding a new feature:
 * 1. Add a new module to PERMISSION_MODULES or use an existing one
 * 2. Add permission entries to PERMISSION_REGISTRY
 * 3. Set defaults in getDefaultPermissions()
 * 4. The UI will automatically pick up the new permissions
 */

export interface PermissionModule {
  id: string;
  label: string;
  icon: string; // lucide icon name
  description: string;
  masterOnly?: boolean; // Only visible to MFA Master users
  order: number;
}

export interface PermissionEntry {
  key: string;
  label: string;
  moduleId: string;
  action: PermissionAction;
  description?: string;
}

export type PermissionAction = 
  | "visualizar"
  | "criar"
  | "editar"
  | "excluir"
  | "ativar_desativar"
  | "administrar"
  | "executar";

export const ACTION_LABELS: Record<PermissionAction, string> = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  ativar_desativar: "Ativar/Desativar",
  administrar: "Administrar",
  executar: "Executar",
};

export const ACTION_COLORS: Record<PermissionAction, string> = {
  visualizar: "text-blue-500",
  criar: "text-green-500",
  editar: "text-amber-500",
  excluir: "text-red-500",
  ativar_desativar: "text-purple-500",
  administrar: "text-rose-600",
  executar: "text-cyan-500",
};

export const PERMISSION_MODULES: PermissionModule[] = [
  { id: "authenticator", label: "Authenticator (MFA)", icon: "KeyRound", description: "Gerenciamento de autenticação multifator", masterOnly: true, order: 0 },
  { id: "controle_agentes", label: "Controle de Agentes", icon: "Bot", description: "Gestão e implantação de agentes", order: 1 },
  { id: "agentes_ia", label: "Agentes IA / Instâncias", icon: "Cpu", description: "Gerenciamento de agentes de IA e instâncias", order: 2 },
  { id: "templates", label: "Templates", icon: "FileText", description: "Templates de mensagens e campanhas", order: 3 },
  { id: "eventos", label: "Eventos / Prospecção", icon: "Calendar", description: "Criação e gestão de eventos", order: 4 },
  { id: "ia_ligacao", label: "IA Ligação", icon: "Phone", description: "Funcionalidades de IA para ligações", order: 5 },
  { id: "disparos", label: "Disparos", icon: "Send", description: "Disparo de campanhas e mensagens", order: 6 },
  { id: "base_contatos", label: "Base / Contatos", icon: "Users", description: "Gestão de bases de leads e contatos", order: 7 },
  { id: "recepcao", label: "Recepção", icon: "DoorOpen", description: "Check-in e recepção de clientes", order: 8 },
  { id: "convites", label: "Convites / QR Codes", icon: "QrCode", description: "Geração de convites e QR codes", order: 9 },
  { id: "kanban", label: "Kanban / Atendimentos", icon: "LayoutGrid", description: "Gestão de atendimentos via Kanban", order: 10 },
  { id: "prospeccao", label: "Prospecção", icon: "Target", description: "Módulo de prospecção de clientes", order: 11 },
  { id: "vendas", label: "Vendas", icon: "ShoppingCart", description: "Registro e gestão de vendas", order: 12 },
  { id: "usuarios", label: "Usuários / Acessos", icon: "UserCog", description: "Gerenciamento de usuários e permissões", order: 13 },
  { id: "empresas", label: "Empresas / Lojas", icon: "Building", description: "Gestão de empresas e lojas", order: 14 },
  { id: "financeiro", label: "Financeiro / Relatórios", icon: "BarChart3", description: "Relatórios financeiros e dashboards", order: 15 },
  { id: "resultados", label: "Resultados", icon: "TrendingUp", description: "Métricas e resultados de operação", order: 16 },
  { id: "academy", label: "Academy / Treinamentos", icon: "GraduationCap", description: "Treinamentos e simulações", order: 17 },
  { id: "configuracoes", label: "Configurações", icon: "Settings", description: "Configurações do sistema", order: 18 },
  { id: "personas", label: "Personas / Gatilhos", icon: "Sparkles", description: "Personas de IA e gatilhos", order: 19 },
  { id: "integrações", label: "Integrações / APIs", icon: "Plug", description: "Integrações e APIs externas", order: 20 },
  { id: "navegacao", label: "Navegação / Menus", icon: "Menu", description: "Acesso a menus e módulos", order: 21 },
];

export const PERMISSION_REGISTRY: PermissionEntry[] = [
  // ── Authenticator (Master Only) ──
  { key: "canViewAuthenticator", label: "Visualizar Authenticator", moduleId: "authenticator", action: "visualizar" },
  { key: "canManageAuthenticator", label: "Administrar Authenticator", moduleId: "authenticator", action: "administrar" },
  { key: "canAssignAuthenticator", label: "Atribuir códigos MFA", moduleId: "authenticator", action: "executar" },
  { key: "canViewAuditLogs", label: "Visualizar logs de auditoria MFA", moduleId: "authenticator", action: "visualizar" },

  // ── Controle de Agentes ──
  { key: "canViewControleAgentes", label: "Visualizar controle de agentes", moduleId: "controle_agentes", action: "visualizar" },
  { key: "canCreateControleAgentes", label: "Criar agente no controle", moduleId: "controle_agentes", action: "criar" },
  { key: "canEditControleAgentes", label: "Editar agente no controle", moduleId: "controle_agentes", action: "editar" },
  { key: "canDeleteControleAgentes", label: "Excluir agente no controle", moduleId: "controle_agentes", action: "excluir" },
  { key: "canToggleControleAgentes", label: "Ativar/Desativar agente", moduleId: "controle_agentes", action: "ativar_desativar" },

  // ── Agentes IA / Instâncias ──
  { key: "canAccessAgentesIA", label: "Acessar Agentes IA", moduleId: "agentes_ia", action: "visualizar" },
  { key: "canEditAgentesIA", label: "Editar Agentes IA", moduleId: "agentes_ia", action: "editar" },
  { key: "canDeleteAgentesIA", label: "Excluir Agentes IA", moduleId: "agentes_ia", action: "excluir" },
  { key: "canCreateAgentesIA", label: "Criar Agentes IA", moduleId: "agentes_ia", action: "criar" },
  { key: "canManageInstancias", label: "Gerenciar instâncias", moduleId: "agentes_ia", action: "administrar" },
  { key: "canViewVariaveis", label: "Visualizar variáveis de agente", moduleId: "agentes_ia", action: "visualizar" },
  { key: "canEditVariaveis", label: "Editar variáveis de agente", moduleId: "agentes_ia", action: "editar" },
  { key: "canManageCadencias", label: "Gerenciar cadências", moduleId: "agentes_ia", action: "administrar" },
  { key: "canManageFollowups", label: "Gerenciar follow-ups", moduleId: "agentes_ia", action: "administrar" },
  { key: "canManageIntegracoes", label: "Gerenciar integrações de agente", moduleId: "agentes_ia", action: "administrar" },

  // ── Templates ──
  { key: "canViewTemplates", label: "Visualizar templates", moduleId: "templates", action: "visualizar" },
  { key: "canCreateTemplates", label: "Criar templates", moduleId: "templates", action: "criar" },
  { key: "canEditTemplates", label: "Editar templates", moduleId: "templates", action: "editar" },
  { key: "canDeleteTemplates", label: "Excluir templates", moduleId: "templates", action: "excluir" },

  // ── Eventos ──
  { key: "canViewEventos", label: "Visualizar eventos", moduleId: "eventos", action: "visualizar" },
  { key: "canCreateEventos", label: "Criar eventos", moduleId: "eventos", action: "criar" },
  { key: "canEditEventos", label: "Editar eventos", moduleId: "eventos", action: "editar" },
  { key: "canDeleteEventos", label: "Excluir eventos", moduleId: "eventos", action: "excluir" },
  { key: "canManageEvents", label: "Gerenciar eventos (geral)", moduleId: "eventos", action: "administrar" },
  { key: "canManageEventos", label: "Gerenciar eventos (admin)", moduleId: "eventos", action: "administrar" },

  // ── IA Ligação ──
  { key: "canCreateIALigacao", label: "Criar eventos IA Ligação", moduleId: "ia_ligacao", action: "criar" },
  { key: "canDispararIALigacao", label: "Disparar IA Ligação", moduleId: "ia_ligacao", action: "executar" },
  { key: "canToggleIALigacao", label: "Ativar/Desativar IA Ligação", moduleId: "ia_ligacao", action: "ativar_desativar" },
  { key: "canViewIALigacaoLogs", label: "Visualizar logs IA Ligação", moduleId: "ia_ligacao", action: "visualizar" },

  // ── Disparos ──
  { key: "canDispararEventos", label: "Disparar eventos", moduleId: "disparos", action: "executar" },
  { key: "canRedispararEventos", label: "Redisparar eventos", moduleId: "disparos", action: "executar" },
  { key: "canAprovarCampanhas", label: "Aprovar/Reprovar campanhas", moduleId: "disparos", action: "administrar", description: "Validação e aprovação de campanhas antes do disparo" },
  { key: "canProgramarCampanhas", label: "Programar campanhas", moduleId: "disparos", action: "executar", description: "Programar agendamento de campanhas" },

  // ── Base / Contatos ──
  { key: "canViewClientes", label: "Visualizar clientes", moduleId: "base_contatos", action: "visualizar" },
  { key: "canAddClientes", label: "Adicionar clientes", moduleId: "base_contatos", action: "criar" },
  { key: "canEditClientes", label: "Editar clientes", moduleId: "base_contatos", action: "editar" },
  { key: "canDeleteClientes", label: "Excluir clientes", moduleId: "base_contatos", action: "excluir" },
  { key: "canImportClientes", label: "Importar clientes", moduleId: "base_contatos", action: "executar" },
  { key: "canUploadBase", label: "Subir base de leads", moduleId: "base_contatos", action: "executar" },
  { key: "canEditContatos", label: "Editar contatos", moduleId: "base_contatos", action: "editar" },
  { key: "canDeleteContatos", label: "Excluir contatos", moduleId: "base_contatos", action: "excluir" },
  { key: "canValidarImportacao", label: "Validar importações de base", moduleId: "base_contatos", action: "administrar", description: "Aprovar ou reprovar importações de base de contatos" },
  { key: "canGovernancaDados", label: "Gerenciar governança de dados", moduleId: "base_contatos", action: "administrar", description: "Controle de qualidade e governança sobre dados de contatos" },
  { key: "canAccessOptOutGlobal", label: "Acessar Opt-Out Global", moduleId: "base_contatos", action: "administrar", description: "Gerenciar lista negra global de números bloqueados" },

  // ── Recepção ──
  { key: "canAccessRecepcao", label: "Acessar Recepção", moduleId: "recepcao", action: "visualizar" },
  { key: "canReadQRCode", label: "Ler QR Code / Check-in", moduleId: "recepcao", action: "executar" },

  // ── Convites ──
  { key: "canGenerateInvites", label: "Gerar convites / QR Codes", moduleId: "convites", action: "executar" },

  // ── Kanban ──
  { key: "canAccessKanban", label: "Acessar Kanban", moduleId: "kanban", action: "visualizar" },
  { key: "canEditAtendimentos", label: "Editar atendimentos", moduleId: "kanban", action: "editar" },
  { key: "canDeleteAtendimentos", label: "Excluir atendimentos", moduleId: "kanban", action: "excluir" },

  // ── Prospecção ──
  { key: "canViewProspeccao", label: "Visualizar prospecção", moduleId: "prospeccao", action: "visualizar" },
  { key: "canCreateProspeccao", label: "Criar prospecção", moduleId: "prospeccao", action: "criar" },
  { key: "canEditProspeccao", label: "Editar prospecção", moduleId: "prospeccao", action: "editar" },
  { key: "canDeleteProspeccao", label: "Excluir prospecção", moduleId: "prospeccao", action: "excluir" },
  { key: "canManageProspeccaoEquipes", label: "Gerenciar equipes de prospecção", moduleId: "prospeccao", action: "administrar" },

  // ── Vendas ──
  { key: "canViewVendas", label: "Visualizar vendas", moduleId: "vendas", action: "visualizar" },
  { key: "canCreateVendas", label: "Registrar vendas", moduleId: "vendas", action: "criar" },
  { key: "canEditVendas", label: "Editar vendas", moduleId: "vendas", action: "editar" },
  { key: "canDeleteVendas", label: "Excluir vendas", moduleId: "vendas", action: "excluir" },

  // ── Usuários / Acessos ──
  { key: "canManageUsers", label: "Gerenciar usuários", moduleId: "usuarios", action: "administrar" },
  { key: "canCreateUsers", label: "Criar usuários", moduleId: "usuarios", action: "criar" },
  { key: "canEditUsers", label: "Editar usuários", moduleId: "usuarios", action: "editar" },
  { key: "canDeleteUsers", label: "Excluir usuários", moduleId: "usuarios", action: "excluir" },
  { key: "canAccessAdminConfig", label: "Acessar config. administrativas", moduleId: "usuarios", action: "visualizar" },
  { key: "canAccessAdministracao", label: "Acessar menu Administração", moduleId: "usuarios", action: "visualizar" },
  { key: "canAccessControleAcessos", label: "Acessar Controle de Acessos", moduleId: "usuarios", action: "administrar" },

  // ── Empresas / Lojas ──
  { key: "canManageEmpresas", label: "Gerenciar empresas", moduleId: "empresas", action: "administrar" },
  { key: "canEditEmpresas", label: "Editar empresas", moduleId: "empresas", action: "editar" },
  { key: "canViewEmpresas", label: "Visualizar empresas", moduleId: "empresas", action: "visualizar" },

  // ── Financeiro / Relatórios ──
  { key: "canAccessFinancialReports", label: "Acessar relatórios financeiros", moduleId: "financeiro", action: "visualizar" },
  { key: "canViewDashboard", label: "Visualizar dashboard", moduleId: "financeiro", action: "visualizar" },
  { key: "canExportRelatorios", label: "Exportar relatórios", moduleId: "financeiro", action: "executar" },

  // ── Resultados ──
  { key: "canAccessResultados", label: "Acessar Resultados", moduleId: "resultados", action: "visualizar" },
  { key: "canViewMetricas", label: "Visualizar métricas", moduleId: "resultados", action: "visualizar" },
  { key: "canSyncResultados", label: "Sincronizar resultados", moduleId: "resultados", action: "executar" },

  // ── Academy / Treinamentos ──
  { key: "canAccessAcademy", label: "Acessar Academy", moduleId: "academy", action: "visualizar" },
  { key: "canManageAcademy", label: "Gerenciar treinamentos (admin)", moduleId: "academy", action: "administrar" },
  { key: "canCreateTreinamentos", label: "Criar treinamentos", moduleId: "academy", action: "criar" },
  { key: "canEditTreinamentos", label: "Editar treinamentos", moduleId: "academy", action: "editar" },
  { key: "canDeleteTreinamentos", label: "Excluir treinamentos", moduleId: "academy", action: "excluir" },
  { key: "canAssignTreinamentos", label: "Atribuir treinamentos", moduleId: "academy", action: "executar" },
  { key: "canViewProgressoEquipe", label: "Visualizar progresso da equipe", moduleId: "academy", action: "visualizar" },

  // ── Configurações ──
  { key: "canAccessConfiguracoes", label: "Acessar configurações", moduleId: "configuracoes", action: "visualizar" },
  { key: "canEditConfiguracoes", label: "Editar configurações", moduleId: "configuracoes", action: "editar" },
  { key: "canManageDepartamentos", label: "Gerenciar departamentos", moduleId: "configuracoes", action: "administrar" },
  { key: "canManageMotivos", label: "Gerenciar motivos", moduleId: "configuracoes", action: "administrar" },
  { key: "canManageOrigens", label: "Gerenciar origens", moduleId: "configuracoes", action: "administrar" },
  { key: "canManageTemperaturas", label: "Gerenciar temperaturas", moduleId: "configuracoes", action: "administrar" },
  { key: "canManageWhatsApp", label: "Gerenciar config. WhatsApp", moduleId: "configuracoes", action: "administrar" },
  { key: "canManageMensagens", label: "Gerenciar mensagens padrão", moduleId: "configuracoes", action: "administrar" },
  { key: "canManageDocumentos", label: "Gerenciar documentos", moduleId: "configuracoes", action: "administrar" },
  { key: "canManageProdutos", label: "Gerenciar produtos", moduleId: "configuracoes", action: "administrar" },

  // ── Personas / Gatilhos ──
  { key: "canAccessPersonas", label: "Acessar Personas", moduleId: "personas", action: "visualizar" },
  { key: "canCreatePersonas", label: "Criar personas", moduleId: "personas", action: "criar" },
  { key: "canEditPersonas", label: "Editar personas", moduleId: "personas", action: "editar" },
  { key: "canDeletePersonas", label: "Excluir personas", moduleId: "personas", action: "excluir" },
  { key: "canAccessGatilhos", label: "Acessar Gatilhos", moduleId: "personas", action: "visualizar" },
  { key: "canCreateGatilhos", label: "Criar gatilhos", moduleId: "personas", action: "criar" },
  { key: "canEditGatilhos", label: "Editar gatilhos", moduleId: "personas", action: "editar" },
  { key: "canDeleteGatilhos", label: "Excluir gatilhos", moduleId: "personas", action: "excluir" },

  // ── Integrações / APIs ──
  { key: "canAccessAPIs", label: "Acessar APIs", moduleId: "integrações", action: "visualizar" },
  { key: "canManageAPIs", label: "Gerenciar APIs", moduleId: "integrações", action: "administrar" },
  { key: "canTestAPIs", label: "Testar APIs", moduleId: "integrações", action: "executar" },
  { key: "canManageWebhooks", label: "Gerenciar webhooks", moduleId: "integrações", action: "administrar" },

  // ── Navegação / Menus ──
  { key: "canAccessNotificacoes", label: "Acessar notificações", moduleId: "navegacao", action: "visualizar" },
  { key: "canAccessMinhaConta", label: "Acessar Minha Conta", moduleId: "navegacao", action: "visualizar" },
  { key: "canAccessAjuda", label: "Acessar Ajuda", moduleId: "navegacao", action: "visualizar" },
  { key: "canAccessRelatorios", label: "Acessar Relatórios", moduleId: "navegacao", action: "visualizar" },
];

export const TIPOS_ACESSO = [
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
  "Master",
] as const;

export type TipoAcesso = (typeof TIPOS_ACESSO)[number];

/**
 * Returns the default (inherited) permission state for a given role.
 * These are the baseline permissions before any overrides from `departamento_permissoes`.
 */
export function getDefaultPermissions(tipo: TipoAcesso): Record<string, boolean> {
  const isMasterRole = tipo === "Master";
  const isAdmin = tipo === "Administrador" || isMasterRole;
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

  const defaults: Record<string, boolean> = {};

  // Initialize all to false
  for (const perm of PERMISSION_REGISTRY) {
    defaults[perm.key] = false;
  }

  // ── Authenticator (Master Only) ──
  // These are NOT controlled by role defaults, only by Master assignment
  
  // ── Controle de Agentes ──
  defaults.canViewControleAgentes = isAdminOrTI;
  defaults.canCreateControleAgentes = isAdminOrTI;
  defaults.canEditControleAgentes = isAdminOrTI;
  defaults.canDeleteControleAgentes = isAdminOrTI;
  defaults.canToggleControleAgentes = isAdminOrTI;

  // ── Agentes IA ──
  defaults.canAccessAgentesIA = isAdminOrTI;
  defaults.canEditAgentesIA = isAdminOrTI;
  defaults.canDeleteAgentesIA = isAdminOrTI;
  defaults.canCreateAgentesIA = isAdminOrTI;
  defaults.canManageInstancias = isAdminOrTI;
  defaults.canViewVariaveis = isAdminOrTI;
  defaults.canEditVariaveis = isAdminOrTI;
  defaults.canManageCadencias = isAdminOrTI;
  defaults.canManageFollowups = isAdminOrTI;
  defaults.canManageIntegracoes = isAdminOrTI;

  // ── Templates ──
  defaults.canViewTemplates = !isRecepcionista;
  defaults.canCreateTemplates = isAdmin || isTI || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads || isCRM;
  defaults.canEditTemplates = isAdmin || isTI || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads || isCRM;
  defaults.canDeleteTemplates = isAdminOrTI;

  // ── Eventos ──
  defaults.canViewEventos = !isRecepcionista;
  defaults.canCreateEventos = isAdmin || isTI || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads || isCRM;
  defaults.canEditEventos = isAdmin || isTI || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads || isCRM;
  defaults.canDeleteEventos = isAdminOrTI;
  defaults.canManageEvents = !isRecepcionista;
  defaults.canManageEventos = isAdminOrTI;

  // ── IA Ligação ──
  defaults.canCreateIALigacao = isAdmin || isTI || isCRM || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads;
  defaults.canDispararIALigacao = isAdmin || isMasterRole;
  defaults.canToggleIALigacao = isAdminOrTI;
  defaults.canViewIALigacaoLogs = isAdminOrTI;

  // ── Disparos ──
  defaults.canDispararEventos = isAdmin || isTI || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads || isCRM;
  defaults.canRedispararEventos = isAdminOrTI;
  defaults.canAprovarCampanhas = isAdmin || isTI || isCRM; // CRM valida campanhas; Gestor de Leads NÃO pode aprovar
  defaults.canProgramarCampanhas = isAdmin || isTI || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads || isCRM;

  // ── Base / Contatos ──
  defaults.canViewClientes = true;
  defaults.canAddClientes = isAdmin || isCRM;
  defaults.canEditClientes = isAdmin || isCRM || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads;
  defaults.canDeleteClientes = isAdminOrTI;
  defaults.canImportClientes = isMasterRole || isCRM;
  defaults.canUploadBase = isMasterRole || isCRM || isAdmin;
  defaults.canEditContatos = !isRecepcionista;
  defaults.canDeleteContatos = isAdminOrTI;
  defaults.canValidarImportacao = isAdmin || isTI || isCRM; // CRM valida importações; Gestor de Leads NÃO pode validar
  defaults.canGovernancaDados = isAdmin || isTI || isCRM; // CRM gerencia governança de dados
  defaults.canAccessOptOutGlobal = isAdmin || isTI || isCRM; // CRM acessa opt-out global

  // ── Recepção ──
  defaults.canAccessRecepcao = isAdmin || isRecepcionista || isGerente || isCRM;
  defaults.canReadQRCode = isAdmin || isRecepcionista;

  // ── Convites ──
  defaults.canGenerateInvites = !isRecepcionista;

  // ── Kanban ──
  defaults.canAccessKanban = !isRecepcionista;
  defaults.canEditAtendimentos = !isRecepcionista;
  defaults.canDeleteAtendimentos = isAdminOrTI;

  // ── Prospecção ──
  defaults.canViewProspeccao = true;
  defaults.canCreateProspeccao = isAdmin || isTI || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads || isCRM;
  defaults.canEditProspeccao = isAdmin || isTI || isGerenteLeads || isGerenteLoja || isCoordenadoraLeads || isCRM;
  defaults.canDeleteProspeccao = isAdminOrTI;
  defaults.canManageProspeccaoEquipes = isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM || isGerenteLoja;

  // ── Vendas ──
  defaults.canViewVendas = !isRecepcionista;
  defaults.canCreateVendas = !isRecepcionista;
  defaults.canEditVendas = isAdmin || isTI || isGerenteLeads || isCoordenadoraLeads || isCRM;
  defaults.canDeleteVendas = isAdminOrTI;

  // ── Usuários ──
  defaults.canManageUsers = isAdminOrTI;
  defaults.canCreateUsers = isAdminOrTI || isGerenteLeads || isCoordenadoraLeads || isCRM; // Gestor de Leads e CRM podem cadastrar usuários
  defaults.canEditUsers = isAdminOrTI || isGerente;
  defaults.canDeleteUsers = isAdminOrTI;
  defaults.canAccessAdminConfig = isAdminOrTI;
  defaults.canAccessAdministracao = isAdmin || isGerente || isCRM; // CRM acessa Administração
  defaults.canAccessControleAcessos = isAdmin;

  // ── Empresas ──
  defaults.canManageEmpresas = isAdminOrTI;
  defaults.canEditEmpresas = isAdmin;
  defaults.canViewEmpresas = isAdminOrTI || isGerente || isDiretor || isProprietario;

  // ── Financeiro ──
  defaults.canAccessFinancialReports = isAdmin || isTI || isDiretor || isProprietario;
  defaults.canViewDashboard = true;
  defaults.canExportRelatorios = isAdmin || isTI || isDiretor || isProprietario;

  // ── Resultados ──
  defaults.canAccessResultados = !isRecepcionista;
  defaults.canViewMetricas = !isRecepcionista;
  defaults.canSyncResultados = isAdminOrTI;

  // ── Academy ──
  defaults.canAccessAcademy = isAdminOrTI;
  defaults.canManageAcademy = isAdminOrTI || isGerente || isDiretor;
  defaults.canCreateTreinamentos = isAdminOrTI;
  defaults.canEditTreinamentos = isAdminOrTI;
  defaults.canDeleteTreinamentos = isAdminOrTI;
  defaults.canAssignTreinamentos = isAdminOrTI || isGerente || isDiretor;
  defaults.canViewProgressoEquipe = isAdminOrTI || isGerente || isDiretor;

  // ── Configurações ──
  defaults.canAccessConfiguracoes = isAdminOrTI;
  defaults.canEditConfiguracoes = isAdminOrTI;
  defaults.canManageDepartamentos = isAdminOrTI;
  defaults.canManageMotivos = isAdminOrTI;
  defaults.canManageOrigens = isAdminOrTI;
  defaults.canManageTemperaturas = isAdminOrTI;
  defaults.canManageWhatsApp = isAdminOrTI;
  defaults.canManageMensagens = isAdminOrTI;
  defaults.canManageDocumentos = isAdminOrTI;
  defaults.canManageProdutos = isAdminOrTI;

  // ── Personas / Gatilhos ──
  defaults.canAccessPersonas = isAdminOrTI;
  defaults.canCreatePersonas = isAdminOrTI;
  defaults.canEditPersonas = isAdminOrTI;
  defaults.canDeletePersonas = isAdminOrTI;
  defaults.canAccessGatilhos = isAdminOrTI;
  defaults.canCreateGatilhos = isAdminOrTI;
  defaults.canEditGatilhos = isAdminOrTI;
  defaults.canDeleteGatilhos = isAdminOrTI;

  // ── Integrações / APIs ──
  defaults.canAccessAPIs = isAdminOrTI;
  defaults.canManageAPIs = isAdminOrTI;
  defaults.canTestAPIs = isAdminOrTI;
  defaults.canManageWebhooks = isAdminOrTI;

  // ── Navegação ──
  defaults.canAccessNotificacoes = true;
  defaults.canAccessMinhaConta = true;
  defaults.canAccessAjuda = true;
  defaults.canAccessRelatorios = !isRecepcionista;

  return defaults;
}

/**
 * Groups permissions by module, filtering master-only modules based on user access.
 */
export function getGroupedPermissions(isMaster: boolean): Record<string, PermissionEntry[]> {
  const modules = PERMISSION_MODULES
    .filter(m => !m.masterOnly || isMaster)
    .sort((a, b) => a.order - b.order);

  const grouped: Record<string, PermissionEntry[]> = {};
  for (const mod of modules) {
    const perms = PERMISSION_REGISTRY.filter(p => p.moduleId === mod.id);
    if (perms.length > 0) {
      grouped[mod.id] = perms;
    }
  }
  return grouped;
}

/**
 * Gets a module by its ID.
 */
export function getModuleById(moduleId: string): PermissionModule | undefined {
  return PERMISSION_MODULES.find(m => m.id === moduleId);
}

/**
 * Resolves effective permissions for a role, merging defaults with overrides.
 */
export function resolvePermissions(
  tipo: TipoAcesso,
  overrides: Record<string, boolean>
): Record<string, boolean> {
  const defaults = getDefaultPermissions(tipo);
  const result: Record<string, boolean> = {};
  for (const perm of PERMISSION_REGISTRY) {
    result[perm.key] = overrides[perm.key] ?? defaults[perm.key];
  }
  return result;
}
