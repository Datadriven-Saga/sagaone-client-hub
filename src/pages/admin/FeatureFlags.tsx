import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Flag, Search, Shield, Upload, MessageSquare, Target, Brain, BarChart3, Settings, GraduationCap, DollarSign } from "lucide-react";
import { useFeatureFlags, type FeatureFlag } from "@/hooks/useFeatureFlags";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  "Segurança": { icon: Shield, color: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800" },
  "Importação": { icon: Upload, color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800" },
  "Comunicação": { icon: MessageSquare, color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800" },
  "Prospecção": { icon: Target, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800" },
  "IA": { icon: Brain, color: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800" },
  "Treinamento": { icon: GraduationCap, color: "bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800" },
  "Financeiro": { icon: DollarSign, color: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800" },
  "Relatórios": { icon: BarChart3, color: "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800" },
  "Sistema": { icon: Settings, color: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800" },
  "Geral": { icon: Flag, color: "bg-muted text-muted-foreground border-border" },
};

const FeatureFlagsPage = () => {
  const { user } = useAuth();
  const { flags, loading, reload } = useFeatureFlags();
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = useCallback(async (flag: FeatureFlag) => {
    setTogglingId(flag.id);
    const newValue = !flag.is_enabled;

    try {
      const { error } = await supabase
        .from("system_feature_flags")
        .update({ is_enabled: newValue, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("id", flag.id);
      if (error) throw error;
      toast.success(`${flag.flag_label} ${newValue ? "ativada" : "desativada"}`);
      reload();
    } catch (err: any) {
      toast.error("Erro ao atualizar flag", { description: err.message });
    } finally {
      setTogglingId(null);
    }
  }, [user, reload]);

  const filteredFlags = flags.filter(
    (f) =>
      !search ||
      f.flag_label.toLowerCase().includes(search.toLowerCase()) ||
      f.flag_key.toLowerCase().includes(search.toLowerCase()) ||
      f.description?.toLowerCase().includes(search.toLowerCase()) ||
      f.category.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped = filteredFlags.reduce<Record<string, FeatureFlag[]>>((acc, flag) => {
    const cat = flag.category || "Geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(flag);
    return acc;
  }, {});

  const sortedCategories = Object.keys(grouped).sort();

  return (
    <DashboardLayout>
      <ScrollIndicator className="h-full">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Flag className="h-8 w-8" />
              Feature Flags
            </h1>
            <p className="text-muted-foreground">
              Controle centralizado de todas as funcionalidades do sistema. Ative ou desative features globalmente.
            </p>
          </div>

          {/* Search + Stats */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar flags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">{flags.length} flags</Badge>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              {flags.filter((f) => f.is_enabled).length} ativas
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
              {flags.filter((f) => !f.is_enabled).length} inativas
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFlags.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-12 text-center">
                <Flag className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Nenhuma flag encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {sortedCategories.map((category) => {
                const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG["Geral"];
                const CategoryIcon = config.icon;
                const categoryFlags = grouped[category];

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={`${config.color} gap-1.5 px-3 py-1`}>
                        <CategoryIcon className="h-3.5 w-3.5" />
                        {category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {categoryFlags.filter((f) => f.is_enabled).length}/{categoryFlags.length} ativas
                      </span>
                    </div>

                    <div className="space-y-2">
                      {categoryFlags.map((flag) => (
                        <Card key={flag.id} className="transition-colors hover:bg-muted/30">
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-medium text-foreground">{flag.flag_label}</span>
                                  <Badge
                                    variant={flag.is_enabled ? "default" : "outline"}
                                    className={`text-[10px] px-1.5 py-0 ${
                                      flag.is_enabled
                                        ? "bg-emerald-500/15 text-emerald-600 border-emerald-300"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {flag.is_enabled ? "ON" : "OFF"}
                                  </Badge>
                                </div>
                                {flag.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">
                                    {flag.description}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground/60 font-mono mt-1">
                                  {flag.flag_key}
                                </p>
                              </div>
                              <Switch
                                checked={flag.is_enabled}
                                onCheckedChange={() => handleToggle(flag)}
                                disabled={togglingId === flag.id}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollIndicator>
    </DashboardLayout>
  );
};

export default FeatureFlagsPage;
