import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Database, Table as TableIcon, GitMerge, Plus, Search, ArrowRight, LucideIcon } from "lucide-react";

type ItemTipo = "base" | "tabela" | "depara";

interface EntraDadosItem {
  id: string;
  nome: string;
  descricao: string;
  tipo: ItemTipo;
  ativo: boolean;
  url?: string;
}

const TIPO_META: Record<ItemTipo, { label: string; icon: LucideIcon; color: string }> = {
  base:    { label: "Base",    icon: Database,  color: "bg-primary/10 text-primary" },
  tabela:  { label: "Tabela",  icon: TableIcon, color: "bg-blue-500/10 text-blue-600" },
  depara:  { label: "De-Para", icon: GitMerge,  color: "bg-emerald-500/10 text-emerald-600" },
};

const MOCK_ITEMS: EntraDadosItem[] = [
  {
    id: "depara-marcas",
    nome: "Marcas",
    descricao: "Mapeamento de nomes de marcas vindas de fontes externas para o padrão interno.",
    tipo: "depara",
    ativo: true,
    url: "/de-para",
  },
  {
    id: "base-clientes-mestre",
    nome: "Clientes (mestre)",
    descricao: "Base consolidada de clientes do grupo, usada como fonte para enriquecimentos.",
    tipo: "base",
    ativo: true,
  },
  {
    id: "tabela-lojas",
    nome: "Lojas",
    descricao: "Cadastro de lojas com código, marca, UF e canal de atendimento.",
    tipo: "tabela",
    ativo: true,
  },
  {
    id: "tabela-modelos",
    nome: "Modelos de veículo",
    descricao: "Catálogo de modelos com família, segmento e código fabricante.",
    tipo: "tabela",
    ativo: true,
  },
];

type Filtro = "todos" | ItemTipo;

export default function EntraDados() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const stats = useMemo(() => ({
    base: MOCK_ITEMS.filter(i => i.tipo === "base").length,
    tabela: MOCK_ITEMS.filter(i => i.tipo === "tabela").length,
    depara: MOCK_ITEMS.filter(i => i.tipo === "depara").length,
  }), []);

  const itens = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return MOCK_ITEMS.filter(i => {
      if (filtro !== "todos" && i.tipo !== filtro) return false;
      if (q && !i.nome.toLowerCase().includes(q) && !i.descricao.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [busca, filtro]);

  const handleAbrir = (item: EntraDadosItem) => {
    if (item.url) {
      navigate(item.url);
      return;
    }
    toast({ title: "Em breve", description: `Visualização de "${item.nome}" ainda não está disponível.` });
  };

  const handleNovaBase = () => {
    toast({ title: "Em breve", description: "Criação de novas bases ainda não está disponível." });
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Entra Dados</h1>
            <p className="text-muted-foreground text-sm">
              Hub de bases, tabelas e de-paras mantidos pelo time.
            </p>
          </div>
          <Button onClick={handleNovaBase} className="gap-2">
            <Plus className="h-4 w-4" /> Nova base
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Bases"     value={stats.base}   icon={Database}  tone="bg-primary/10 text-primary" />
          <KpiCard label="Tabelas"   value={stats.tabela} icon={TableIcon} tone="bg-blue-500/10 text-blue-600" />
          <KpiCard label="De-Paras"  value={stats.depara} icon={GitMerge}  tone="bg-emerald-500/10 text-emerald-600" />
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="base">Bases</TabsTrigger>
              <TabsTrigger value="tabela">Tabelas</TabsTrigger>
              <TabsTrigger value="depara">De-Paras</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Grid */}
        {itens.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum item encontrado com os filtros atuais.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {itens.map((item) => {
              const meta = TIPO_META[item.tipo];
              const Icon = meta.icon;
              return (
                <Card key={item.id} className="hover:shadow-card transition-shadow flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`p-2 rounded-lg ${meta.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant={item.ativo ? "default" : "secondary"}>
                        {item.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2">{item.nome}</CardTitle>
                    <div className="text-xs text-muted-foreground">{meta.label}</div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between gap-4">
                    <p className="text-sm text-muted-foreground line-clamp-3">{item.descricao}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start gap-2"
                      onClick={() => handleAbrir(item)}
                    >
                      Abrir <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}