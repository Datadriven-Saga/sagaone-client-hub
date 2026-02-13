import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Upload, Trash2, Download, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/components/ui/use-toast';

interface Documento {
  id: string;
  nome: string;
  descricao: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  tipo_arquivo: string | null;
  tamanho_arquivo: number | null;
  created_at: string;
  updated_at: string;
}

// Documentos padrão que devem existir
const DOCUMENTOS_PADRAO = [
  {
    nome: '+1 Saga',
    descricao: 'Modelo de impressão para registro de vendas +1 SAGA',
  },
  {
    nome: 'Logo da Empresa',
    descricao: 'Logomarca oficial da empresa para uso em documentos e materiais',
  },
];

export function DocumentosTab() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const { activeCompany } = useCompany();
  const { toast } = useToast();

  const fetchDocumentos = async () => {
    if (!activeCompany?.id) return;

    try {
      setLoading(true);
      
      // First, ensure default documents exist
      for (const docPadrao of DOCUMENTOS_PADRAO) {
        const { data: existing } = await supabase
          .from('documentos_configuracao')
          .select('id')
          .eq('empresa_id', activeCompany.id)
          .eq('nome', docPadrao.nome)
          .maybeSingle();

        if (!existing) {
          await supabase
            .from('documentos_configuracao')
            .insert({
              empresa_id: activeCompany.id,
              nome: docPadrao.nome,
              descricao: docPadrao.descricao,
            });
        }
      }

      // Fetch all documents
      const { data, error } = await supabase
        .from('documentos_configuracao')
        .select('*')
        .order('nome');

      if (error) throw error;
      setDocumentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentos();
  }, [activeCompany?.id]);

  const handleUpload = async (documentoId: string, file: File) => {
    if (!activeCompany?.id) return;

    // Validate file size (max 10MB for documents)
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Erro', description: 'Arquivo muito grande. Máximo 10MB.', variant: 'destructive' });
      return;
    }

    try {
      setUploading(documentoId);

      const fileExt = file.name.split('.').pop();
      const fileName = `${activeCompany.id}/${documentoId}-${Date.now()}.${fileExt}`;

      // Upload file to storage with explicit content type
      const { error: uploadError } = await supabase.storage
        .from('documentos-configuracao')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documentos-configuracao')
        .getPublicUrl(fileName);

      // Update document record
      const { error: updateError } = await supabase
        .from('documentos_configuracao')
        .update({
          arquivo_url: urlData.publicUrl,
          arquivo_nome: file.name,
          tipo_arquivo: file.type,
          tamanho_arquivo: file.size,
        })
        .eq('id', documentoId);

      if (updateError) throw updateError;

      toast({
        title: 'Arquivo enviado',
        description: 'O documento foi atualizado com sucesso.',
      });

      await fetchDocumentos();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveFile = async (documento: Documento) => {
    if (!documento.arquivo_url) return;

    try {
      // Extract file path from URL
      const url = new URL(documento.arquivo_url);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.indexOf('documentos-configuracao');
      if (bucketIndex !== -1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        
        // Delete from storage
        await supabase.storage
          .from('documentos-configuracao')
          .remove([filePath]);
      }

      // Update document record
      await supabase
        .from('documentos_configuracao')
        .update({
          arquivo_url: null,
          arquivo_nome: null,
          tipo_arquivo: null,
          tamanho_arquivo: null,
        })
        .eq('id', documento.id);

      toast({
        title: 'Arquivo removido',
        description: 'O arquivo foi removido com sucesso.',
      });

      await fetchDocumentos();
    } catch (error) {
      console.error('Erro ao remover arquivo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o arquivo.',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="text-primary" size={24} />
        <div>
          <h3 className="text-lg font-semibold">Documentos</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os modelos de documentos da empresa
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {documentos.map((documento) => (
          <div
            key={documento.id}
            className="border rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="text-primary" size={24} />
              </div>
              <div>
                <h4 className="font-medium">{documento.nome}</h4>
                {documento.descricao && (
                  <p className="text-sm text-muted-foreground">{documento.descricao}</p>
                )}
                {documento.arquivo_nome && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {documento.arquivo_nome} • {formatFileSize(documento.tamanho_arquivo)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {documento.arquivo_url ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => window.open(documento.arquivo_url!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => handleRemoveFile(documento)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                </>
              ) : (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(documento.id, file);
                    }}
                    disabled={uploading === documento.id}
                  />
                  <Button
                    variant="default"
                    size="sm"
                    disabled={uploading === documento.id}
                    asChild
                  >
                    <span>
                      {uploading === documento.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Enviar Arquivo
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              )}
            </div>
          </div>
        ))}

        {documentos.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-3 opacity-50" />
            <p>Nenhum documento configurado</p>
          </div>
        )}
      </div>
    </Card>
  );
}
