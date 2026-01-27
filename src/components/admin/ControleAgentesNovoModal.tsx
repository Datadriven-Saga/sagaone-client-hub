import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Plus,
  Save,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Rocket,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const statusOptions = [
  { value: "ok", label: "OK", icon: CheckCircle2, color: "text-green-600" },
  { value: "IMPLANTADA", label: "Implantada", icon: CheckCircle2, color: "text-green-600" },
  { value: "em_desenvolvimento", label: "Em Desenvolvimento", icon: Settings, color: "text-yellow-600" },
  { value: "em_roll_out", label: "Em Roll Out", icon: Rocket, color: "text-blue-600" },
  { value: "pendente", label: "Pendente", icon: Clock, color: "text-gray-600" },
  { value: "erro", label: "Erro", icon: AlertCircle, color: "text-red-600" },
  { value: "bloqueado", label: "Bloqueado", icon: XCircle, color: "text-red-600" },
];

export function ControleAgentesNovoModal({ open, onOpenChange, onSave }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    nome_agente: "",
    tipo_agente: "",
    marca: "",
    uf: "",
    loja: "",
    cnpj: "",
    responsavel: "",
    implantador: "",
    telefone_toca: "",
    cronograma: "",
    status: "pendente",
    chamado: "",
    observacoes: "",
    descricao: "",
    numero_telefone: "",
    ativo: true
  });

  const handleSave = async () => {
    if (!formData.nome_agente || !formData.tipo_agente || !formData.marca || !formData.uf || !formData.loja || !formData.cnpj) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("controle_agentes")
        .insert({
          nome_agente: formData.nome_agente,
          tipo_agente: formData.tipo_agente,
          marca: formData.marca,
          uf: formData.uf,
          loja: formData.loja,
          cnpj: formData.cnpj,
          responsavel: formData.responsavel || null,
          implantador: formData.implantador || null,
          telefone_toca: formData.telefone_toca || null,
          cronograma: formData.cronograma || null,
          status: formData.status || null,
          chamado: formData.chamado || null,
          observacoes: formData.observacoes || null,
          descricao: formData.descricao || null,
          numero_telefone: formData.numero_telefone || null,
          ativo: formData.ativo,
          created_by: user?.id
        });

      if (error) throw error;

      toast({ title: "Sucesso", description: "Agente criado com sucesso!" });
      
      // Reset form
      setFormData({
        nome_agente: "",
        tipo_agente: "",
        marca: "",
        uf: "",
        loja: "",
        cnpj: "",
        responsavel: "",
        implantador: "",
        telefone_toca: "",
        cronograma: "",
        status: "pendente",
        chamado: "",
        observacoes: "",
        descricao: "",
        numero_telefone: "",
        ativo: true
      });
      
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o agente",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Novo Agente
          </DialogTitle>
          <DialogDescription>
            Cadastre um novo agente no sistema de controle
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Dados Básicos */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Dados do Agente
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Agente *</Label>
                  <Input
                    value={formData.nome_agente}
                    onChange={(e) => setFormData({ ...formData, nome_agente: e.target.value })}
                    placeholder="Ex: Aila, Bela, Pri..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Input
                    value={formData.tipo_agente}
                    onChange={(e) => setFormData({ ...formData, tipo_agente: e.target.value })}
                    placeholder="Ex: Prospecção, Entrega..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número do Agente</Label>
                  <Input
                    value={formData.numero_telefone}
                    onChange={(e) => setFormData({ ...formData, numero_telefone: e.target.value })}
                    placeholder="Ex: 5562999999999"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone que Toca</Label>
                  <Input
                    value={formData.telefone_toca}
                    onChange={(e) => setFormData({ ...formData, telefone_toca: e.target.value })}
                    placeholder="Telefone de transferência"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva o que esse agente faz e pelo que é responsável..."
                  rows={3}
                />
              </div>
            </div>

            {/* Local de Implantação */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Local de Implantação
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Marca *</Label>
                  <Input
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    placeholder="Ex: Fiat, BYD..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>UF *</Label>
                  <Input
                    value={formData.uf}
                    onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                    placeholder="Ex: DF, GO..."
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Loja *</Label>
                  <Input
                    value={formData.loja}
                    onChange={(e) => setFormData({ ...formData, loja: e.target.value })}
                    placeholder="Ex: Park Sul"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="XX.XXX.XXX/XXXX-XX"
                />
              </div>
            </div>

            {/* Status da Implantação */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Status da Implantação
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input
                    value={formData.responsavel}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    placeholder="Nome do responsável"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Implantador</Label>
                  <Input
                    value={formData.implantador}
                    onChange={(e) => setFormData({ ...formData, implantador: e.target.value })}
                    placeholder="Nome do implantador"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className={`h-4 w-4 ${opt.color}`} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cronograma</Label>
                  <Input
                    value={formData.cronograma}
                    onChange={(e) => setFormData({ ...formData, cronograma: e.target.value })}
                    placeholder="Ex: 12/fev"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Número do Chamado</Label>
                <Input
                  value={formData.chamado}
                  onChange={(e) => setFormData({ ...formData, chamado: e.target.value })}
                  placeholder="Ex: #12345"
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label>Agente Ativo</Label>
                  <p className="text-sm text-muted-foreground">O agente será criado como ativo</p>
                </div>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Criar Agente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
