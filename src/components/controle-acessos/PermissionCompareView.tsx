import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Check, X, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERMISSION_MODULES,
  PERMISSION_REGISTRY,
  TIPOS_ACESSO,
  getDefaultPermissions,
  getModuleById,
  type TipoAcesso,
} from "./PermissionRegistry";

interface PermissionCompareViewProps {
  isMaster: boolean;
  overrides: Record<string, Record<string, boolean>>;
}

export function PermissionCompareView({
  isMaster,
  overrides,
}: PermissionCompareViewProps) {
  const [profileA, setProfileA] = useState<TipoAcesso>("Vendedor");
  const [profileB, setProfileB] = useState<TipoAcesso>("Administrador");
  const [searchText, setSearchText] = useState("");
  const [showDiffOnly, setShowDiffOnly] = useState(false);

  const getEffective = (permKey: string, tipo: TipoAcesso): boolean => {
    const tipoOverrides = overrides[tipo] || {};
    if (permKey in tipoOverrides) return tipoOverrides[permKey];
    return getDefaultPermissions(tipo)[permKey] ?? false;
  };

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
      if (q && !p.label.toLowerCase().includes(q)) return false;
      if (showDiffOnly) {
        const a = getEffective(p.key, profileA);
        const b = getEffective(p.key, profileB);
        if (a === b) return false;
      }
      return true;
    });
  }, [searchText, isMaster, showDiffOnly, profileA, profileB, overrides]);

  const groupedByModule = useMemo(() => {
    const map: Record<string, typeof filteredPerms> = {};
    for (const p of filteredPerms) {
      if (!map[p.moduleId]) map[p.moduleId] = [];
      map[p.moduleId].push(p);
    }
    return map;
  }, [filteredPerms]);

  const visibleModules = modules.filter(m => groupedByModule[m.id]?.length > 0);

  // Stats
  const totalDiffs = PERMISSION_REGISTRY.filter(p => {
    const mod = getModuleById(p.moduleId);
    if (mod?.masterOnly && !isMaster) return false;
    return getEffective(p.key, profileA) !== getEffective(p.key, profileB);
  }).length;

  return (
    <div className="space-y-4">
      {/* Profile Selectors */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={profileA} onValueChange={(v) => setProfileA(v as TipoAcesso)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Perfil A" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_ACESSO.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground self-center">vs</span>

        <Select value={profileB} onValueChange={(v) => setProfileB(v as TipoAcesso)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Perfil B" />
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
            placeholder="Buscar..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats & Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <Badge variant={totalDiffs > 0 ? "destructive" : "default"} className="text-xs">
          {totalDiffs} diferenças
        </Badge>
        <button
          onClick={() => setShowDiffOnly(!showDiffOnly)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            showDiffOnly ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-input"
          }`}
        >
          {showDiffOnly ? "Mostrando apenas diferenças" : "Mostrar apenas diferenças"}
        </button>
      </div>

      {/* Comparison Table */}
      {visibleModules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {showDiffOnly ? "Nenhuma diferença encontrada entre os perfis." : "Nenhuma permissão encontrada."}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleModules.map(mod => {
            const perms = groupedByModule[mod.id] || [];
            return (
              <div key={mod.id} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 flex items-center gap-2">
                  <span className="font-semibold text-sm">{mod.label}</span>
                  {mod.masterOnly && (
                    <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">Master</Badge>
                  )}
                </div>
                {/* Header */}
                <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
                  <span>Permissão</span>
                  <span className="text-center truncate">{profileA}</span>
                  <span className="text-center truncate">{profileB}</span>
                </div>
                {/* Rows */}
                {perms.map(perm => {
                  const a = getEffective(perm.key, profileA);
                  const b = getEffective(perm.key, profileB);
                  const isDiff = a !== b;

                  return (
                    <div
                      key={perm.key}
                      className={`grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 border-b last:border-b-0 items-center ${
                        isDiff ? "bg-amber-50 dark:bg-amber-500/5" : ""
                      }`}
                    >
                      <span className="text-sm truncate">{perm.label}</span>
                      <div className="flex justify-center">
                        {a ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                      <div className="flex justify-center">
                        {b ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
