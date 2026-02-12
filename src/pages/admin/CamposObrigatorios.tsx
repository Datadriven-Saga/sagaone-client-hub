import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FileText, Settings, ArrowLeft } from "lucide-react";

const CamposObrigatorios = () => {
  const navigate = useNavigate();
  
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
            <h1 className="text-2xl font-bold text-foreground">Campos Obrigatórios</h1>
            <p className="text-sm text-muted-foreground">
              Configure quais campos são obrigatórios em cada módulo
            </p>
          </div>
          <Button size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>

        <div className="grid gap-4">
          {modulos.map((modulo) => (
            <Card key={modulo.nome}>
              <CardHeader className="py-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{modulo.nome}</CardTitle>
                    <CardDescription className="text-xs">
                      {modulo.campos.filter(c => c.obrigatorio).length} de {modulo.campos.length} campos obrigatórios
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-2">
                  {modulo.campos.map((campo, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between py-2.5 px-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">{campo.nome}</span>
                        {campo.obrigatorio && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            Obrigatório
                          </span>
                        )}
                      </div>
                      <Switch 
                        checked={campo.obrigatorio}
                        onCheckedChange={() => {}}
                        className="scale-90"
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