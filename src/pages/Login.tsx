import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import sagaOneLogo from "@/assets/saga-one-logo.png";
import { Loader2 } from "lucide-react";

// TODO: Alterar para true quando Azure SSO estiver configurado
const USE_SSO_LOGIN = false;

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { signIn, signInWithAzure, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Login tradicional com email/senha
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha email e senha.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: "Erro no login",
          description: error.message || "Email ou senha incorretos.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  // Renderiza login SSO quando habilitado
  if (USE_SSO_LOGIN) {
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
              <Button 
                type="button"
                className="w-full flex items-center justify-center gap-3 h-14 bg-sagaone-login-button hover:bg-sagaone-login-button/90 text-white text-base font-medium"
                onClick={handleSSOLogin}
                disabled={loading}
              >
                {loading ? (
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
  }

  // Renderiza login tradicional
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
              Entre com suas credenciais para acessar
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button 
                type="submit"
                className="w-full h-12 bg-sagaone-login-button hover:bg-sagaone-login-button/90 text-white font-medium"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <div className="text-center pt-2">
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
