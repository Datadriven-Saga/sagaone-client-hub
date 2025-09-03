import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { Toaster } from "@/components/ui/sonner";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <CompanyProvider>
        <App />
        <Toaster />
      </CompanyProvider>
    </AuthProvider>
  </React.StrictMode>
);
