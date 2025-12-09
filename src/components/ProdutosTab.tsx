import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Package, 
  Pencil, 
  Trash2, 
  Search,
  Loader2,
  ImageOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { ProdutoModal } from "./ProdutoModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  preco: number | null;
  estoque: number | null;
  ativo: boolean | null;
  imagem_url: string | null;
  fotos: string[] | null;
  foto_principal_index: number | null;
  ficha_tecnica: string | null;
}

export function ProdutosTab() {
  const { activeCompany } = useCompany();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [produtoToDelete, setProdutoToDelete] = useState<Produto | null>(null);

  const fetchProdutos = async () => {
    if (!activeCompany?.id) {
      setProdutos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('empresa_id', activeCompany.id)
        .order('nome');

      if (error) throw error;
      
      // Type assertion to handle the new columns
      const typedData = (data || []).map(item => ({
        ...item,
        fotos: (item as any).fotos || [],
        foto_principal_index: (item as any).foto_principal_index || 0,
        ficha_tecnica: (item as any).ficha_tecnica || null
      })) as Produto[];
      
      setProdutos(typedData);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProdutos();
  }, [activeCompany?.id]);

  const handleEdit = (produto: Produto) => {
    setSelectedProduto(produto);
    setModalOpen(true);
  };

  const handleNew = () => {
    setSelectedProduto(undefined);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!produtoToDelete) return;

    try {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', produtoToDelete.id);

      if (error) throw error;
      
      toast.success("Produto excluído com sucesso");
      fetchProdutos();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Erro ao excluir produto");
    } finally {
      setDeleteDialogOpen(false);
      setProdutoToDelete(null);
    }
  };

  const confirmDelete = (produto: Produto) => {
    setProdutoToDelete(produto);
    setDeleteDialogOpen(true);
  };

  const filteredProdutos = produtos.filter(produto => 
    produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  const getMainImage = (produto: Produto) => {
    if (produto.fotos && produto.fotos.length > 0) {
      const index = produto.foto_principal_index || 0;
      return produto.fotos[index] || produto.fotos[0];
    }
    return produto.imagem_url;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Produtos</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProdutos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-lg font-medium">Nenhum produto encontrado</p>
          <p className="text-sm">Clique em "Novo Produto" para adicionar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProdutos.map((produto) => {
            const mainImage = getMainImage(produto);
            
            return (
              <Card 
                key={produto.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Image */}
                <div className="aspect-video bg-muted relative">
                  {mainImage ? (
                    <img 
                      src={mainImage} 
                      alt={produto.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                  )}
                  {/* Photo count badge */}
                  {produto.fotos && produto.fotos.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                      +{produto.fotos.length - 1} fotos
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute top-2 left-2">
                    <Badge variant={produto.ativo ? "default" : "secondary"}>
                      {produto.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-base truncate" title={produto.nome}>
                      {produto.nome}
                    </h4>
                    {produto.categoria && (
                      <p className="text-xs text-muted-foreground">{produto.categoria}</p>
                    )}
                  </div>

                  {produto.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {produto.descricao}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(produto.preco)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Estoque: {produto.estoque ?? 0}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEdit(produto)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => confirmDelete(produto)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ProdutoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        produto={selectedProduto}
        onSuccess={fetchProdutos}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto "{produtoToDelete?.nome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}