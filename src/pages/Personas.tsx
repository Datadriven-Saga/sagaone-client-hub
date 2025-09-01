import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Bot } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Persona {
  id: string;
  foto: string;
  nome: string;
  funcao: string;
  acaoAtiva: boolean;
  numeroWhatsapp: string;
  gatilhos: string[];
  acoes: {
    gatilho: string;
    tempo: number;
    unidade: 'minutos' | 'horas' | 'dias';
    tipo: 'antes' | 'depois';
    mensagem: string;
  }[];
}

const Personas = () => {
  const [personas, setPersonas] = useState<Persona[]>([
    {
      id: "1",
      foto: "",
      nome: "Ana Vendedora",
      funcao: "Vendedora Senior",
      acaoAtiva: true,
      numeroWhatsapp: "+5511999999999",
      gatilhos: ["novo_lead", "status_alterado"],
      acoes: [
        {
          gatilho: "novo_lead",
          tempo: 5,
          unidade: "minutos",
          tipo: "depois",
          mensagem: "Olá! Vi que você tem interesse em nossos produtos. Como posso ajudar?"
        }
      ]
    }
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    funcao: '',
    whatsapp: '',
    acaoAtiva: 'sim',
    gatilhos: [] as string[],
    acoes: [] as any[]
  });

  const handleSavePersona = () => {
    if (editingPersona) {
      setPersonas(personas.map(p => 
        p.id === editingPersona.id 
          ? { 
              ...editingPersona, 
              nome: formData.nome,
              funcao: formData.funcao, 
              numeroWhatsapp: formData.whatsapp,
              acaoAtiva: formData.acaoAtiva === 'sim',
              gatilhos: formData.gatilhos,
              acoes: formData.acoes
            }
          : p
      ));
      toast.success("Persona atualizada com sucesso!");
    } else {
      const newPersona: Persona = {
        id: Date.now().toString(),
        foto: '',
        nome: formData.nome,
        funcao: formData.funcao,
        acaoAtiva: formData.acaoAtiva === 'sim',
        numeroWhatsapp: formData.whatsapp,
        gatilhos: formData.gatilhos,
        acoes: formData.acoes
      };
      setPersonas([...personas, newPersona]);
      toast.success("Persona criada com sucesso!");
    }
    setShowForm(false);
    setEditingPersona(null);
    setFormData({ nome: '', funcao: '', whatsapp: '', acaoAtiva: 'sim', gatilhos: [], acoes: [] });
  };

  const handleDeletePersona = (id: string) => {
    setPersonas(personas.filter(p => p.id !== id));
    toast.success("Persona excluída com sucesso!");
  };

  const mockGatilhos = [
    { id: "novo_lead", nome: "Novo Lead Criado" },
    { id: "status_alterado", nome: "Status Alterado" },
    { id: "anotacao_adicionada", nome: "Anotação Adicionada" },
    { id: "nova_prospeccao", nome: "Nova Prospecção Criada" },
    { id: "busca_resgate", nome: "Novo Busca & Resgate" }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Personas de IA
            </h1>
            <p className="text-muted-foreground">
              Gerencie personas de IA para automatizar interações com clientes
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Persona
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingPersona ? "Editar Persona" : "Nova Persona"}
              </CardTitle>
              <CardDescription>
                Configure uma persona de IA para automatizar atendimentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="dados" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dados">Dados da Persona</TabsTrigger>
                  <TabsTrigger value="gatilhos">Gatilhos</TabsTrigger>
                  <TabsTrigger value="acoes">Ações</TabsTrigger>
                </TabsList>
                
                <TabsContent value="dados" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome da Persona</Label>
                      <Input id="nome" placeholder="Ex: Ana Vendedora" />
                    </div>
                    <div>
                      <Label htmlFor="funcao">Função da Persona</Label>
                      <Input id="funcao" placeholder="Ex: Vendedora Senior" />
                    </div>
                    <div>
                      <Label htmlFor="whatsapp">Número WhatsApp</Label>
                      <Input id="whatsapp" placeholder="+5511999999999" />
                    </div>
                    <div>
                      <Label htmlFor="acao-ativa">Ação Ativa</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="foto">Foto da Persona</Label>
                    <Input id="foto" type="file" accept="image/*" />
                  </div>
                </TabsContent>

                <TabsContent value="gatilhos" className="space-y-4">
                  <div>
                    <Label>Gatilhos Disponíveis</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {mockGatilhos.map((gatilho) => (
                        <div key={gatilho.id} className="flex items-center space-x-2">
                          <input type="checkbox" id={gatilho.id} />
                          <Label htmlFor={gatilho.id}>{gatilho.nome}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="acoes" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Nova Ação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Gatilho</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o gatilho" />
                            </SelectTrigger>
                            <SelectContent>
                              {mockGatilhos.map((gatilho) => (
                                <SelectItem key={gatilho.id} value={gatilho.id}>
                                  {gatilho.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Tempo</Label>
                          <div className="flex gap-2">
                            <Input placeholder="5" type="number" />
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Unidade" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minutos">Minutos</SelectItem>
                                <SelectItem value="horas">Horas</SelectItem>
                                <SelectItem value="dias">Dias</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Quando</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Antes/Depois" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="antes">Antes</SelectItem>
                              <SelectItem value="depois">Depois</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>Mensagem</Label>
                        <Textarea 
                          placeholder="Digite a mensagem a ser enviada..." 
                          rows={4}
                          maxLength={500}
                        />
                      </div>
                      <Button>Adicionar Ação</Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSavePersona}>
                  {editingPersona ? "Atualizar" : "Criar"} Persona
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Personas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {personas.map((persona) => (
            <Card key={persona.id}>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                  <Bot className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{persona.nome}</CardTitle>
                    <CardDescription>{persona.funcao}</CardDescription>
                  </div>
                </div>
                <div className="flex space-x-1 ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingPersona(persona);
                      setShowForm(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeletePersona(persona.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WhatsApp:</span>
                    <span>{persona.numeroWhatsapp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={persona.acaoAtiva ? "text-green-600" : "text-red-600"}>
                      {persona.acaoAtiva ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gatilhos:</span>
                    <span>{persona.gatilhos.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ações:</span>
                    <span>{persona.acoes.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Personas;