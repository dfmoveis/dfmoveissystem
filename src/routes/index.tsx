import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

const LOGO_URL = 'https://rmetppilvfrxosvxzhgj.supabase.co/storage/v1/object/public/message-attachments/209c78c7-5f85-4fcb-a4ee-6c7dd71e3717/1778783898939_luewqy_8.png';

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setUser, setRole } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Mock login logic
    setTimeout(() => {
      if (email === "admin@dfmoveis.com" || email === "rangelmaker@gmail.com") {
        setRole("ADMIN");
        setUser({
          id: '00000000-0000-0000-0000-000000000000',
          nome: 'Admin DF',
          email: email,
          role: 'ADMIN',
          created_at: new Date().toISOString(),
        });
        toast.success("Login realizado com sucesso!");
        navigate({ to: "/admin/dashboard" });
      } else {
        setRole("PROJETISTA");
        setUser({
          id: '11111111-1111-1111-1111-111111111111',
          nome: 'Projetista DF',
          email: email,
          role: 'PROJETISTA',
          created_at: new Date().toISOString(),
        });
        toast.success("Bem-vindo ao sistema!");
        navigate({ to: "/projetista/dashboard" });
      }
      setIsLoading(false);
    }, 1000);
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
                  onChange={(e) => setEmail(e.target.value)}
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
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/50"
                />
              </div>
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
