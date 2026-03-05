import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import sagaOneLogo from "@/assets/saga-one-logo.png";
import { Loader2 } from "lucide-react";

// TODO: Alterar para true quando Azure SSO estiver configurado
const USE_SSO_LOGIN = true;

const Login = () => {
  const [loading, setLoading] = useState(false);

  const REDIRECT_KEY = 'auth_redirect_path';
  const { signInWithAzure, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const savedPath = localStorage.getItem(REDIRECT_KEY);
      if (savedPath && savedPath !== '/' && savedPath !== '/login') {
        localStorage.removeItem(REDIRECT_KEY);
        navigate(savedPath, { replace: true });
      } else {
        localStorage.removeItem(REDIRECT_KEY);
        navigate("/", { replace: true });
      }
    }
  }, [user, navigate]);

  // Login via SSO Microsoft
  const handleSSOLogin = async () => {
    setLoading(true);
    try {
      const { error } = await signInWithAzure();

      if (error) {
        toast({
          title: "Erro no login SSO",
          description: error.message || "Não foi possível conectar com Microsoft.",
          variant: "destructive",
        });
        setLoading(false);
      }
    } catch (error) {
      toast({
        title: "Erro no login SSO",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Renderiza login SSO - apenas Microsoft
  if (USE_SSO_LOGIN) {
    return (
      <div className="min-h-screen bg-gradient-login dark:bg-gradient-to-br dark:from-[hsl(220,20%,18%)] dark:via-[hsl(220,15%,28%)] dark:to-[hsl(220,20%,18%)] flex items-center justify-center p-3 sm:p-4 overflow-x-hidden">
        <div className="w-full max-w-md px-1">
          <div className="text-center mb-4 sm:mb-6">
            <div className="inline-block mb-1 bg-white dark:bg-white/95 p-4 sm:p-6 rounded-2xl shadow-lg max-w-[70vw] sm:max-w-xs">
              <img src={sagaOneLogo} alt="SAGA One Logo" className="w-full h-auto rounded-xl" />
            </div>
          </div>

          <Card className="shadow-xl border-0 bg-sagaone-login-card dark:bg-[hsl(220,20%,14%)] dark:border dark:border-white/10 dark:shadow-2xl mx-auto">
            <CardHeader className="space-y-1 px-4 sm:px-6">
              <CardTitle className="text-xl sm:text-2xl text-center font-semibold dark:text-white">Faça seu login</CardTitle>
              <p className="text-center text-muted-foreground text-xs sm:text-sm dark:text-white/60">
                Use sua conta corporativa Microsoft
              </p>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              <Button
                type="button"
                className="w-full flex items-center justify-center gap-2 sm:gap-3 h-11 sm:h-14 bg-sagaone-login-button hover:bg-sagaone-login-button/90 text-white dark:bg-[hsl(190,90%,50%)] dark:hover:bg-[hsl(190,90%,45%)] dark:text-[hsl(220,20%,10%)] text-sm sm:text-base font-medium rounded-lg"
                onClick={handleSSOLogin}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 sm:w-[21px] sm:h-[21px]">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                    </svg>
                    Entrar com Microsoft
                  </>
                )}
              </Button>

              <div className="text-center pt-1 sm:pt-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground dark:text-white/50">
                  Ao entrar, você concorda com nossos termos de uso e política de privacidade.
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-foreground/60 dark:text-white/40 text-xs sm:text-sm mt-4 sm:mt-6">© 2025 SAGA One. Todos os direitos reservados.</p>
        </div>
      </div>
    );
  }

  // Fallback - não deve chegar aqui com USE_SSO_LOGIN = true
  return null;
};

export default Login;
