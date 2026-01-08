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
const USE_SSO_LOGIN = true;

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const { signIn, signInWithAzure, signInWithMagicLink, user } = useAuth();
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

  // Login via Magic Link (email)
  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Email obrigatório",
        description: "Por favor, informe seu email corporativo.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await signInWithMagicLink(email);

      if (error) {
        toast({
          title: "Erro ao enviar email",
          description: error.message || "Não foi possível enviar o link de acesso.",
          variant: "destructive",
        });
      } else {
        setMagicLinkSent(true);
        toast({
          title: "Email enviado!",
          description: "Verifique sua caixa de entrada para acessar o sistema.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao enviar email",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
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
              <img src={sagaOneLogo} alt="SAGA One Logo" className="max-w-md w-full h-auto" />
            </div>
          </div>

          <Card className="shadow-card border-0 bg-sagaone-login-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center font-medium">Faça seu login</CardTitle>
              <p className="text-center text-muted-foreground text-sm">
                Use sua conta corporativa Microsoft ou email
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                className="w-full flex items-center justify-center gap-3 h-14 bg-sagaone-login-button hover:bg-sagaone-login-button/90 text-white text-base font-medium"
                onClick={handleSSOLogin}
                disabled={loading}
              >
                {loading && !email ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M1 1h10v10H1z" />
                      <path fill="#81bc06" d="M12 1h10v10H12z" />
                      <path fill="#05a6f0" d="M1 12h10v10H1z" />
                      <path fill="#ffba08" d="M12 12h10v10H12z" />
                    </svg>
                    Entrar com Microsoft
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-sagaone-login-card px-2 text-muted-foreground">
                    ou continue com email
                  </span>
                </div>
              </div>

              {magicLinkSent ? (
                <div className="text-center py-4 space-y-2">
                  <div className="text-primary text-lg font-medium">📧 Email enviado!</div>
                  <p className="text-sm text-muted-foreground">
                    Verifique sua caixa de entrada e clique no link para acessar.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setMagicLinkSent(false)}
                  >
                    Enviar novamente
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleMagicLinkLogin} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email corporativo</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full h-12"
                    disabled={loading}
                  >
                    {loading && email ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar link de acesso"
                    )}
                  </Button>
                </form>
              )}

              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground">
                  Ao entrar, você concorda com nossos termos de uso e política de privacidade.
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-foreground/60 text-sm mt-6">© 2025 SAGA One. Todos os direitos reservados.</p>
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
            <img src={sagaOneLogo} alt="SAGA One Logo" className="max-w-md w-full h-auto" />
          </div>
        </div>

        <Card className="shadow-card border-0 bg-sagaone-login-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center font-medium">Faça seu login</CardTitle>
            <p className="text-center text-muted-foreground text-sm">Entre com suas credenciais para acessar</p>
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

        <p className="text-center text-foreground/60 text-sm mt-6">© 2025 SAGA One. Todos os direitos reservados.</p>
      </div>
    </div>
  );
};

export default Login;
