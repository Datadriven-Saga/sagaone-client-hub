import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Edit, Trash2, Shield } from "lucide-react";

const Acessos = () => {
  const usuarios = [
    {
      id: "1",
      nome: "João Silva",
      email: "joao@tavat.com.br",
      tipo: "Administrador",
      status: "Ativo",
      ultimoAcesso: "2024-01-15 14:30"
    },
    {
      id: "2",
      nome: "Maria Santos", 
      email: "maria@tavat.com.br",
      tipo: "Manager",
      status: "Ativo",
      ultimoAcesso: "2024-01-15 13:45"
    },
    {
      id: "3",
      nome: "Pedro Costa",
      email: "pedro@tavat.com.br", 
      tipo: "SDR",
      status: "Ativo",
      ultimoAcesso: "2024-01-15 12:20"
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Acessos</h1>
            <p className="text-muted-foreground">
              Gerencie usuários e permissões do sistema
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários do Sistema
            </CardTitle>
            <CardDescription>
              Lista de todos os usuários e suas permissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usuarios.map((usuario) => (
                <div key={usuario.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{usuario.nome}</h3>
                    <p className="text-sm text-muted-foreground">{usuario.email}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Shield className="h-4 w-4" />
                        {usuario.tipo}
                      </span>
                      <span>Último acesso: {usuario.ultimoAcesso}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      {usuario.status}
                    </span>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Acessos;