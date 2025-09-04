import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";

const ProspeccaoTest = () => {
  console.log('🧪 ProspeccaoTest component loaded');
  
  return (
    <DashboardLayout title="Prospecção - Teste">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Teste de Prospecção</h1>
        <p className="text-muted-foreground">
          Se você está vendo esta mensagem, a navegação está funcionando.
        </p>
        <div className="mt-4 p-4 border rounded bg-green-50">
          <p className="text-green-600 font-medium">✅ Componente carregado com sucesso!</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProspeccaoTest;