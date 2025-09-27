import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Mail, Building, Calendar, User, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { OptOut } from "@/pages/ControleOptOut";

interface OptOutDetailsModalProps {
  optOut: OptOut | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OptOutDetailsModal({ optOut, isOpen, onClose }: OptOutDetailsModalProps) {
  if (!optOut) return null;

  const getChannelColor = (canal: string) => {
    switch (canal) {
      case "Whatsapp":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "E-mail":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "SMS":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "Ligação":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "UI":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "API":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "IMPORT":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes do Opt-out
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Data do Opt-out
                </h3>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {format(new Date(optOut.data_optout), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Canal
                </h3>
                <Badge className={getChannelColor(optOut.canal)}>
                  {optOut.canal}
                </Badge>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Origem
                </h3>
                <Badge variant="outline" className={getSourceColor(optOut.source)}>
                  {optOut.source === "UI" && "Interface"}
                  {optOut.source === "API" && "API Externa"}
                  {optOut.source === "IMPORT" && "Importação"}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Nome do Cliente
                </h3>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{optOut.nome || "Não informado"}</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Empresa
                </h3>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{optOut.empresas?.nome_empresa || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-medium mb-3">Informações de Contato</h3>
            <div className="space-y-2">
              {optOut.telefone_e164 && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Telefone:</span>
                  <span className="font-mono">{optOut.telefone_e164}</span>
                </div>
              )}
              
              {optOut.email_normalizado && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">E-mail:</span>
                  <span className="font-mono">{optOut.email_normalizado}</span>
                </div>
              )}

              {!optOut.telefone_e164 && !optOut.email_normalizado && (
                <div className="text-muted-foreground text-center py-4">
                  Nenhuma informação de contato disponível
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Audit Information */}
          <div>
            <h3 className="text-lg font-medium mb-3">Informações de Auditoria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Criado por:</span>
                <div className="font-medium">
                  {optOut.profiles?.nome_completo || "Sistema"}
                </div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Data de criação:</span>
                <div className="font-medium">
                  {format(new Date(optOut.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </div>
              </div>

              <div>
                <span className="text-muted-foreground">ID do registro:</span>
                <div className="font-mono text-xs">{optOut.id}</div>
              </div>

              <div>
                <span className="text-muted-foreground">Chave de deduplicação:</span>
                <div className="font-mono text-xs">
                  {optOut.telefone_e164 || optOut.email_normalizado}_{optOut.canal}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}