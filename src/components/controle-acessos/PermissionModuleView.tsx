import { useState, useMemo, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ChevronDown, ChevronRight, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PERMISSION_MODULES,
  PERMISSION_REGISTRY,
  TIPOS_ACESSO,
  ACTION_LABELS,
  ACTION_COLORS,
  getModuleById,
  getDefaultPermissions,
  type TipoAcesso,
  type PermissionEntry,
  type PermissionAction,
} from "./PermissionRegistry";

interface PermissionModuleViewProps {
  isMaster: boolean;
  overrides: Record<string, Record<string, boolean>>;
  saving: string | null;
  onToggle: (permissao: string, tipo: string, ativo: boolean) => void;
}

const ACTIONS: PermissionAction[] = ["visualizar", "criar", "editar", "excluir", "ativar_desativar", "administrar", "executar"];

export function PermissionModuleView({
  isMaster,
  overrides,
  saving,
  onToggle,
}: PermissionModuleViewProps) {
  const [searchText, setSearchText] = useState("");
  const [filterAction, setFilterAction] = useState<string>("todas");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  const toggleModule = useCallback((moduleId: string) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set(visibleModules.map(m => m.id));
    setOpenModules(all);
  }, []);

  const collapseAll = useCallback(() => {
    setOpenModules(new Set());
  }, []);

  const modules = useMemo(() =>
    PERMISSION_MODULES
      .filter(m => !m.masterOnly || isMaster)
      .sort((a, b) => a.order - b.order),
    [isMaster]
  );

  const filteredPerms = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return PERMISSION_REGISTRY.filter(p => {
      const mod = getModuleById(p.moduleId);
      if (mod?.masterOnly && !isMaster) return false;
      if (q && !p.label.toLowerCase().includes(q) && !mod?.label.toLowerCase().includes(q)) return false;
      if (filterAction !== "todas" && p.action !== filterAction) return false;
      if (filterTipo !== "todos") {
        const defaults = getDefaultPermissions(filterTipo as TipoAcesso);
        const tipoOverrides = overrides[filterTipo] || {};
        const isActive = tipoOverrides[p.key] ?? defaults[p.key];
        if (!isActive) return false;
      }
      return true;
    });
  }, [searchText, filterAction, filterTipo, isMaster, overrides]);

  const visibleModules = useMemo(() => {
    const permModuleIds = new Set(filteredPerms.map(p => p.moduleId));
    return modules.filter(m => permModuleIds.has(m.id));
  }, [filteredPerms, modules]);

  const permsByModule = useMemo(() => {
    const map: Record<string, PermissionEntry[]> = {};
    for (const p of filteredPerms) {
      if (!map[p.moduleId]) map[p.moduleId] = [];
      map[p.moduleId].push(p);
    }
    return map;
  }, [filteredPerms]);

  const getEffectiveValue = useCallback((permKey: string, tipo: TipoAcesso): boolean => {
    const tipoOverrides = overrides[tipo] || {};
    if (permKey in tipoOverrides) return tipoOverrides[permKey];
    return getDefaultPermissions(tipo)[permKey] ?? false;
  }, [overrides]);

  const isOverridden = useCallback((permKey: string, tipo: TipoAcesso): boolean => {
    const tipoOverrides = overrides[tipo] || {};
    return permKey in tipoOverrides;
  }, [overrides]);

  const countActiveRoles = useCallback((permKey: string): number => {
    let count = 0;
    for (const tipo of TIPOS_ACESSO) {
      if (getEffectiveValue(permKey, tipo)) count++;
    }
    return count;
  }, [getEffectiveValue]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar permissão ou módulo..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo de ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            {ACTIONS.map(a => (
              <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            {TIPOS_ACESSO.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expand / Collapse All */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={expandAll}>
          Expandir tudo
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          Recolher tudo
        </Button>
        <span className="text-xs text-muted-foreground self-center ml-auto">
          {filteredPerms.length} permissões em {visibleModules.length} módulos
        </span>
      </div>

      {visibleModules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma permissão encontrada com os filtros aplicados.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleModules.map(mod => {
            const perms = permsByModule[mod.id] || [];
            const isOpen = openModules.has(mod.id);
            return (
              <Collapsible key={mod.id} open={isOpen} onOpenChange={() => toggleModule(mod.id)}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 p-4 bg-card border rounded-lg hover:bg-accent/50 transition-colors text-left">
                    {isOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{mod.label}</span>
                        {mod.masterOnly && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                            Master
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {perms.length} permissões
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 rounded-b-lg overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_auto] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <span>Permissão</span>
                      <span className="hidden sm:block text-center">Ação</span>
                      <span className="text-center">Perfis ativos</span>
                    </div>
                    {perms.map(perm => (
                      <PermissionRow
                        key={perm.key}
                        perm={perm}
                        saving={saving}
                        getEffectiveValue={getEffectiveValue}
                        isOverridden={isOverridden}
                        countActiveRoles={countActiveRoles}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PermissionRow({
  perm,
  saving,
  getEffectiveValue,
  isOverridden,
  countActiveRoles,
  onToggle,
}: {
  perm: PermissionEntry;
  saving: string | null;
  getEffectiveValue: (key: string, tipo: TipoAcesso) => boolean;
  isOverridden: (key: string, tipo: TipoAcesso) => boolean;
  countActiveRoles: (key: string) => number;
  onToggle: (permissao: string, tipo: string, ativo: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveRoles(perm.key);

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_auto] gap-2 px-4 py-3 hover:bg-accent/30 transition-colors text-left items-center"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{perm.label}</span>
        </div>
        <Badge variant="outline" className={`hidden sm:inline-flex text-xs ${ACTION_COLORS[perm.action]}`}>
          {ACTION_LABELS[perm.action]}
        </Badge>
        <div className="flex items-center justify-center">
          <Badge variant={activeCount > 0 ? "default" : "secondary"} className="text-xs">
            {activeCount}/{TIPOS_ACESSO.length}
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pl-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <TooltipProvider delayDuration={300}>
              {TIPOS_ACESSO.map(tipo => {
                const active = getEffectiveValue(perm.key, tipo);
                const overridden = isOverridden(perm.key, tipo);
                const isSaving = saving === `${perm.key}-${tipo}`;

                return (
                  <div
                    key={tipo}
                    className="flex items-center gap-2 p-2 rounded-md border bg-background"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={active}
                        onCheckedChange={(checked) => onToggle(perm.key, tipo, checked)}
                        className="shrink-0"
                      />
                    )}
                    <span className="text-xs font-medium truncate flex-1">{tipo}</span>
                    {overridden && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-amber-500 shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Permissão customizada (sobrescrita do padrão)</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  );
}
