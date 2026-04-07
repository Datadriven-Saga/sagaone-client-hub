import { useState, useEffect, useCallback } from "react";
import { Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const DEFAULTS: Record<string, number> = { whatsapp: 20, ligacao: 30 };
const CANAL_LABELS: Record<string, string> = { whatsapp: "WhatsApp", ligacao: "Ligação" };

interface ConfigRow {
  marca: string;
  canal: string;
  dias: number;
  isDefault: boolean;
  dirty: boolean;
}

interface Props {
  availableMarcas: string[];
}

export function QuarentenaConfigTab({ availableMarcas }: Props) {
  const { activeCompany } = useCompany();
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quarentena_config")
        .select("marca, canal, dias")
        .eq("empresa_id", activeCompany.id);

      if (error) throw error;

      const configMap = new Map<string, number>();
      (data || []).forEach((r: any) => configMap.set(`${r.marca}|${r.canal}`, r.dias));

      const built: ConfigRow[] = [];
      for (const marca of availableMarcas) {
        for (const canal of ["whatsapp", "ligacao"]) {
          const key = `${marca}|${canal}`;
          const configured = configMap.get(key);
          built.push({
            marca,
            canal,
            dias: configured ?? DEFAULTS[canal],
            isDefault: configured === undefined,
            dirty: false,
          });
        }
      }
      setRows(built);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar configurações de prazo");
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, availableMarcas]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const updateDias = (marca: string, canal: string, value: number) => {
    setRows(prev => prev.map(r =>
      r.marca === marca && r.canal === canal
        ? { ...r, dias: value, dirty: true, isDefault: value === DEFAULTS[canal] ? r.isDefault : false }
        : r
    ));
  };

  const dirtyRows = rows.filter(r => r.dirty);

  const handleSave = async () => {
    if (!activeCompany?.id || dirtyRows.length === 0) return;
    setSaving(true);
    try {
      for (const row of dirtyRows) {
        if (row.dias === DEFAULTS[row.canal]) {
          // Delete config row if it matches default (optional cleanup)
          await supabase
            .from("quarentena_config")
            .delete()
            .eq("empresa_id", activeCompany.id)
            .eq("marca", row.marca)
            .eq("canal", row.canal);
        } else {
          const { error } = await supabase
            .from("quarentena_config")
            .upsert({
              empresa_id: activeCompany.id,
              marca: row.marca,
              canal: row.canal,
              dias: row.dias,
              updated_at: new Date().toISOString(),
            }, { onConflict: "empresa_id,marca,canal" });
          if (error) throw error;
        }
      }
      toast.success(`${dirtyRows.length} configuração(ões) salva(s)`);
      await loadConfig();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (availableMarcas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma marca encontrada na quarentena para configurar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Configurações de Prazo por Canal</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Defina o prazo de bloqueio (em dias) por marca e canal. Padrão: WhatsApp = 20 dias, Ligação = 30 dias.
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving || dirtyRows.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar ({dirtyRows.length})
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marca</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="w-[140px]">Prazo (dias)</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.marca}-${row.canal}`}>
                <TableCell className="font-medium">{row.marca}</TableCell>
                <TableCell>
                  <Badge variant={row.canal === "whatsapp" ? "default" : "secondary"}>
                    {CANAL_LABELS[row.canal]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={row.dias}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 1 && v <= 365) {
                        updateDias(row.marca, row.canal, v);
                      }
                    }}
                    className="w-[100px] h-8 text-sm"
                  />
                </TableCell>
                <TableCell>
                  {row.isDefault && !row.dirty ? (
                    <Badge variant="outline" className="text-xs">padrão</Badge>
                  ) : row.dirty ? (
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">alterado</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">customizado</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
