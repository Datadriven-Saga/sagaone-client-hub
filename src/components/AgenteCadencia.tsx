import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Clock, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Cadencia {
  id: string;
  quantidade_etapas: number;
  delay_inicial_minutos: number;
  intervalo_etapas_minutos: number;
  horario_inicio: string;
  horario_fim: string;
  timezone: string;
  dias_semana: string[];
  gatilho_cadencia: string;
  ativo: boolean;
}

interface AgenteCadenciaProps {
  agenteId: string;
  tipoCadencia: 'rapida' | 'acompanhamento';
  titulo: string;
  descricao: string;
}

export function AgenteCadencia({ agenteId, tipoCadencia, titulo, descricao }: AgenteCadenciaProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [cadencia, setCadencia] = useState<Cadencia | null>(null);
  
  // Valores padrão baseados no tipo de cadência
  const defaultValues = tipoCadencia === 'rapida' 
    ? {
        quantidade_etapas: 4,
        delay_inicial_minutos: 0,
        intervalo_etapas_minutos: 60,
        dias_semana: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"]
      }
    : {
        quantidade_etapas: 7,
        delay_inicial_minutos: 1440,
        intervalo_etapas_minutos: 1440,
        dias_semana: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"]
      };
  
  const [formData, setFormData] = useState({
    ...defaultValues,
    horario_inicio: "09:00",
    horario_fim: "18:00",
    timezone: "America/Sao_Paulo",
    gatilho_cadencia: "inatividade_cliente",
    ativo: true
  });

  const diasSemana = [
    { value: "segunda", label: "Segunda-feira" },
    { value: "terca", label: "Terça-feira" },
    { value: "quarta", label: "Quarta-feira" },
    { value: "quinta", label: "Quinta-feira" },
    { value: "sexta", label: "Sexta-feira" },
    { value: "sabado", label: "Sábado" },
    { value: "domingo", label: "Domingo" }
  ];

  const carregarCadencia = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('agente_cadencias')
        .select('*')
        .eq('agente_id', agenteId)
        .eq('tipo_cadencia', tipoCadencia)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        const cadenciaFormatada = {
          ...data,
          dias_semana: Array.isArray(data.dias_semana) ? data.dias_semana : JSON.parse(data.dias_semana as string || '[]')
        };
        setCadencia(cadenciaFormatada);
        setFormData({
          quantidade_etapas: data.quantidade_etapas,
          delay_inicial_minutos: data.delay_inicial_minutos,
          intervalo_etapas_minutos: data.intervalo_etapas_minutos,
          horario_inicio: data.horario_inicio,
          horario_fim: data.horario_fim,
          timezone: data.timezone,
          dias_semana: Array.isArray(data.dias_semana) ? data.dias_semana : JSON.parse(data.dias_semana as string || '[]'),
          gatilho_cadencia: data.gatilho_cadencia,
          ativo: data.ativo
        });
      }
    } catch (error) {
      console.error('Erro ao carregar cadência:', error);
      toast({
        title: "Erro ao carregar cadência",
        description: "Não foi possível carregar a configuração de cadência",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const cadenciaData = {
        agente_id: agenteId,
        tipo_cadencia: tipoCadencia,
        quantidade_etapas: formData.quantidade_etapas,
        delay_inicial_minutos: formData.delay_inicial_minutos,
        intervalo_etapas_minutos: formData.intervalo_etapas_minutos,
        horario_inicio: formData.horario_inicio,
        horario_fim: formData.horario_fim,
        timezone: formData.timezone,
        dias_semana: JSON.stringify(formData.dias_semana),
        gatilho_cadencia: formData.gatilho_cadencia,
        ativo: formData.ativo
      };

      if (cadencia) {
        // Atualizar cadência existente
        const { error } = await supabase
          .from('agente_cadencias')
          .update(cadenciaData)
          .eq('id', cadencia.id);
        
        if (error) throw error;
        
        toast({
          title: "Cadência atualizada",
          description: "A configuração de cadência foi atualizada com sucesso"
        });
      } else {
        // Criar nova cadência
        const { error } = await supabase
          .from('agente_cadencias')
          .insert(cadenciaData);
        
        if (error) throw error;
        
        toast({
          title: "Cadência criada",
          description: "A configuração de cadência foi criada com sucesso"
        });
      }
      
      await carregarCadencia();
    } catch (error) {
      console.error('Erro ao salvar cadência:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração de cadência",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDiaChange = (dia: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        dias_semana: [...prev.dias_semana, dia]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        dias_semana: prev.dias_semana.filter(d => d !== dia)
      }));
    }
  };

  useEffect(() => {
    carregarCadencia();
  }, [agenteId, tipoCadencia]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{titulo}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {descricao}
            </p>
          </div>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
          {/* Dias da semana */}
          <div className="space-y-4">
            <Label className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Dias da Semana
            </Label>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {diasSemana.map((dia) => (
                <div key={dia.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={dia.value}
                    checked={formData.dias_semana.includes(dia.value)}
                    onCheckedChange={(checked) => handleDiaChange(dia.value, checked as boolean)}
                  />
                  <Label htmlFor={dia.value} className="text-sm">
                    {dia.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Horários de funcionamento */}
          <div className="space-y-4">
            <Label className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário Disponível
            </Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="horario_inicio">Hora de Início</Label>
                <Input
                  id="horario_inicio"
                  type="time"
                  value={formData.horario_inicio}
                  onChange={(e) => setFormData(prev => ({ ...prev, horario_inicio: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="horario_fim">Hora de Fim</Label>
                <Input
                  id="horario_fim"
                  type="time"
                  value={formData.horario_fim}
                  onChange={(e) => setFormData(prev => ({ ...prev, horario_fim: e.target.value }))}
                />
              </div>
            </div>
          </div>

        </CardContent>
    </Card>
  );
}