import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit2, Trash2, Phone, Mail, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OptOutModal } from "./OptOutModal";
import { OptOutDetailsModal } from "./OptOutDetailsModal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { OptOut } from "@/pages/ControleOptOut";

interface OptOutTableProps {
  data: OptOut[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function OptOutTable({ data, isLoading, onRefresh }: OptOutTableProps) {
  const { toast } = useToast();
  const [editingOptOut, setEditingOptOut] = useState<OptOut | null>(null);
  const [viewingOptOut, setViewingOptOut] = useState<OptOut | null>(null);
  const [deletingOptOut, setDeletingOptOut] = useState<OptOut | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!deletingOptOut) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("opt_outs")
        .delete()
        .eq("id", deletingOptOut.id);

      if (error) throw error;

      toast({
        title: "Opt-out removido",
        description: "Registro removido com sucesso",
      });
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message || "Erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeletingOptOut(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              Nenhum opt-out encontrado
            </h3>
            <p>Não há registros de opt-out que correspondam aos filtros aplicados.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Opt-out</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((optOut) => (
                  <TableRow key={optOut.id}>
                    <TableCell>
                      <div className="font-medium">
                        {format(new Date(optOut.data_optout), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(optOut.data_optout), "HH:mm", {
                          locale: ptBR,
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {optOut.nome || "Não informado"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {optOut.telefone_e164 && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {optOut.telefone_e164}
                          </div>
                        )}
                        {optOut.email_normalizado && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {optOut.email_normalizado}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getChannelColor(optOut.canal)}>
                        {optOut.canal}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {optOut.empresas?.nome_empresa || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getSourceColor(optOut.source)}>
                        {optOut.source}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {optOut.profiles?.nome_completo || "Sistema"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(optOut.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingOptOut(optOut)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingOptOut(optOut)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingOptOut(optOut)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <OptOutModal
        isOpen={!!editingOptOut}
        onClose={() => setEditingOptOut(null)}
        onSuccess={() => {
          setEditingOptOut(null);
          onRefresh();
        }}
        optOut={editingOptOut}
      />

      {/* Details Modal */}
      <OptOutDetailsModal
        optOut={viewingOptOut}
        isOpen={!!viewingOptOut}
        onClose={() => setViewingOptOut(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingOptOut} onOpenChange={() => setDeletingOptOut(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este opt-out? Esta ação não pode ser desfeita.
              <br />
              <br />
              <strong>Cliente:</strong> {deletingOptOut?.nome || "Não informado"}
              <br />
              <strong>Canal:</strong> {deletingOptOut?.canal}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}