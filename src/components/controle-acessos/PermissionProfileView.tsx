import { useState, useMemo, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ChevronDown, ChevronRight, Info, Copy } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  PERMISSION_MODULES,
  PERMISSION_REGISTRY,
  TIPOS_ACESSO,
  ACTION_LABELS,
  ACTION_COLORS,
  getDefaultPermissions,
  getModuleById,
  type TipoAcesso,
  type PermissionEntry,
} from "./PermissionRegistry";

interface PermissionProfileViewProps {
  isMaster: boolean;
  overrides: Record<string, Record<string, boolean>>;
  saving: string | null;
  onToggle: (permissao: string, tipo: string, ativo: boolean) => void;
  onCloneProfile: (source: TipoAcesso, target: TipoAcesso) => void;
}

export function PermissionProfileView({
  isMaster,
  overrides,
  saving,
  onToggle,
  onCloneProfile,
}: PermissionProfileViewProps) {
  const [selectedProfile, setSelectedProfile] = useState<TipoAcesso>("Vendedor");
  const [searchText, setSearchText] = useState("");
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [cloneTarget, setCloneTarget] = useState<string>("");
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);

  const toggleModule = useCallback((moduleId: string) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }, []);

  const modules = useMemo(() =>
    PERMISSION_MODULES
      .filter(m => !m.masterOnly || isMaster)
      .sort((a, b) => a.order - b.order),
    [isMaster]
  );

  const defaults = useMemo(() => getDefaultPermissions(selectedProfile), [selectedProfile]);
  const profileOverrides = overrides[selectedProfile] || {};

  const getEffective = useCallback((key: string): boolean => {
    if (key in profileOverrides) return profileOverrides[key];
    return defaults[key] ?? false;
  }, [profileOverrides, defaults]);

  const isOverridden = useCallback((key: string): boolean => {
    return key in profileOverrides;
  }, [profileOverrides]);

  const filteredPerms = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return PERMISSION_REGISTRY.filter(p => {
      const mod = getModuleById(p.moduleId);
      if (mod?.masterOnly && !isMaster) return false;
      if (q && !p.label.toLowerCase().includes(q) && !mod?.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [searchText, isMaster]);

  const visibleModules = useMemo(() => {
    const ids = new Set(filteredPerms.map(p => p.moduleId));
    return modules.filter(m => ids.has(m.id));
  }, [filteredPerms, modules]);

  const permsByModule = useMemo(() => {
    const map: Record<string, PermissionEntry[]> = {};
    for (const p of filteredPerms) {
      if (!map[p.moduleId]) map[p.moduleId] = [];
      map[p.moduleId].push(p);
    }
    return map;
  }, [filteredPerms]);

  // Count active / total
  const totalPerms = filteredPerms.length;
  const activePerms = filteredPerms.filter(p => getEffective(p.key)).length;
  const overriddenCount = filteredPerms.filter(p => isOverridden(p.key)).length;

  const handleClone = () => {
    if (!cloneTarget || cloneTarget === selectedProfile) {
      toast.error("Selecione um perfil diferente para clonar");
      return;
    }
    onCloneProfile(selectedProfile, cloneTarget as TipoAcesso);
    setCloneDialogOpen(false);
    setCloneTarget("");
  };

  return (
    <div className="space-y-4">
      {/* Profile Selector */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          <Select value={selectedProfile} onValueChange={(v) => setSelectedProfile(v as TipoAcesso)}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Selecionar perfil" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_ACESSO.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar permissão..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Copy className="h-4 w-4" />
              Clonar perfil
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clonar Permissões</DialogTitle>
              <DialogDescription>
                Copiar todas as permissões de <strong>{selectedProfile}</strong> para outro perfil.
                As permissões do perfil de destino serão substituídas.
              </DialogDescription>
            </DialogHeader>
            <Select value={cloneTarget} onValueChange={setCloneTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar perfil de destino" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ACESSO.filter(t => t !== selectedProfile).map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleClone} disabled={!cloneTarget}>Clonar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {activePerms}/{totalPerms} ativas
        </Badge>
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
          {overriddenCount} customizadas
        </Badge>
        <Badge variant="outline" className="text-xs">
          {totalPerms - activePerms} desativadas
        </Badge>
      </div>

      {/* Modules */}
      {visibleModules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma permissão encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleModules.map(mod => {
            const perms = permsByModule[mod.id] || [];
            const modActive = perms.filter(p => getEffective(p.key)).length;
            const isOpen = openModules.has(mod.id);

            return (
              <Collapsible key={mod.id} open={isOpen} onOpenChange={() => toggleModule(mod.id)}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 p-3 bg-card border rounded-lg hover:bg-accent/50 transition-colors text-left">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium text-sm flex-1">{mod.label}</span>
                    {mod.masterOnly && (
                      <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">Master</Badge>
                    )}
                    <Badge
                      variant={modActive === perms.length ? "default" : modActive > 0 ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {modActive}/{perms.length}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 rounded-b-lg divide-y">
                    <TooltipProvider delayDuration={300}>
                      {perms.map(perm => {
                        const active = getEffective(perm.key);
                        const overridden = isOverridden(perm.key);
                        const isSaving = saving === `${perm.key}-${selectedProfile}`;

                        return (
                          <div key={perm.key} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                            ) : (
                              <Switch
                                checked={active}
                                onCheckedChange={(checked) => onToggle(perm.key, selectedProfile, checked)}
                                className="shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm">{perm.label}</span>
                            </div>
                            <Badge variant="outline" className={`text-xs ${ACTION_COLORS[perm.action]}`}>
                              {ACTION_LABELS[perm.action]}
                            </Badge>
                            {overridden && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Customizada (diferente do padrão)</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })}
                    </TooltipProvider>
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
