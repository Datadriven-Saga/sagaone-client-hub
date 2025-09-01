import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Zap } from "lucide-react";
import { useState } from "react";

interface Gatilho {
  id: string;
  nome: string;
  descricao: string;
  modulo: string;
  acao: string;
  ativo: boolean;
}

const Gatilhos = () => {
  const [gatilhos, setGatilhos] = useState<Gatilho[]>([
    {
      id: "1",
      nome: "Novo Lead Criado",
      descricao: "Disparado quando um novo lead é criado no sistema",
      modulo: "Central de Atendimento",
      acao: "criacao_lead",
      ativo: true
    },
    {
      id: "2",
      nome: "Nova Prospecção Criada",
      descricao: "Disparado quando uma nova prospecção é criada",
      modulo: "Prospecção",
      acao: "criacao_prospeccao",
      ativo: true
    },
    {
      id: "3",
      nome: "Status de Prospecção Alterado",
      descricao: "Disparado quando o status de uma prospecção é alterado",
      modulo: "Prospecção",
      acao: "alteracao_status_prospeccao",
      ativo: true
    },
    {
      id: "4",
      nome: "Status de Lead Alterado",
      descricao: "Disparado quando o status de um lead é alterado",
      modulo: "Central de Atendimento",
      acao: "alteracao_status_lead",
      ativo: true
    },
    {
      id: "5",
      nome: "Novo Busca & Resgate",
      descricao: "Disparado quando um novo evento de busca e resgate é criado",
      modulo: "Busca & Resgate",
      acao: "criacao_busca_resgate",
      ativo: true
    },
    {
      id: "6",
      nome: "Anotação Adicionada",
      descricao: "Disparado quando uma anotação é adicionada em qualquer módulo",
      modulo: "Geral",
      acao: "inclusao_anotacao",
      ativo: true
    }
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editingGatilho, setEditingGatilho] = useState<Gatilho | null>(null);

  const modulos = [
    "Prospecção",
    "Central de Atendimento", 
    "Loja",
    "Busca & Resgate",
    "Carteira de Clientes",
    "Geral"
  ];

  const acoesPadrao = [
    { valor: "criacao_lead", nome: "Criação de Lead" },
    { valor: "criacao_prospeccao", nome: "Criação de Prospecção" },
    { valor: "criacao_busca_resgate", nome: "Criação de Busca & Resgate" },
    { valor: "alteracao_status_prospeccao", nome: "Alteração de Status - Prospecção" },
    { valor: "alteracao_status_lead", nome: "Alteração de Status - Lead" },
    { valor: "alteracao_status_busca", nome: "Alteração de Status - Busca & Resgate" },
    { valor: "inclusao_anotacao", nome: "Inclusão de Anotação" },
    { valor: "cliente_cadastrado", nome: "Cliente Cadastrado" },
    { valor: "produto_vinculado", nome: "Produto Vinculado" },
    { valor: "agendamento_realizado", nome: "Agendamento Realizado" }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Gatilhos do Sistema
            </h1>
            <p className="text-muted-foreground">
              Configure gatilhos para automatizar ações baseadas em eventos do sistema
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Gatilho
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingGatilho ? "Editar Gatilho" : "Novo Gatilho"}
              </CardTitle>
              <CardDescription>
                Configure um novo gatilho baseado em ações do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome do Gatilho</Label>
                  <Input 
                    id="nome" 
                    placeholder="Ex: Novo Lead Criado"
                    defaultValue={editingGatilho?.nome || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="modulo">Módulo</Label>
                  <select 
                    id="modulo"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    defaultValue={editingGatilho?.modulo || ""}
                  >
                    <option value="">Selecione o módulo</option>
                    {modulos.map((modulo) => (
                      <option key={modulo} value={modulo}>
                        {modulo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="acao">Ação</Label>
                <select 
                  id="acao"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue={editingGatilho?.acao || ""}
                >
                  <option value="">Selecione a ação</option>
                  {acoesPadrao.map((acao) => (
                    <option key={acao.valor} value={acao.valor}>
                      {acao.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea 
                  id="descricao" 
                  placeholder="Descreva quando este gatilho deve ser disparado..."
                  rows={3}
                  defaultValue={editingGatilho?.descricao || ""}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="ativo" 
                  defaultChecked={editingGatilho?.ativo !== false}
                />
                <Label htmlFor="ativo">Gatilho ativo</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowForm(false);
                    setEditingGatilho(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button>
                  {editingGatilho ? "Atualizar" : "Criar"} Gatilho
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Gatilhos */}
        <div className="grid grid-cols-1 gap-4">
          {gatilhos.map((gatilho) => (
            <Card key={gatilho.id}>
              <CardHeader className="flex flex-row items-center space-y-0 pb-4">
                <div className="flex items-center space-x-3">
                  <Zap className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{gatilho.nome}</CardTitle>
                    <CardDescription>{gatilho.descricao}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-auto">
                  <Badge variant={gatilho.ativo ? "default" : "secondary"}>
                    {gatilho.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingGatilho(gatilho);
                      setShowForm(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Módulo: </span>
                    <Badge variant="outline">{gatilho.modulo}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ação: </span>
                    <code className="bg-muted px-2 py-1 rounded text-xs">
                      {gatilho.acao}
                    </code>
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

export default Gatilhos;