import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

export function CriarCaixaCWTab() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nomeContaMaiaCRM: "",
    idNumeroMeta: "",
    idContaWABA: "",
    tokenMeta: "",
    marca: "",
    telefoneIA: "",
    uf: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const isValid = Object.values(form).every(v => v.trim() !== "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      // TODO: implement API call
      toast.success("Instância criada com sucesso!");
      setForm({
        nomeContaMaiaCRM: "",
        idNumeroMeta: "",
        idContaWABA: "",
        tokenMeta: "",
        marca: "",
        telefoneIA: "",
        uf: "",
      });
    } catch (error) {
      toast.error("Erro ao criar instância. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto mt-4">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Cria Instancia Evo</CardTitle>
        <CardDescription>
          Esse formulário cria instância evolution e chatwoot (MaiaCRM). Ele já cadastra os dados na tabela de instâncias da Maia e retornar os dados para visualizar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>
              Nome Conta MaiaCRM <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Nome Conta no MaiaCRM"
              value={form.nomeContaMaiaCRM}
              onChange={e => handleChange("nomeContaMaiaCRM", e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>
              ID do número na Meta <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="ID do Número na Meta"
              value={form.idNumeroMeta}
              onChange={e => handleChange("idNumeroMeta", e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>
              ID Conta WABA <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="ID Conta WABA"
              value={form.idContaWABA}
              onChange={e => handleChange("idContaWABA", e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Token da Meta <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Token Permanente da Meta"
              value={form.tokenMeta}
              onChange={e => handleChange("tokenMeta", e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Marca <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Marca do Número"
              value={form.marca}
              onChange={e => handleChange("marca", e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Telefone da IA (Com DDD) <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Formato: 1188776655 - Sem o nove adicional"
              value={form.telefoneIA}
              onChange={e => handleChange("telefoneIA", e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label>
              UF <span className="text-destructive">*</span>
            </Label>
            <Select value={form.uf} onValueChange={v => handleChange("uf", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma opção..." />
              </SelectTrigger>
              <SelectContent>
                {UF_OPTIONS.map(uf => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !isValid}>
            {loading ? "Criando..." : "Criar Instância"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
