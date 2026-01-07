import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2, Save, FileText, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Mensagem {
  id?: string;
  tipo: string;
  mensagem: string;
  periodo_dias: number;
}

// Tipos que usam período em dias
const TIPOS_MENSAGEM_COM_PERIODO = [
  { tipo: "Aniversário", dias: 0 },
  { tipo: "Recompra", dias: 365 },
  { tipo: "Revisão", dias: 180 },
  { tipo: "Financiamento", dias: 30 },
  { tipo: "Entrega do Veículo", dias: 7 }
];

// Texto inicial padrão para o modelo de descrição
const TEXTO_MODELO_PROSPECCAO = `🔥 Noite RAM na Saga BR-153!
Potência, exclusividade e oportunidades imperdíveis. 🚗💨

Chegou o momento que todo apaixonado por RAM esperava!
A Saga RAM BR-153 convida você para uma noite exclusiva de vendas, com atendimento VIP e condições únicas válidas apenas neste evento especial.

🌙 Evento noturno exclusivo
🛞 Chassis selecionados com preços imperdíveis
🤝 Atendimento personalizado com o gerente
🚗 Oportunidades disponíveis só no dia

🗓️ 28 de outubro, a partir das 18h
📍 Saga RAM BR-153

Viva uma experiência premium, com atendimento prioritário e condições feitas sob medida para quem valoriza potência e sofisticação.
Garanta sua presença e não perca essa oportunidade única de sair de RAM nova!

A PRI deve apenas convidar, confirmar interesse, e confirmar o endereço da loja.
Ela não deve falar sobre valores, taxas, entrada, financiamento, simulações ou detalhes técnicos de veículos.`;

// Tipos que são templates de texto longo (sem período)
const TIPOS_MENSAGEM_TEXTO_LONGO = [
  { 
    tipo: "Modelo Descrição Prospecção", 
    descricao: "Texto padrão usado ao clicar em 'Aplicar modelo' na criação de eventos",
    textoInicial: TEXTO_MODELO_PROSPECCAO
  }
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
      
      // Mensagens com período
      TIPOS_MENSAGEM_COM_PERIODO.forEach(t => {
        const found = data?.find(m => m.tipo === t.tipo);
        mensagensMap[t.tipo] = found 
          ? { id: found.id, tipo: found.tipo, mensagem: found.mensagem || "", periodo_dias: found.periodo_dias }
          : { tipo: t.tipo, mensagem: "", periodo_dias: t.dias };
      });
      
      // Mensagens de texto longo
      TIPOS_MENSAGEM_TEXTO_LONGO.forEach(t => {
        const found = data?.find(m => m.tipo === t.tipo);
        mensagensMap[t.tipo] = found 
          ? { id: found.id, tipo: found.tipo, mensagem: found.mensagem || "", periodo_dias: 0 }
          : { tipo: t.tipo, mensagem: t.textoInicial, periodo_dias: 0 };
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
    <div className="space-y-6">
      {/* Seção: Modelos de Texto Longo */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Modelos de Texto</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {TIPOS_MENSAGEM_TEXTO_LONGO.map((t) => {
              const msg = mensagens[t.tipo] || { tipo: t.tipo, mensagem: t.textoInicial, periodo_dias: 0 };
              const isSaving = savingType === t.tipo;
              
              return (
                <Card key={t.tipo} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{t.tipo}</h4>
                      <p className="text-sm text-muted-foreground">{t.descricao}</p>
                    </div>
                    <Button onClick={() => handleSave(t.tipo)} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                  <div>
                    <Textarea 
                      placeholder="Digite o modelo de texto..."
                      className="min-h-[300px] font-mono text-sm"
                      value={msg.mensagem}
                      onChange={(e) => handleChange(t.tipo, 'mensagem', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {msg.mensagem.length} caracteres
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* Seção: Mensagens Padrão com Período */}
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
          <div className="divide-y divide-border">
            {TIPOS_MENSAGEM_COM_PERIODO.map((t) => {
              const msg = mensagens[t.tipo] || { tipo: t.tipo, mensagem: "", periodo_dias: t.dias };
              const isSaving = savingType === t.tipo;
              
              return (
                <Collapsible key={t.tipo}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-4 hover:bg-muted/50 px-2 rounded-lg transition-colors group">
                    <div className="flex items-center gap-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                      <span className="font-medium">{t.tipo}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {msg.periodo_dias} dias
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-2 pb-4">
                    <div className="space-y-3 pt-2 pl-7">
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
                      
                      <div className="flex items-end gap-3">
                        <div className="w-32">
                          <label className="block text-sm font-medium mb-1">Período (dias)</label>
                          <Input 
                            type="number" 
                            value={msg.periodo_dias}
                            onChange={(e) => handleChange(t.tipo, 'periodo_dias', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <Button onClick={() => handleSave(t.tipo)} disabled={isSaving}>
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
