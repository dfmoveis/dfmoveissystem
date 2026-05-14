import { createFileRoute } from '@tanstack/react-router';
import { useAuthStore } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_dashboard/projetista/clientes')({
  component: ProjetistaClientesPage,
});

interface ClienteRow {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  created_at: string;
  projetista_id: string | null;
  projetista: { id: string; nome: string } | null;
}

function ProjetistaClientesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);

  const [clientForm, setClientForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
  });

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes-global'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*, projetista:users!clientes_projetista_id_fkey(id, nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as ClienteRow[];
    },
  });

  const createClient = useMutation({
    mutationFn: async (data: typeof clientForm) => {
      if (!user?.id) throw new Error('Usuário não autenticado.');
      const { error } = await supabase.from('clientes').insert([
        {
          ...data,
          projetista_id: user.id,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-global'] });
      setIsClientDialogOpen(false);
      setClientForm({ nome: '', email: '', telefone: '', endereco: '' });
      toast.success('Cliente cadastrado com sucesso!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Carteira global de clientes da empresa. Todos podem visualizar.
          </p>
        </div>

        <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  value={clientForm.nome}
                  onChange={(e) => setClientForm({ ...clientForm, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tel">Telefone</Label>
                  <Input
                    id="tel"
                    value={clientForm.telefone}
                    onChange={(e) => setClientForm({ ...clientForm, telefone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end">Endereço</Label>
                <Input
                  id="end"
                  value={clientForm.endereco}
                  onChange={(e) => setClientForm({ ...clientForm, endereco: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (!clientForm.nome.trim()) {
                    toast.error('Informe o nome do cliente.');
                    return;
                  }
                  createClient.mutate(clientForm);
                }}
                disabled={createClient.isPending}
              >
                Salvar Cliente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos os Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cadastro</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Atendimento Atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={5} className="h-12 bg-muted/20" />
                  </TableRow>
                ))
              ) : clientes && clientes.length > 0 ? (
                clientes.map((c) => {
                  const isMine = c.projetista?.id && c.projetista.id === user?.id;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span>{c.email || '-'}</span>
                          <span>{c.telefone || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {c.endereco || '-'}
                      </TableCell>
                      <TableCell>
                        {c.projetista ? (
                          <Badge
                            className={cn(
                              'gap-1',
                              isMine
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100',
                            )}
                          >
                            {isMine && <Star className="h-3 w-3 fill-current" />}
                            {isMine ? 'Meu Cliente' : c.projetista.nome}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Sem responsável
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
