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
}

export function AgenteCadencia({ agenteId }: AgenteCadenciaProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [cadencia, setCadencia] = useState<Cadencia | null>(null);
  const [formData, setFormData] = useState({
    quantidade_etapas: 4,
    delay_inicial_minutos: 0,
    intervalo_etapas_minutos: 60,
    horario_inicio: "09:00",
    horario_fim: "18:00",
    timezone: "America/Sao_Paulo",
    dias_semana: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"],
    gatilho_cadencia: "inatividade_cliente",
    ativo: true
  });

  const gatilhosCadencia = [
    { value: "inatividade_cliente", label: "Inatividade do cliente" },
    { value: "encerramento_prospeccao", label: "Encerramento da prospecção" },
    { value: "encerramento_lead", label: "Encerramento do lead" },
    { value: "entrega_veiculo", label: "Entrega do veículo" }
  ];

  const diasSemana = [
    { value: "segunda", label: "Segunda-feira" },
    { value: "terca", label: "Terça-feira" },
    { value: "quarta", label: "Quarta-feira" },
    { value: "quinta", label: "Quinta-feira" },
    { value: "sexta", label: "Sexta-feira" },
    { value: "sabado", label: "Sábado" },
    { value: "domingo", label: "Domingo" }
  ];

  const timezones = [
    { value: "America/Sao_Paulo", label: "GMT-3 (Brasília)" },
    { value: "America/Manaus", label: "GMT-4 (Manaus)" },
    { value: "America/Rio_Branco", label: "GMT-5 (Rio Branco)" }
  ];

  const carregarCadencia = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('agente_cadencias')
        .select('*')
        .eq('agente_id', agenteId)
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
  }, [agenteId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Cadência</h2>
          <p className="text-muted-foreground">
            Configure a cadência de execução para este agente
          </p>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Salvando..." : "Salvar Cadência"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Configurações de Cadência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configurações básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantidade_etapas">Quantidade de Etapas</Label>
              <Input
                id="quantidade_etapas"
                type="number"
                min="1"
                value={formData.quantidade_etapas}
                onChange={(e) => setFormData(prev => ({ ...prev, quantidade_etapas: parseInt(e.target.value) || 1 }))}
              />
            </div>

            <div>
              <Label htmlFor="gatilho_cadencia">Gatilho da Cadência</Label>
              <Select 
                value={formData.gatilho_cadencia} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, gatilho_cadencia: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gatilho" />
                </SelectTrigger>
                <SelectContent>
                  {gatilhosCadencia.map((gatilho) => (
                    <SelectItem key={gatilho.value} value={gatilho.value}>
                      {gatilho.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="delay_inicial_minutos">Delay Inicial até a 1ª Etapa (minutos)</Label>
              <Input
                id="delay_inicial_minutos"
                type="number"
                min="0"
                value={formData.delay_inicial_minutos}
                onChange={(e) => setFormData(prev => ({ ...prev, delay_inicial_minutos: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <Label htmlFor="intervalo_etapas_minutos">Intervalo entre Etapas (minutos)</Label>
              <Input
                id="intervalo_etapas_minutos"
                type="number"
                min="1"
                value={formData.intervalo_etapas_minutos}
                onChange={(e) => setFormData(prev => ({ ...prev, intervalo_etapas_minutos: parseInt(e.target.value) || 60 }))}
              />
            </div>
          </div>

          {/* Horários de funcionamento */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Horário Disponível para Executar</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={formData.timezone} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((timezone) => (
                      <SelectItem key={timezone.value} value={timezone.value}>
                        {timezone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Dias da semana */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dias da Semana que será Executada
            </h3>
            
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

          {/* Status */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="cadencia_ativa"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked as boolean }))}
            />
            <Label htmlFor="cadencia_ativa">Cadência ativa</Label>
          </div>
        </CardContent>
      </Card>

      {/* Resumo da configuração */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo da Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Etapas:</strong> {formData.quantidade_etapas}</p>
              <p><strong>Delay inicial:</strong> {formData.delay_inicial_minutos} minutos</p>
              <p><strong>Intervalo:</strong> {formData.intervalo_etapas_minutos} minutos</p>
            </div>
            <div>
              <p><strong>Horário:</strong> {formData.horario_inicio} às {formData.horario_fim}</p>
              <p><strong>Timezone:</strong> {timezones.find(tz => tz.value === formData.timezone)?.label}</p>
              <p><strong>Gatilho:</strong> {gatilhosCadencia.find(g => g.value === formData.gatilho_cadencia)?.label}</p>
            </div>
          </div>
          <div className="mt-4">
            <p><strong>Dias ativos:</strong> {
              formData.dias_semana.map(dia => 
                diasSemana.find(d => d.value === dia)?.label
              ).join(', ')
            }</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}