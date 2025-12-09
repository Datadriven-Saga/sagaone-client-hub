import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface Mensagem {
  id?: string;
  tipo: string;
  mensagem: string;
  periodo_dias: number;
}

const TIPOS_MENSAGEM = [
  { tipo: "Aniversário", dias: 0 },
  { tipo: "Recompra", dias: 365 },
  { tipo: "Revisão", dias: 180 },
  { tipo: "Financiamento", dias: 30 },
  { tipo: "Entrega do Veículo", dias: 7 }
];

export function MensagensTab() {
  const { activeCompany } = useCompany();
  const [mensagens, setMensagens] = useState<Record<string, Mensagem>>({});
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);

  const fetchMensagens = async () => {
    if (!activeCompany?.id) {
      setMensagens({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mensagens_padrao')
        .select('*')
        .eq('empresa_id', activeCompany.id);

      if (error) throw error;

      const mensagensMap: Record<string, Mensagem> = {};
      TIPOS_MENSAGEM.forEach(t => {
        const found = data?.find(m => m.tipo === t.tipo);
        mensagensMap[t.tipo] = found 
          ? { id: found.id, tipo: found.tipo, mensagem: found.mensagem || "", periodo_dias: found.periodo_dias }
          : { tipo: t.tipo, mensagem: "", periodo_dias: t.dias };
      });
      setMensagens(mensagensMap);
    } catch (error) {
      console.error("Error fetching mensagens:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMensagens();
  }, [activeCompany?.id]);

  const handleChange = (tipo: string, field: 'mensagem' | 'periodo_dias', value: string | number) => {
    setMensagens(prev => ({
      ...prev,
      [tipo]: { ...prev[tipo], [field]: value }
    }));
  };

  const handleSave = async (tipo: string) => {
    if (!activeCompany?.id) {
      toast.error("Selecione uma empresa");
      return;
    }

    const msg = mensagens[tipo];
    setSavingType(tipo);
    
    try {
      if (msg.id) {
        const { error } = await supabase
          .from('mensagens_padrao')
          .update({ mensagem: msg.mensagem, periodo_dias: msg.periodo_dias })
          .eq('id', msg.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('mensagens_padrao')
          .insert([{ tipo, mensagem: msg.mensagem, periodo_dias: msg.periodo_dias, empresa_id: activeCompany.id }])
          .select()
          .single();
        if (error) throw error;
        setMensagens(prev => ({
          ...prev,
          [tipo]: { ...prev[tipo], id: data.id }
        }));
      }
      toast.success("Mensagem salva");
    } catch (error: any) {
      console.error("Error saving mensagem:", error);
      toast.error(error.message || "Erro ao salvar mensagem");
    } finally {
      setSavingType(null);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Mensagens Padrão</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {TIPOS_MENSAGEM.map((t) => {
            const msg = mensagens[t.tipo] || { tipo: t.tipo, mensagem: "", periodo_dias: t.dias };
            const isSaving = savingType === t.tipo;
            
            return (
              <Card key={t.tipo} className="p-4">
                <h4 className="font-semibold mb-3">{t.tipo}</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Mensagem</label>
                    <Textarea 
                      placeholder="Digite a mensagem padrão..."
                      className="min-h-[100px]"
                      maxLength={500}
                      value={msg.mensagem}
                      onChange={(e) => handleChange(t.tipo, 'mensagem', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {msg.mensagem.length}/500 caracteres
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Período (dias)</label>
                      <Input 
                        type="number" 
                        value={msg.periodo_dias}
                        onChange={(e) => handleChange(t.tipo, 'periodo_dias', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full" onClick={() => handleSave(t.tipo)} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}
