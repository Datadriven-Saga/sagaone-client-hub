import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Upload, X, Star, Loader2 } from "lucide-react";

interface ProdutoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: any;
  onSuccess: () => void;
}

export function ProdutoModal({ open, onOpenChange, produto, onSuccess }: ProdutoModalProps) {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    categoria: "",
    ativo: true,
    ficha_tecnica: "",
    fotos: [] as string[],
    foto_principal_index: 0
  });

  useEffect(() => {
    if (produto) {
      setFormData({
        nome: produto.nome || "",
        descricao: produto.descricao || "",
        categoria: produto.categoria || "",
        ativo: produto.ativo ?? true,
        ficha_tecnica: produto.ficha_tecnica || "",
        fotos: produto.fotos || [],
        foto_principal_index: produto.foto_principal_index || 0
      });
    } else {
      setFormData({
        nome: "",
        descricao: "",
        categoria: "",
        ativo: true,
        ficha_tecnica: "",
        fotos: [],
        foto_principal_index: 0
      });
    }
  }, [produto, open]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const remainingSlots = 10 - formData.fotos.length;
    if (remainingSlots <= 0) {
      toast.error("Máximo de 10 fotos permitidas");
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploadingPhoto(true);

    try {
      const uploadedUrls: string[] = [];
      
      for (const file of filesToUpload) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `produtos/${activeCompany?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('agent-photos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('agent-photos')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setFormData(prev => ({
        ...prev,
        fotos: [...prev.fotos, ...uploadedUrls]
      }));
      
      toast.success(`${uploadedUrls.length} foto(s) adicionada(s)`);
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Erro ao enviar foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => {
      const newFotos = prev.fotos.filter((_, i) => i !== index);
      let newPrincipalIndex = prev.foto_principal_index;
      
      if (index === prev.foto_principal_index) {
        newPrincipalIndex = 0;
      } else if (index < prev.foto_principal_index) {
        newPrincipalIndex = prev.foto_principal_index - 1;
      }
      
      return {
        ...prev,
        fotos: newFotos,
        foto_principal_index: Math.min(newPrincipalIndex, newFotos.length - 1)
      };
    });
  };

  const setMainPhoto = (index: number) => {
    setFormData(prev => ({ ...prev, foto_principal_index: index }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    if (!activeCompany?.id) {
      toast.error("Selecione uma empresa");
      return;
    }

    setLoading(true);

    try {
      const productData = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        categoria: formData.categoria.trim() || null,
        ativo: formData.ativo,
        ficha_tecnica: formData.ficha_tecnica.trim() || null,
        fotos: formData.fotos,
        foto_principal_index: formData.foto_principal_index,
        imagem_url: formData.fotos[formData.foto_principal_index] || null,
        empresa_id: activeCompany.id
      };

      if (produto?.id) {
        const { error } = await supabase
          .from('produtos')
          .update(productData)
          .eq('id', produto.id);

        if (error) throw error;
        toast.success("Produto atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from('produtos')
          .insert([productData]);

        if (error) throw error;
        toast.success("Produto criado com sucesso");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast.error(error.message || "Erro ao salvar produto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{produto ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fotos */}
          <div className="space-y-3">
            <Label>Fotos do Produto (máximo 10)</Label>
            <div className="grid grid-cols-5 gap-2">
              {formData.fotos.map((foto, index) => (
                <div 
                  key={index} 
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                    index === formData.foto_principal_index 
                      ? 'border-primary' 
                      : 'border-border'
                  }`}
                >
                  <img 
                    src={foto} 
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 right-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setMainPhoto(index)}
                      className={`p-1 rounded-full ${
                        index === formData.foto_principal_index 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-background/80 text-muted-foreground hover:text-primary'
                      }`}
                      title="Definir como foto principal"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="p-1 rounded-full bg-destructive text-destructive-foreground"
                      title="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {index === formData.foto_principal_index && (
                    <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                      Principal
                    </div>
                  )}
                </div>
              ))}
              
              {formData.fotos.length < 10 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                  {uploadingPhoto ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Adicionar</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploadingPhoto}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Clique na estrela para definir a foto principal
            </p>
          </div>

          {/* Dados básicos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do produto"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Input
                id="categoria"
                value={formData.categoria}
                onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
                placeholder="Ex: Veículos, Peças..."
              />
            </div>
          </div>


          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descrição detalhada do produto..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ficha_tecnica">Ficha Técnica</Label>
            <Textarea
              id="ficha_tecnica"
              value={formData.ficha_tecnica}
              onChange={(e) => setFormData(prev => ({ ...prev, ficha_tecnica: e.target.value }))}
              placeholder="Especificações técnicas do produto..."
              rows={4}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
            />
            <Label htmlFor="ativo">Produto ativo</Label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : produto ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}