import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import sagaOneLogo from "@/assets/saga-one-logo.png";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LoginTerceiros = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    supabase.rpc("password_login_enabled").then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error("password_login_enabled error:", error);
        setEnabled(false);
        return;
      }
      setEnabled(data === true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        // mensagem genérica (evita enumeration)
        toast({
          title: "Não foi possível entrar",
          description: "Verifique seu email e senha e tente novamente.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro inesperado",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-login dark:bg-gradient-to-br dark:from-[hsl(220,20%,18%)] dark:via-[hsl(220,15%,28%)] dark:to-[hsl(220,20%,18%)] flex items-center justify-center p-3 sm:p-4 overflow-x-hidden">
      <div className="w-full max-w-md px-1">
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-block mb-1 bg-white dark:bg-white/95 p-4 sm:p-6 rounded-2xl shadow-lg max-w-[70vw] sm:max-w-xs">
            <img src={sagaOneLogo} alt="SAGA One Logo" className="w-full h-auto rounded-xl" />
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-sagaone-login-card dark:bg-[hsl(220,20%,14%)] dark:border dark:border-white/10 dark:shadow-2xl mx-auto">
          <CardHeader className="space-y-1 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl text-center font-semibold dark:text-white">
              Login para terceiros
            </CardTitle>
            <p className="text-center text-muted-foreground text-xs sm:text-sm dark:text-white/60">
              Use o email e senha que você recebeu da sua loja
            </p>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            {enabled === false ? (
              <div className="text-center py-6 text-sm text-muted-foreground dark:text-white/60">
                Acesso por senha indisponível no momento. Fale com sua loja.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="dark:text-white/80">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@one.sagadatadriven.com.br"
                    disabled={loading || enabled === null}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="dark:text-white/80">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || enabled === null}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loading || enabled === null}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                </Button>
              </form>
            )}

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white"
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar para login Microsoft
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-foreground/60 dark:text-white/40 text-xs sm:text-sm mt-4 sm:mt-6">
          © 2026 SAGA One. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default LoginTerceiros;