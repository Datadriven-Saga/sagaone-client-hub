import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FileText, Settings } from "lucide-react";

const CamposObrigatorios = () => {
  const modulos = [
    {
      nome: "Clientes",
      campos: [
        { nome: "Nome", obrigatorio: true },
        { nome: "Email", obrigatorio: true },
        { nome: "Telefone", obrigatorio: false },
        { nome: "CPF/CNPJ", obrigatorio: false },
        { nome: "Endereço", obrigatorio: false }
      ]
    },
    {
      nome: "Leads",
      campos: [
        { nome: "Nome", obrigatorio: true },
        { nome: "Email", obrigatorio: false },
        { nome: "Telefone", obrigatorio: true },
        { nome: "Origem", obrigatorio: true },
        { nome: "Valor Potencial", obrigatorio: false }
      ]
    },
    {
      nome: "Vendas",
      campos: [
        { nome: "Cliente", obrigatorio: true },
        { nome: "Vendedor", obrigatorio: true },
        { nome: "Valor Total", obrigatorio: true },
        { nome: "Data da Venda", obrigatorio: true },
        { nome: "Observações", obrigatorio: false }
      ]
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campos Obrigatórios</h1>
            <p className="text-muted-foreground">
              Configure quais campos são obrigatórios em cada módulo
            </p>
          </div>
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Salvar Configurações
          </Button>
        </div>

        <div className="grid gap-6">
          {modulos.map((modulo) => (
            <Card key={modulo.nome}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {modulo.nome}
                </CardTitle>
                <CardDescription>
                  Configure os campos obrigatórios para o módulo {modulo.nome}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {modulo.campos.map((campo, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{campo.nome}</h4>
                        <p className="text-sm text-muted-foreground">
                          {campo.obrigatorio ? "Campo obrigatório" : "Campo opcional"}
                        </p>
                      </div>
                      <Switch 
                        checked={campo.obrigatorio}
                        onCheckedChange={() => {}}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CamposObrigatorios;