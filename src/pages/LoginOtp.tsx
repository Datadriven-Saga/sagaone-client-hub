import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MailKey, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import sagaOneLogo from "@/assets/saga-one-logo.png";

const REDIRECT_KEY = "auth_redirect_path";
const GENERIC_MESSAGE = "Se o email estiver cadastrado e autorizado, você receberá um código.";

const LoginOtp = () => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { requestLoginOtp, verifyLoginOtp, user } = useAuth();
  const navigate = useNavigate();

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  useEffect(() => {
    if (!user) return;
    const savedPath = localStorage.getItem(REDIRECT_KEY);
    if (savedPath && savedPath !== "/" && savedPath !== "/login") {
      localStorage.removeItem(REDIRECT_KEY);
      navigate(savedPath, { replace: true });
    } else {
      localStorage.removeItem(REDIRECT_KEY);
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    if (!normalizedEmail) return;
    setLoading(true);
    try {
      const { error, message } = await requestLoginOtp(normalizedEmail);
      if (error) {
        toast({
          title: "Não foi possível enviar agora",
          description: "Aguarde alguns minutos e tente novamente.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Código solicitado",
          description: message || GENERIC_MESSAGE,
        });
        setStep("code");
        setCooldown(60);
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

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendCode();
  };

  const handleCodeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const { error } = await verifyLoginOtp(normalizedEmail, code);
      if (error) {
        toast({
          title: "Código inválido",
          description: "Verifique o código enviado por email e tente novamente.",
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
            <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailKey className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl sm:text-2xl text-center font-semibold dark:text-white">
              Entrar com código
            </CardTitle>
            <p className="text-center text-muted-foreground text-xs sm:text-sm dark:text-white/60">
              Use o email cadastrado para receber um código de acesso
            </p>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="dark:text-white/80">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu.email@gruposaga.com.br"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading || !normalizedEmail}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar código"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-2 text-center">
                  <Label className="dark:text-white/80">Código de 6 dígitos</Label>
                  <InputOTP maxLength={6} value={code} onChange={setCode} disabled={loading} containerClassName="justify-center">
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-xs text-muted-foreground dark:text-white/60">
                    Enviado para {normalizedEmail}
                  </p>
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading || code.length !== 6}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2"
                  onClick={sendCode}
                  disabled={loading || cooldown > 0}
                >
                  <RotateCcw className="h-4 w-4" />
                  {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
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

export default LoginOtp;