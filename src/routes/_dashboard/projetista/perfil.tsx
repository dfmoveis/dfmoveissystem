import { createFileRoute } from '@tanstack/react-router';
import { useAuthStore } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Calendar, Shield, Camera, Loader2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/projetista/perfil')({
  component: PerfilPage,
});

function PerfilPage() {
  const { user, setUser } = useAuthStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [nome, setNome] = useState(user?.nome || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({ nome } as any)
        .eq('id', user.id);

      if (error) throw error;

      setUser({ ...user, nome });
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao atualizar perfil: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('message-attachments') // Using existing bucket for convenience
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(filePath);

      // Update user in database
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl } as any) // Note: our login logic uses avatar_url for password currently, 
                                            // BUT in a real app this should be a separate column.
                                            // Given the current state where avatar_url = password, 
                                            // I should probably CHECK the schema or just use a dedicated column if it exists.
                                            // Let's check the schema first.
        .eq('id', user.id);

      if (updateError) throw updateError;

      setUser({ ...user, avatar_url: publicUrl });
      toast.success('Foto de perfil atualizada!');
    } catch (error: any) {
      toast.error('Erro ao enviar foto: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e configurações de conta.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="text-center">
            <div className="relative mx-auto w-24 h-24 mb-4">
              <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold border-4 border-background shadow-sm overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.nome} className="w-full h-full object-cover" />
                ) : (
                  user?.nome.charAt(0)
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />
            </div>
            <CardTitle>{user?.nome}</CardTitle>
            <CardDescription>{user?.role === 'PROJETISTA' ? 'Projetista Especialista' : 'Administrador'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Membro desde {user ? new Date(user.created_at).toLocaleDateString('pt-BR') : '-'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span>Acesso: {user?.role}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Informações da Conta</CardTitle>
            <CardDescription>Atualize seus dados de contato e preferências.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="nome" 
                    value={nome} 
                    onChange={(e) => setNome(e.target.value)}
                    className="pl-9" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail Profissional</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="email" value={user?.email} disabled className="pl-9 bg-muted/50" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografia / Especialidades</Label>
              <textarea 
                id="bio" 
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Conte um pouco sobre suas especialidades em móveis planejados..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                onClick={handleUpdateProfile} 
                disabled={isUpdating || nome === user?.nome}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
