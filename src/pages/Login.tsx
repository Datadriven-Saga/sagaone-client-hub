import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import sagaOneLogo from "@/assets/saga-one-logo.png";
import { Loader2 } from "lucide-react";

const Login = () => {
  const [ssoLoading, setSsoLoading] = useState(false);
  
  const { signInWithAzure, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSSOLogin = async () => {
    setSsoLoading(true);
    try {
      const { error } = await signInWithAzure();
      
      if (error) {
        toast({
          title: "Erro no login SSO",
          description: error.message || "Não foi possível conectar com Microsoft.",
          variant: "destructive",
        });
        setSsoLoading(false);
      }
    } catch (error) {
      toast({
        title: "Erro no login SSO",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
      setSsoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-login flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <div className="inline-block mb-1 bg-sagaone-login-bg p-0 rounded-lg">
            <img 
              src={sagaOneLogo} 
              alt="SAGA One Logo" 
              className="max-w-md w-full h-auto"
            />
          </div>
        </div>

        <Card className="shadow-card border-0 bg-sagaone-login-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center font-medium">
              Faça seu login
            </CardTitle>
            <p className="text-center text-muted-foreground text-sm">
              Use sua conta corporativa Microsoft para acessar
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SSO Button */}
            <Button 
              type="button"
              className="w-full flex items-center justify-center gap-3 h-14 bg-sagaone-login-button hover:bg-sagaone-login-button/90 text-white text-base font-medium"
              onClick={handleSSOLogin}
              disabled={ssoLoading}
            >
              {ssoLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  Entrar com Microsoft
                </>
              )}
            </Button>

            <div className="text-center pt-4">
              <p className="text-xs text-muted-foreground">
                Ao entrar, você concorda com nossos termos de uso e política de privacidade.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-foreground/60 text-sm mt-6">
          © 2025 SAGA One. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;