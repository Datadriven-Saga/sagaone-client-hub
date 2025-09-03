import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useNotificacoesData() {
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    atrasadas: 0,
    pendentes: 0,
    realizadas: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchNotificacoes() {
      try {
        const { data: notificacoesData, error } = await supabase
          .from('notificacoes')
          .select(`
            *,
            clientes:cliente_id(nome, telefone),
            contatos:contato_id(nome, telefone)
          `)
          .eq('destinatario_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const notificacoesList = notificacoesData || [];
        
        // Processar notificações para o formato esperado
        const notificacoesFormatted = notificacoesList.map(notif => ({
          id: notif.id,
          type: notif.tipo || 'Sistema',
          clientName: notif.clientes?.nome || notif.contatos?.nome || 'Cliente não identificado',
          eventDate: notif.data_envio ? new Date(notif.data_envio).toLocaleDateString('pt-BR') : '-',
          lastPurchase: '-', // Pode ser melhorado com dados de última compra
          lastVehicle: '-', // Pode ser melhorado com dados de veículo
          status: notif.status === 'Lida' ? 'Realizada' : 
                 notif.status === 'Pendente' ? 'Pendente' : 'Atrasada'
        }));

        setNotificacoes(notificacoesFormatted);

        // Calcular KPIs
        const now = new Date();
        const atrasadas = notificacoesList.filter(n => 
          n.status === 'Pendente' && 
          n.data_envio && 
          new Date(n.data_envio) < now
        ).length;

        const pendentes = notificacoesList.filter(n => n.status === 'Pendente').length;
        const realizadas = notificacoesList.filter(n => n.status === 'Lida').length;

        setKpis({
          atrasadas,
          pendentes,
          realizadas,
          total: notificacoesList.length
        });

      } catch (error) {
        console.error('Erro ao buscar notificações:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchNotificacoes();
  }, [user?.id]);

  return { notificacoes, kpis, loading };
}