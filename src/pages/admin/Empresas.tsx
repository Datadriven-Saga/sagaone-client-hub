import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building, Users, Edit, Trash2 } from "lucide-react";

const Empresas = () => {
  const empresas = [
    {
      id: "1",
      nome: "TAVAT Tecnologia",
      razaoSocial: "TAVAT Tecnologia Ltda",
      cnpj: "12.345.678/0001-90",
      status: "Ativa",
      usuarios: 15
    },
    {
      id: "2", 
      nome: "Empresa Demo",
      razaoSocial: "Empresa Demo S.A.",
      cnpj: "98.765.432/0001-10",
      status: "Ativa",
      usuarios: 8
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Empresas</h1>
            <p className="text-muted-foreground">
              Gerencie as empresas cadastradas no sistema
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Empresas Cadastradas
            </CardTitle>
            <CardDescription>
              Lista de todas as empresas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {empresas.map((empresa) => (
                <div key={empresa.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{empresa.nome}</h3>
                    <p className="text-sm text-muted-foreground">{empresa.razaoSocial}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>CNPJ: {empresa.cnpj}</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {empresa.usuarios} usuários
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      {empresa.status}
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

export default Empresas;