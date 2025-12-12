import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Type, 
  MousePointer2, 
  Image, 
  Video, 
  CreditCard, 
  List,
  Check,
  X
} from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";


type TemplateFormat = "texto" | "botao" | "imagem" | "video" | "card" | "lista";
type TemplateCategory = "marketing" | "utilidade";

interface TemplateFormData {
  nome: string;
  categoria: TemplateCategory | "";
  departamento_id: string;
  formato: TemplateFormat | "";
  conteudo: string;
  variaveis: string[];
}

const formatOptions = [
  { 
    value: "texto" as TemplateFormat, 
    label: "Texto", 
    description: "Template de texto simples.",
    icon: Type 
  },
  { 
    value: "botao" as TemplateFormat, 
    label: "Botões", 
    description: "Pequeno texto e botões de resposta.",
    icon: MousePointer2 
  },
  { 
    value: "imagem" as TemplateFormat, 
    label: "Imagem", 
    description: "Card composta de uma imagem e um título de assunto.",
    icon: Image 
  },
  { 
    value: "video" as TemplateFormat, 
    label: "Vídeo", 
    description: "Envie um vídeo para o cliente.",
    icon: Video 
  },
  { 
    value: "card" as TemplateFormat, 
    label: "Card", 
    description: "Envie um card com um título, texto, imagem e botões de resposta.",
    icon: CreditCard 
  },
  { 
    value: "lista" as TemplateFormat, 
    label: "Lista", 
    description: "Card composta de uma imagem e um título de assunto.",
    icon: List 
  },
];

const systemVariables = [
  { value: "{{nome_cliente}}", label: "Nome do Cliente" },
  { value: "{{empresa}}", label: "Empresa" },
  { value: "{{marca}}", label: "Marca" },
  { value: "{{data_atual}}", label: "Data Atual" },
  { value: "{{nome_prospeccao}}", label: "Nome Prospecção" },
  { value: "{{data_inicio}}", label: "Data Início" },
  { value: "{{data_fim}}", label: "Data Fim" },
];

export default function Templates() {
  const { activeCompany } = useCompany();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TemplateFormData>({
    nome: "",
    categoria: "",
    departamento_id: "",
    formato: "",
    conteudo: "",
    variaveis: [],
  });

  // Fetch departamentos
  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos", activeCompany?.id],
    queryFn: async () => {
      if (!activeCompany?.id) return [];
      const { data, error } = await supabase
        .from("departamentos")
        .select("*")
        .eq("empresa_id", activeCompany.id)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!activeCompany?.id,
  });

  // Mock templates data (will be replaced with real data later)
  const templates: any[] = [];

  const handleOpenModal = () => {
    setFormData({
      nome: "",
      categoria: "",
      departamento_id: "",
      formato: "",
      conteudo: "",
      variaveis: [],
    });
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentStep(1);
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.nome || !formData.categoria || !formData.departamento_id) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }
    }
    if (currentStep === 2) {
      if (!formData.formato) {
        toast.error("Selecione um formato");
        return;
      }
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = () => {
    if (!formData.conteudo && formData.formato === "texto") {
      toast.error("Preencha o conteúdo do template");
      return;
    }
    toast.success("Template criado com sucesso!");
    handleCloseModal();
  };

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      conteudo: prev.conteudo + variable,
    }));
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div 
            className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
              step < currentStep 
                ? "bg-primary border-primary text-primary-foreground"
                : step === currentStep 
                  ? "border-primary text-primary bg-background"
                  : "border-muted-foreground/30 text-muted-foreground"
            }`}
          >
            {step < currentStep ? (
              <Check className="h-4 w-4" />
            ) : (
              <span className="text-sm font-medium">{step}</span>
            )}
          </div>
          <span className={`ml-2 text-sm font-medium ${
            step === currentStep ? "text-foreground" : "text-muted-foreground"
          }`}>
            {step === 1 ? "Definição" : step === 2 ? "Formato" : "Conteúdo"}
          </span>
          {step < 3 && (
            <div className={`w-16 h-0.5 mx-2 ${
              step < currentStep ? "bg-primary" : "bg-muted-foreground/30"
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Label htmlFor="nome" className="w-40 shrink-0 text-right">Nome do Template *</Label>
        <Input
          id="nome"
          value={formData.nome}
          onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
          placeholder="Ex: Convite Evento VIP"
          className="flex-1 bg-white"
        />
      </div>
      <div className="flex items-center gap-4">
        <Label htmlFor="categoria" className="w-40 shrink-0 text-right">Categoria *</Label>
        <Select
          value={formData.categoria}
          onValueChange={(value: TemplateCategory) => setFormData(prev => ({ ...prev, categoria: value }))}
        >
          <SelectTrigger className="flex-1 bg-white">
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="marketing">Marketing</SelectItem>
            <SelectItem value="utilidade">Utilidade</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-4">
        <Label htmlFor="departamento" className="w-40 shrink-0 text-right">Departamento *</Label>
        <Select
          value={formData.departamento_id}
          onValueChange={(value) => setFormData(prev => ({ ...prev, departamento_id: value }))}
        >
          <SelectTrigger className="flex-1 bg-white">
            <SelectValue placeholder="Selecione o departamento" />
          </SelectTrigger>
          <SelectContent>
            {departamentos.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>{dept.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-1">
      <h3 className="text-lg font-medium mb-2">Selecione o tipo</h3>
      {formatOptions.map((format) => (
        <Card 
          key={format.value}
          className={`cursor-pointer transition-all hover:border-primary ${
            formData.formato === format.value ? "border-primary border-2" : ""
          }`}
          onClick={() => setFormData(prev => ({ ...prev, formato: format.value }))}
        >
          <CardContent className="flex items-center justify-between py-1.5 px-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-muted">
                <format.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">{format.label}</p>
                <p className="text-xs text-muted-foreground">{format.description}</p>
              </div>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              formData.formato === format.value 
                ? "border-primary bg-primary" 
                : "border-muted-foreground/30"
            }`}>
              {formData.formato === format.value && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderStep3 = () => {
    if (formData.formato === "texto") {
      return (
        <div className="space-y-4">
          <div>
            <Label htmlFor="conteudo">Conteúdo do Template</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Máximo de 1024 caracteres
            </p>
            <Textarea
              id="conteudo"
              value={formData.conteudo}
              onChange={(e) => {
                if (e.target.value.length <= 1024) {
                  setFormData(prev => ({ ...prev, conteudo: e.target.value }));
                }
              }}
              placeholder="Digite o conteúdo do template..."
              className="min-h-[150px] bg-white"
            />
            <p className="text-sm text-muted-foreground mt-1 text-right">
              {formData.conteudo.length}/1024
            </p>
          </div>
          <div>
            <Label>Variáveis do Sistema</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Clique para inserir uma variável no texto
            </p>
            <div className="flex flex-wrap gap-2">
              {systemVariables.map((variable) => (
                <Badge
                  key={variable.value}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => insertVariable(variable.value)}
                >
                  {variable.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // For other formats, show placeholder
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Configuração para o formato "{formatOptions.find(f => f.value === formData.formato)?.label}" em desenvolvimento.
        </p>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Templates WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os templates de mensagens para integração com a Meta
            </p>
          </div>
          <Button onClick={handleOpenModal}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Type className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum template cadastrado
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie seu primeiro template de mensagem para WhatsApp
                </p>
                <Button onClick={handleOpenModal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Template
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.categoria}</Badge>
                      </TableCell>
                      <TableCell>{template.formato}</TableCell>
                      <TableCell>{template.departamento}</TableCell>
                      <TableCell>
                        <Badge variant={template.status === "aprovado" ? "default" : "secondary"}>
                          {template.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col overflow-hidden pb-3">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Novo Template</span>
              <Button variant="ghost" size="icon" onClick={handleCloseModal}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-shrink-0">
            {renderStepIndicator()}
          </div>
          
          <div className="flex-1 min-h-0 overflow-y-auto">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </div>

          <div className="flex-shrink-0 flex justify-end gap-2 pt-2 border-t mt-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack}>
                Voltar
              </Button>
            )}
            {currentStep < 3 ? (
              <Button onClick={handleNext}>
                Avançar
              </Button>
            ) : (
              <Button onClick={handleSave}>
                Salvar Template
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
