import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthStore } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const { user, role } = useAuthStore.getState();
    if (user) {
      throw redirect({
        to: role === 'ADMIN' ? "/admin/dashboard" : "/projetista/dashboard",
      });
    }
  },
  component: LoginPage,
});

const LOGO_URL = 'https://rmetppilvfrxosvxzhgj.supabase.co/storage/v1/object/public/message-attachments/209c78c7-5f85-4fcb-a4ee-6c7dd71e3717/1778783898939_luewqy_8.png';

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { setUser, setRole } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password);

      if (error) throw error;

      if (users && users.length > 0) {
        const foundUser = users[0];
        setRole(foundUser.role);
        setUser({
          ...foundUser,
          avatar_url: foundUser.avatar_url || undefined,
          created_at: foundUser.created_at || new Date().toISOString()
        });
        toast.success(`Bem-vindo, ${foundUser.nome}!`);

        if (foundUser.role === 'ADMIN') {
          navigate({ to: "/admin/dashboard" });
        } else {
          navigate({ to: "/projetista/dashboard" });
        }
      } else {
        const msg = "E-mail ou senha incorretos.";
        setErrorMessage(msg);
        toast.error(msg);
      }
    } catch (error: any) {
      const msg = "Erro ao conectar com o servidor: " + (error?.message ?? "tente novamente");
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-muted/30 p-4 overflow-hidden">
      <div className="w-full max-w-md space-y-4 flex flex-col items-center">
        <div className="flex flex-col items-center text-center">
          <div className="w-64 h-64 flex items-center justify-center">
            <img 
              src={LOGO_URL} 
              alt="DF Móveis" 
              className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-lighten transition-all duration-300"
            />
          </div>
        </div>

        <Card className="w-full shadow-lg border-none bg-card/50 backdrop-blur-sm">
          <form onSubmit={handleLogin}>
            <CardHeader>
              <CardTitle className="text-xl">Login</CardTitle>
              <CardDescription>
                Informe seu e-mail e senha cadastrados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@dfmoveis.com"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errorMessage) setErrorMessage(null); }}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Button variant="link" className="px-0 font-normal text-xs text-muted-foreground h-auto">
                    Esqueceu a senha?
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (errorMessage) setErrorMessage(null); }}
                    className="bg-background/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Acessar Sistema"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <div className="text-center space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground/80">
            Sistema Administrativo DF
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            &copy; {new Date().getFullYear()} DF Móveis Planejados. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
