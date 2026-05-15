import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox, Hand, Calendar, DollarSign, FileText } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/demandas')({
  component: DemandasPage,
});

interface DemandaRow {
  id: string;
  nome: string | null;
  fonte: string | null;
  valor_venda: number | null;
  data_inicio: string;
  prazo_termino: string;
  observacoes: string | null;
  created_at: string | null;
  cliente: { id: string; nome: string; telefone: string | null } | null;
}

function DemandasPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: demandas, isLoading } = useQuery({
    queryKey: ['demandas-orfas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projetos')
        .select('id, nome, fonte, valor_venda, data_inicio, prazo_termino, observacoes, created_at, cliente:clientes(id, nome, telefone)')
        .is('projetista_id', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DemandaRow[];
    },
  });

  const assumir = useMutation({
    mutationFn: async (projetoId: string) => {
      if (!user?.id) throw new Error('Sessão inválida.');
      const { error } = await supabase
        .from('projetos')
        .update({ projetista_id: user.id })
        .eq('id', projetoId)
        .is('projetista_id', null); // garante que ninguém pegou antes
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-orfas'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto assumido! Boa sorte.');
      navigate({ to: '/projetista/dashboard' });
    },
    onError: (e: any) =>
      toast.error('Não foi possível assumir: ' + (e?.message ?? 'tente novamente')),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Inbox className="h-6 w-6 text-primary" />
          Fila de Demandas
        </h1>
        <p className="text-muted-foreground">
          Projetos disponíveis para qualquer projetista assumir. Quem clicar primeiro, leva.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-48 bg-muted/20" />
          ))}
        </div>
      ) : demandas && demandas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {demandas.map((d) => (
            <Card key={d.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-amber-400">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    {d.nome || 'Projeto sem nome'}
                  </CardTitle>
                  {d.fonte && (
                    <Badge variant="secondary" className="text-[10px]">
                      {d.fonte}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Cliente: <span className="font-medium text-foreground">{d.cliente?.nome ?? '—'}</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(d.prazo_termino).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {d.valor_venda
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(d.valor_venda))
                      : '—'}
                  </div>
                </div>
                {d.observacoes && (
                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                    <p className="line-clamp-2">{d.observacoes}</p>
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => assumir.mutate(d.id)}
                  disabled={assumir.isPending}
                >
                  <Hand className="mr-2 h-4 w-4" />
                  Assumir Projeto
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma demanda em aberto no momento.</p>
            <p className="text-sm">Novos projetos sem projetista aparecerão aqui.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
