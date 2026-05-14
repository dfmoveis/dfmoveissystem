import { createFileRoute } from '@tanstack/react-router';
import { useProjects } from '@/hooks/use-projects';
import { useAuthStore } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from 'react';
import { SaleStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus, FileText, Phone, Mail as MailIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/projetista/clientes')({
  component: ProjetistaClientesPage,
});

function ProjetistaClientesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [statusVenda, setStatusVenda] = useState<string>('all');
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [clientForm, setClientForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    endereco: ''
  });

  const [projectForm, setProjectForm] = useState({
    status: 'PRONTO',
    prazo_termino: '',
    valor_venda: '',
    observacoes: ''
  });

  const { data: projects, isLoading } = useProjects({
    projetista_id: user?.id,
    status_venda: statusVenda === 'all' ? undefined : statusVenda as SaleStatus
  });

  const createClient = useMutation({
    mutationFn: async (data: typeof clientForm) => {
      const { error } = await supabase.from('clientes').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsClientDialogOpen(false);
      setClientForm({ nome: '', email: '', telefone: '', endereco: '' });
      toast.success('Cliente cadastrado com sucesso!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message)
  });

  const createProject = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('projetos').insert([{
        cliente_id: selectedClientId,
        projetista_id: user?.id,
        status: data.status,
        data_inicio: new Date().toISOString(),
        prazo_termino: new Date(data.prazo_termino).toISOString(),
        status_venda: 'EM_NEGOCIACAO',
        valor_venda: parseFloat(data.valor_venda) || 0,
        observacoes: data.observacoes
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsProjectDialogOpen(false);
      setProjectForm({ status: 'PRONTO', prazo_termino: '', valor_venda: '', observacoes: '' });
      toast.success('Projeto criado com sucesso!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message)
  });

  const getStatusBadge = (status: SaleStatus) => {
    switch (status) {
      case 'VENDEU':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Vendeu</Badge>;
      case 'EM_NEGOCIACAO':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Em Negociação</Badge>;
      case 'NAO_VENDEU':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Não Vendeu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Clientes e Projetos</h1>
          <p className="text-muted-foreground">Gerencie sua carteira de clientes e o status das negociações.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={statusVenda} onValueChange={setStatusVenda}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status de Venda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="EM_NEGOCIACAO">Em Negociação</SelectItem>
              <SelectItem value="VENDEU">Vendeu</SelectItem>
              <SelectItem value="NAO_VENDEU">Não Vendeu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Atendimento</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data de Início</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status Venda</TableHead>
                <TableHead>Status Projeto</TableHead>
                <TableHead className="text-right">Valor da Venda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={6} className="h-12 bg-muted/20" />
                  </TableRow>
                ))
              ) : projects?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{p.cliente?.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span>{p.cliente?.email}</span>
                      <span>{p.cliente?.telefone}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(p.status_venda)}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      p.status === 'EM_EXECUCAO' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      p.status === 'ATRASADO' ? 'bg-red-50 text-red-700 border-red-100' :
                      p.status === 'FINALIZADO' ? 'bg-green-50 text-green-700 border-green-100' :
                      'bg-gray-50 text-gray-700 border-gray-100'
                    }`}>
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {p.valor_venda 
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.valor_venda))
                      : '-'
                    }
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && projects?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Você ainda não possui projetos vinculados.
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
