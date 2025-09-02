import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Zap } from "lucide-react";
import { useState } from "react";

interface Gatilho {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  webhook_url: string;
  ativo: boolean;
}

const Gatilhos = () => {
  const tiposGatilho = [
    { 
      value: "novo_contato_prospeccao", 
      label: "Novo Contato Adicionado na Prospecção",
      modulo: "Prospecção"
    },
    { 
      value: "alteracao_status_contato", 
      label: "Alteração de Status do Contato na Prospecção",
      modulo: "Prospecção"
    },
    { 
      value: "adicao_anotacao_prospeccao", 
      label: "Adição de Anotação na Prospeção",
      modulo: "Prospecção"
    }
  ];

  const [gatilhos, setGatilhos] = useState<Gatilho[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    tipo: "",
    webhook_url: "",
    ativo: true
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      tipo: "",
      webhook_url: "",
      ativo: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (gatilho: Gatilho) => {
    setFormData({
      nome: gatilho.nome,
      descricao: gatilho.descricao,
      tipo: gatilho.tipo,
      webhook_url: gatilho.webhook_url,
      ativo: gatilho.ativo
    });
    setEditingId(gatilho.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nome && formData.tipo && formData.webhook_url) {
      const novoGatilho: Gatilho = {
        id: editingId || Date.now().toString(),
        nome: formData.nome,
        descricao: formData.descricao,
        tipo: formData.tipo,
        webhook_url: formData.webhook_url,
        ativo: formData.ativo
      };

      if (editingId) {
        setGatilhos(prev => prev.map(g => g.id === editingId ? novoGatilho : g));
      } else {
        setGatilhos(prev => [...prev, novoGatilho]);
      }
      resetForm();
    }
  };

  const handleDelete = (id: string) => {
    setGatilhos(prev => prev.filter(g => g.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gatilhos</h1>
            <p className="text-muted-foreground">
              Configure gatilhos automáticos para ações da prospecção
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Gatilho
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Editar Gatilho" : "Novo Gatilho"}</CardTitle>
              <CardDescription>
                Configure um gatilho para disparar webhooks automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome do Gatilho</Label>
                    <Input
                      id="nome"
                      placeholder="Ex: Novo contato adicionado"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="tipo">Tipo de Gatilho</Label>
                    <Select 
                      value={formData.tipo} 
                      onValueChange={(value) => setFormData({...formData, tipo: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de gatilho" />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposGatilho.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="webhook_url">URL do Webhook</Label>
                    <Input
                      id="webhook_url"
                      type="url"
                      placeholder="https://seu-webhook.com/endpoint"
                      value={formData.webhook_url}
                      onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    placeholder="Descreva quando este gatilho deve ser disparado..."
                    rows={3}
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                  />
                  <Label htmlFor="ativo">Gatilho ativo</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingId ? "Atualizar" : "Criar"} Gatilho
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {gatilhos.map((gatilho) => (
            <Card key={gatilho.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Zap className="h-6 w-6 text-primary" />
                    <div className="space-y-2">
                      <h3 className="font-semibold">{gatilho.nome}</h3>
                      <p className="text-sm text-muted-foreground">{gatilho.descricao}</p>
                      <div className="flex flex-col gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Tipo: {tiposGatilho.find(t => t.value === gatilho.tipo)?.label || gatilho.tipo}
                        </span>
                        <span className="text-muted-foreground">Webhook: {gatilho.webhook_url}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={gatilho.ativo ? "default" : "secondary"}>
                      {gatilho.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(gatilho)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(gatilho.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {gatilhos.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum gatilho configurado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro gatilho para automatizar ações da prospecção
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Gatilho
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Gatilhos;