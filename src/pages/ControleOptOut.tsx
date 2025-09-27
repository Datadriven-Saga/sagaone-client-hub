import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Plus, Search, Filter } from "lucide-react";
import { OptOutModal } from "@/components/OptOutModal";
import { OptOutFilters } from "@/components/OptOutFilters";
import { OptOutTable } from "@/components/OptOutTable";
import { ImportOptOutModal } from "@/components/ImportOptOutModal";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface OptOut {
  id: string;
  data_optout: string;
  nome: string;
  telefone_e164: string | null;
  email_normalizado: string | null;
  canal: 'Whatsapp' | 'Ligação' | 'SMS' | 'E-mail';
  empresa_id: string;
  source: string;
  created_at: string;
  created_by: string | null;
  profiles?: {
    nome_completo: string;
  };
  empresas?: {
    nome_empresa: string;
  };
}

export interface OptOutFilters {
  search: string;
  canal: string;
  empresa: string;
  dataInicio: string;
  dataFim: string;
}

export default function ControleOptOut() {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<OptOutFilters>({
    search: "",
    canal: "",
    empresa: "",
    dataInicio: "",
    dataFim: "",
  });

  const { data: optOuts, isLoading, refetch } = useQuery({
    queryKey: ["optOuts", filters],
    queryFn: async () => {
      let query = supabase
        .from("opt_outs")
        .select(`
          id,
          data_optout,
          nome,
          telefone_e164,
          email_normalizado,
          canal,
          empresa_id,
          source,
          created_at,
          created_by,
          empresas:empresa_id!inner(nome_empresa)
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters.search) {
        query = query.or(
          `nome.ilike.%${filters.search}%,telefone_e164.ilike.%${filters.search}%,email_normalizado.ilike.%${filters.search}%`
        );
      }
      if (filters.canal) {
        query = query.eq("canal", filters.canal as any);
      }
      if (filters.empresa) {
        query = query.eq("empresa_id", filters.empresa);
      }
      if (filters.dataInicio) {
        query = query.gte("data_optout", filters.dataInicio);
      }
      if (filters.dataFim) {
        query = query.lte("data_optout", filters.dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Get profiles separately to avoid relationship issues
      const optOutsWithProfiles = await Promise.all(
        (data || []).map(async (optOut) => {
          let profileName = "Sistema";
          if (optOut.created_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("nome_completo")
              .eq("id", optOut.created_by)
              .single();
            
            if (profile) {
              profileName = profile.nome_completo;
            }
          }
          
          return {
            ...optOut,
            profiles: { nome_completo: profileName }
          };
        })
      );
      
      return optOutsWithProfiles as OptOut[];
    },
  });

  const handleExport = async () => {
    try {
      const data = optOuts || [];
      const csvHeaders = [
        "Data Opt-out",
        "Nome",
        "Telefone",
        "E-mail", 
        "Canal",
        "Empresa",
        "Origem",
        "Criado por",
        "Data Criação"
      ];
      
      const csvRows = data.map(item => [
        format(new Date(item.data_optout), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        item.nome || "",
        item.telefone_e164 || "",
        item.email_normalizado || "",
        item.canal,
        item.empresas?.nome_empresa || "",
        item.source,
        item.profiles?.nome_completo || "",
        format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `opt-outs-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
      link.click();

      toast({
        title: "Exportação realizada",
        description: "Arquivo CSV baixado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados",
        variant: "destructive",
      });
    }
  };

  const stats = {
    total: optOuts?.length || 0,
    whatsapp: optOuts?.filter(o => o.canal === 'Whatsapp').length || 0,
    email: optOuts?.filter(o => o.canal === 'E-mail').length || 0,
    sms: optOuts?.filter(o => o.canal === 'SMS').length || 0,
    ligacao: optOuts?.filter(o => o.canal === 'Ligação').length || 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Controle Opt-out</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie solicitações de descadastramento por canal
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo Opt-out
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600">{stats.whatsapp}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              E-mail
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-blue-600">{stats.email}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              SMS
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-purple-600">{stats.sms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ligação
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-orange-600">{stats.ligacao}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, e-mail ou empresa..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {(filters.canal || filters.empresa || filters.dataInicio || filters.dataFim) && (
                <Badge variant="secondary" className="ml-1">
                  {[filters.canal, filters.empresa, filters.dataInicio, filters.dataFim].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <OptOutFilters
              filters={filters}
              onFiltersChange={setFilters}
            />
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <OptOutTable
        data={optOuts || []}
        isLoading={isLoading}
        onRefresh={refetch}
      />

      {/* Modals */}
      <OptOutModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          refetch();
          setIsCreateModalOpen(false);
        }}
      />

      <ImportOptOutModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          refetch();
          setIsImportModalOpen(false);
        }}
      />
    </div>
  );
}