import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Trash2, ArrowLeft, FileText, RefreshCw, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Pair = { origem: string; destino: string };
type DeParaItem = { name: string; key: string; size: number; lastModified: string };

async function invokeS3<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("de-para-s3", { body });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export default function DePara() {
  const [items, setItems] = useState<DeParaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pairs, setPairs] = useState<Pair[]>([{ origem: "", destino: "" }]);
  const [saving, setSaving] = useState(false);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await invokeS3<{ items: DeParaItem[] }>({ action: "list" });
      setItems(res.items ?? []);
    } catch (e) {
      toast({ title: "Erro ao listar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  const openNew = () => {
    setEditing("");
    setName("");
    setPairs([{ origem: "", destino: "" }]);
  };

  const openEdit = async (item: DeParaItem) => {
    setEditing(item.name);
    setName(item.name);
    setPairs([{ origem: "", destino: "" }]);
    try {
      const res = await invokeS3<{ data: { pairs?: Pair[] } | null }>({ action: "get", name: item.name });
      const loaded = res.data?.pairs ?? [];
      setPairs(loaded.length ? loaded : [{ origem: "", destino: "" }]);
    } catch (e) {
      toast({ title: "Erro ao carregar", description: (e as Error).message, variant: "destructive" });
    }
  };

  const updatePair = (i: number, field: keyof Pair, value: string) => {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const addPair = () => setPairs((p) => [...p, { origem: "", destino: "" }]);
  const removePair = (i: number) => setPairs((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim()) {
      toast({ title: "Informe um nome", variant: "destructive" });
      return;
    }
    const cleaned = pairs.filter((p) => p.origem.trim() || p.destino.trim());
    setSaving(true);
    try {
      await invokeS3({ action: "save", name: name.trim(), data: { pairs: cleaned } });
      toast({ title: "De-Para salvo no S3" });
      setEditing(null);
      await loadList();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (editing !== null) {
    const payload = {
      name: name.trim(),
      pairs: pairs.filter((p) => p.origem.trim() || p.destino.trim()),
    };
    const jsonPreview = JSON.stringify(payload, null, 2);
    const copyJson = async () => {
      try {
        await navigator.clipboard.writeText(jsonPreview);
        toast({ title: "JSON copiado" });
      } catch {
        toast({ title: "Falha ao copiar", variant: "destructive" });
      }
    };
    return (
      <DashboardLayout title="De-Para">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        <div className="grid gap-4 md:grid-cols-[1fr_400px]">
          <Card>
            <CardHeader>
              <CardTitle>{editing ? "Editar De-Para" : "Novo De-Para"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: produtos_a_categoria"
                  disabled={!!editing}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use apenas letras, números, "_" e "-". Será salvo como <code>de-para/&lt;nome&gt;.json</code> no S3.
                </p>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>De (origem)</TableHead>
                      <TableHead>Para (destino)</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pairs.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input value={p.origem} onChange={(e) => updatePair(i, "origem", e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input value={p.destino} onChange={(e) => updatePair(i, "destino", e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removePair(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" onClick={addPair}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar linha
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Estrutura JSON</CardTitle>
              <Button variant="outline" size="sm" onClick={copyJson}>
                <Copy className="h-4 w-4 mr-2" /> Copiar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Objeto gravado em <code>de-para/&lt;name&gt;.json</code>:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><code>name</code> (string) — identificador do arquivo</li>
                  <li><code>pairs[]</code> — lista de <code>{`{ origem, destino }`}</code></li>
                </ul>
              </div>
              <pre className="font-mono text-xs bg-muted rounded-md p-3 max-h-[480px] overflow-auto whitespace-pre-wrap break-all">
{jsonPreview}
              </pre>
            </CardContent>
          </Card>
        </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="De-Para">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">De-Para</h1>
            <p className="text-sm text-muted-foreground">
              Mapeamentos armazenados no bucket S3 <code>dados-custom-entradados</code>.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadList} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Novo De-Para
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Atualizado em</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell></TableRow>
                )}
                {!loading && items.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum De-Para cadastrado.
                  </TableCell></TableRow>
                )}
                {!loading && items.map((it) => (
                  <TableRow key={it.key}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" /> {it.name}
                    </TableCell>
                    <TableCell>{it.lastModified ? new Date(it.lastModified).toLocaleString("pt-BR") : "-"}</TableCell>
                    <TableCell>{it.size} B</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openEdit(it)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}