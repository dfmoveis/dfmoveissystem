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
import { UserPlus, Star, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const FONTES = [
  { value: 'ARQUITETO', label: 'Arquiteto' },
  { value: 'VENDA_DIRETA', label: 'Venda Direta' },
  { value: 'INDICACAO', label: 'Indicação' },
];

function ProjetistaClientesPage() {
  const { user, role } = useAuthStore();
  const isAdmin = role === 'ADMIN';
  const queryClient = useQueryClient();

  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [pendingClient, setPendingClient] = useState<{ id: string; nome: string } | null>(null);

  const [clientForm, setClientForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    endereco: '',
  });

  const [projectForm, setProjectForm] = useState({
    fonte: '',
    valor_venda: '',
    prazo_termino: '',
    observacoes: '',
  });

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes-global'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, telefone, endereco, created_at, projetista_id, projetista:projetista_id(id, nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClienteRow[];
    },
  });

  const createClient = useMutation({
    mutationFn: async (data: typeof clientForm) => {
      console.log('[clientes] inserting client', data);
      if (!user?.id) throw new Error('Usuário não autenticado.');
      const { data: inserted, error } = await supabase
        .from('clientes')
        .insert([
          {
            nome: data.nome.trim(),
            telefone: data.telefone.trim(),
            email: data.email.trim() || null,
            endereco: data.endereco.trim() || null,
            projetista_id: user.id,
          },
        ])
        .select('id, nome')
        .single();
      console.log('[clientes] insert result', { inserted, error });
      if (error) throw error;
      return inserted as { id: string; nome: string };
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['clientes-global'] });
      setClientForm({ nome: '', telefone: '', email: '', endereco: '' });
      setIsClientDialogOpen(false);
      toast.success('Cliente cadastrado! Agora preencha os dados do projeto.');
      setPendingClient(created);
      setIsProjectDialogOpen(true);
    },
    onError: (e: any) => {
      console.error('[clientes] insert error', e);
      toast.error('Erro ao salvar cliente: ' + (e?.message ?? e));
    },
  });

  const createProject = useMutation({
    mutationFn: async (data: typeof projectForm) => {
      if (!user?.id || !pendingClient) throw new Error('Cliente não selecionado.');
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('projetos').insert([
        {
          cliente_id: pendingClient.id,
          projetista_id: user.id,
          status: 'PRONTO',
          status_venda: 'EM_NEGOCIACAO',
          data_inicio: today,
          prazo_termino: data.prazo_termino || today,
          valor_venda: data.valor_venda ? parseFloat(data.valor_venda) : null,
          observacoes: data.observacoes || null,
          fonte: data.fonte || null,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto criado com sucesso!');
      setProjectForm({ fonte: '', valor_venda: '', prazo_termino: '', observacoes: '' });
      setPendingClient(null);
      setIsProjectDialogOpen(false);
    },
    onError: (e: any) => toast.error('Erro ao criar projeto: ' + (e?.message ?? e)),
  });

  const handleSaveClient = () => {
    console.log('[clientes] handleSaveClient clicked', { clientForm, user });
    if (!clientForm.nome.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    if (!clientForm.telefone.trim()) {
      toast.error('Informe o WhatsApp do cliente.');
      return;
    }
    if (!user?.id) {
      toast.error('Sessão inválida. Faça login novamente.');
      return;
    }
    createClient.mutate(clientForm);
  };

  const handleSaveProject = () => {
    if (!projectForm.fonte) {
      toast.error('Selecione a fonte do projeto.');
      return;
    }
    createProject.mutate(projectForm);
  };

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
              <DialogDescription>
                Nome e WhatsApp são obrigatórios. Após salvar, você cadastra o projeto.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">
                  Nome Completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome"
                  value={clientForm.nome}
                  onChange={(e) => setClientForm({ ...clientForm, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tel">
                    WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tel"
                    placeholder="(00) 00000-0000"
                    value={clientForm.telefone}
                    onChange={(e) => setClientForm({ ...clientForm, telefone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
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
              <Button onClick={handleSaveClient} disabled={createClient.isPending}>
                {createClient.isPending ? 'Salvando...' : 'Salvar e continuar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project dialog (opens after saving client OR via row action) */}
      <Dialog
        open={isProjectDialogOpen}
        onOpenChange={(open) => {
          setIsProjectDialogOpen(open);
          if (!open) setPendingClient(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados do Projeto</DialogTitle>
            <DialogDescription>
              {pendingClient ? `Cliente: ${pendingClient.nome}` : 'Selecione um cliente.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>
                Fonte <span className="text-destructive">*</span>
              </Label>
              <Select
                value={projectForm.fonte}
                onValueChange={(v) => setProjectForm({ ...projectForm, fonte: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Como chegou esse cliente?" />
                </SelectTrigger>
                <SelectContent>
                  {FONTES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="valor">Valor estimado (R$)</Label>
                <Input
                  id="valor"
                  type="number"
                  value={projectForm.valor_venda}
                  onChange={(e) => setProjectForm({ ...projectForm, valor_venda: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prazo">Prazo de término</Label>
                <Input
                  id="prazo"
                  type="date"
                  value={projectForm.prazo_termino}
                  onChange={(e) => setProjectForm({ ...projectForm, prazo_termino: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                rows={3}
                value={projectForm.observacoes}
                onChange={(e) => setProjectForm({ ...projectForm, observacoes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveProject} disabled={createProject.isPending}>
              {createProject.isPending ? 'Salvando...' : 'Criar Projeto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={6} className="h-12 bg-muted/20" />
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
                          <span>{c.telefone || '-'}</span>
                          <span>{c.email || '-'}</span>
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
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPendingClient({ id: c.id, nome: c.nome });
                            setIsProjectDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Novo Projeto
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
