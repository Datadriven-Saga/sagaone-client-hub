import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Phone, ArrowRight, AlertCircle, UserCheck } from "lucide-react";
import { Contato } from "@/hooks/useContatoData";

interface NovoLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: () => void;
  onOpenContato: (contato: Contato) => void;
  profiles: { id: string; nome_completo: string; tipo_acesso: string | null; celular?: string | null; email?: string }[];
}

type Step = 'phone' | 'form' | 'owner-message';

interface OwnerInfo {
  nome: string;
  contato: Contato;
}

export const NovoLeadModal = ({
  isOpen,
  onClose,
  onLeadCreated,
  onOpenContato,
  profiles
}: NovoLeadModalProps) => {
  const [step, setStep] = useState<Step>('phone');
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  
  // Form fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState<string>("Outros");
  const [observacoes, setObservacoes] = useState("");
  
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('phone');
      setTelefone("");
      setOwnerInfo(null);
      setNome("");
      setEmail("");
      setOrigem("Outros");
      setObservacoes("");
    }
  }, [isOpen]);

  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, '');
  };

  const handleCheckPhone = async () => {
    if (!telefone.trim()) {
      toast({
        title: "Telefone obrigatório",
        description: "Por favor, informe o telefone do cliente.",
        variant: "destructive"
      });
      return;
    }

    if (!activeCompany?.id) {
      toast({
        title: "Erro",
        description: "Empresa não selecionada.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = normalizePhone(telefone);
      
      // Buscar contato existente pelo telefone na mesma empresa
      const { data: existingContatos, error } = await supabase
        .from('contatos')
        .select('*')
        .eq('empresa_id', activeCompany.id);

      if (error) throw error;

      // Filtrar por telefone normalizado
      const existingContato = existingContatos?.find(c => {
        const contatoPhone = normalizePhone(c.telefone || '');
        return contatoPhone === normalizedPhone || 
               contatoPhone.endsWith(normalizedPhone) || 
               normalizedPhone.endsWith(contatoPhone);
      });

      if (existingContato) {
        // Lead já existe - verificar responsável
        if (existingContato.responsavel_email) {
          // Verificar se o responsável é o próprio usuário
          const isCurrentUser = 
            existingContato.responsavel_email === user?.id ||
            existingContato.responsavel_email === user?.email;
          
          if (isCurrentUser) {
            // Lead pertence ao usuário atual - abrir para edição
            onOpenContato(existingContato as Contato);
            onClose();
            return;
          }
          
          // Lead pertence a outro usuário - mostrar mensagem
          const ownerProfile = profiles.find(p => 
            p.id === existingContato.responsavel_email ||
            p.email === existingContato.responsavel_email ||
            p.celular === existingContato.responsavel_email
          );
          
          setOwnerInfo({
            nome: ownerProfile?.nome_completo || existingContato.responsavel_email || 'Outro vendedor',
            contato: existingContato as Contato
          });
          setStep('owner-message');
          return;
        }
        
        // Lead existe mas ninguém está atendendo - atribuir ao usuário atual
        const { error: updateError } = await supabase
          .from('contatos')
          .update({ responsavel_email: user?.id })
          .eq('id', existingContato.id);
        
        if (updateError) throw updateError;
        
        toast({
          title: "Lead atribuído a você",
          description: "Este cliente já existia no sistema e agora está sob sua responsabilidade.",
        });
        
        // Abrir contato para edição
        const updatedContato = { ...existingContato, responsavel_email: user?.id } as Contato;
        onOpenContato(updatedContato);
        onClose();
        return;
      }

      // Lead não existe - ir para formulário de criação
      setStep('form');
    } catch (error) {
      console.error('Erro ao verificar telefone:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar telefone. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async () => {
    if (!nome.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do cliente.",
        variant: "destructive"
      });
      return;
    }

    if (!activeCompany?.id) {
      toast({
        title: "Erro",
        description: "Empresa não selecionada.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('contatos')
        .insert({
          nome: nome.trim(),
          telefone: telefone.trim(),
          email: email.trim() || null,
          origem: origem as any,
          observacoes: observacoes.trim() || null,
          responsavel_email: user?.id,
          empresa_id: activeCompany.id,
          status: 'Novo'
        });

      if (error) throw error;

      toast({
        title: "Lead criado",
        description: "O novo lead foi criado com sucesso.",
      });

      onLeadCreated();
      onClose();
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar lead. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {step === 'phone' && 'Novo Lead'}
            {step === 'form' && 'Cadastrar Lead'}
            {step === 'owner-message' && 'Lead em Atendimento'}
          </DialogTitle>
        </DialogHeader>

        {step === 'phone' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone do Cliente</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckPhone()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Informe o telefone para verificar se o cliente já está cadastrado
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleCheckPhone} disabled={loading}>
                {loading ? "Verificando..." : (
                  <>
                    Continuar
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Telefone:</span> {telefone}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Cliente *</Label>
              <Input
                id="nome"
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origem">Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Site">Site</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Input
                id="observacoes"
                placeholder="Observações opcionais"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('phone')}>
                Voltar
              </Button>
              <Button onClick={handleCreateLead} disabled={loading}>
                {loading ? "Criando..." : "Criar Lead"}
              </Button>
            </div>
          </div>
        )}

        {step === 'owner-message' && ownerInfo && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este cliente já está em atendimento pelo vendedor <strong>{ownerInfo.nome}</strong>.
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Informações do Lead</span>
              </div>
              <div className="text-sm space-y-1 pl-7">
                <p><span className="text-muted-foreground">Nome:</span> {ownerInfo.contato.nome}</p>
                <p><span className="text-muted-foreground">Telefone:</span> {ownerInfo.contato.telefone}</p>
                <p><span className="text-muted-foreground">Status:</span> {ownerInfo.contato.status}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onClose}>
                Entendi
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
