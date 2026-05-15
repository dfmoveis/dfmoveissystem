import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Briefcase, Calendar, CheckCircle2, DollarSign, Lock } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/projetista/meus-projetos')({
  component: MeusProjetosPage,
});

const STAGES = ['Início', 'Meio', 'Render', 'Fim'] as const;
type Stage = typeof STAGES[number];

const STAGE_COLORS: Record<string, string> = {
  'Início': 'bg-slate-100 text-slate-700 border-slate-200',
  'Meio': 'bg-blue-100 text-blue-700 border-blue-200',
  'Render': 'bg-purple-100 text-purple-700 border-purple-200',
  'Fim': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

interface ProjetoRow {
  id: string;
  nome: string | null;
  status: string;
  status_venda: string;
  estagio_andamento: string | null;
  valor_venda: number | null;
  data_inicio: string;
  prazo_termino: string;
  cliente: { id: string; nome: string; telefone: string | null } | null;
}

function MeusProjetosPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [closingProject, setClosingProject] = useState<ProjetoRow | null>(null);
  const [valorVenda, setValorVenda] = useState('');

  const { data: projetos, isLoading } = useQuery({
    queryKey: ['meus-projetos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('projetos')
        .select('id, nome, status, status_venda, estagio_andamento, valor_venda, data_inicio, prazo_termino, cliente:clientes(id, nome, telefone)')
        .eq('projetista_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoRow[];
    },
    enabled: !!user?.id,
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, estagio }: { id: string; estagio: Stage }) => {
      const { error } = await supabase
        .from('projetos')
        .update({ estagio_andamento: estagio })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meus-projetos'] });
      toast.success('Estágio atualizado!');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message ?? 'tente novamente')),
  });

  const concluir = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number | null }) => {
      const hasVenda = valor !== null && !Number.isNaN(valor) && valor > 0;
      const update = hasVenda
        ? { status: 'FINALIZADO' as const, estagio_andamento: 'Fim', valor_venda: valor!, status_venda: 'VENDEU' as const }
        : { status: 'FINALIZADO' as const, estagio_andamento: 'Fim' };
      const { error } = await supabase.from('projetos').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meus-projetos'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto finalizado com sucesso!');
      setClosingProject(null);
      setValorVenda('');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message ?? 'tente novamente')),
  });

  const ativos = (projetos ?? []).filter(p => p.status !== 'FINALIZADO');
  const concluidos = (projetos ?? []).filter(p => p.status === 'FINALIZADO');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          Meus Projetos
        </h1>
        <p className="text-muted-foreground">
          Acompanhe e atualize o estágio de cada projeto.
        </p>
      </div>

      <Tabs defaultValue="ativos">
        <TabsList>
          <TabsTrigger value="ativos">
            Em Andamento {ativos.length > 0 && `(${ativos.length})`}
          </TabsTrigger>
          <TabsTrigger value="concluidos">
            Concluídos {concluidos.length > 0 && `(${concluidos.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse h-56 bg-muted/20" />
              ))}
            </div>
          ) : ativos.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum projeto em andamento.</p>
                <p className="text-sm">Assuma novas demandas na aba "Demandas".</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ativos.map((p) => (
                <ProjetoCard
                  key={p.id}
                  projeto={p}
                  onStageChange={(s) => updateStage.mutate({ id: p.id, estagio: s })}
                  onClose={() => setClosingProject(p)}
                  isUpdating={updateStage.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="concluidos" className="mt-4">
          {concluidos.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum projeto finalizado ainda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {concluidos.map((p) => (
                <Card key={p.id} className="border-l-4 border-l-emerald-400 opacity-90">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.nome || 'Projeto'}</CardTitle>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        FINALIZADO
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{p.cliente?.nome ?? '—'}</p>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {p.valor_venda && (
                      <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.valor_venda))}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Prazo: {new Date(p.prazo_termino).toLocaleDateString('pt-BR')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!closingProject} onOpenChange={(o) => { if (!o) { setClosingProject(null); setValorVenda(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Projeto</DialogTitle>
            <DialogDescription>
              Você está finalizando <strong>{closingProject?.nome || 'este projeto'}</strong>.
              Informe o valor de venda (opcional) — se preenchido, marcamos como VENDEU.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="valor">Valor da venda (opcional)</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 15000.00"
              value={valorVenda}
              onChange={(e) => setValorVenda(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setClosingProject(null); setValorVenda(''); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!closingProject) return;
                const v = valorVenda.trim() === '' ? null : Number(valorVenda);
                concluir.mutate({ id: closingProject.id, valor: v });
              }}
              disabled={concluir.isPending}
            >
              <Lock className="mr-2 h-4 w-4" />
              Finalizar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjetoCard({
  projeto, onStageChange, onClose, isUpdating,
}: {
  projeto: ProjetoRow;
  onStageChange: (s: Stage) => void;
  onClose: () => void;
  isUpdating: boolean;
}) {
  const stage = (projeto.estagio_andamento as Stage) || 'Início';
  return (
    <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-primary/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{projeto.nome || 'Projeto sem nome'}</CardTitle>
          <Badge variant="outline" className={STAGE_COLORS[stage]}>{stage}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Cliente: <span className="font-medium text-foreground">{projeto.cliente?.nome ?? '—'}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Prazo: {new Date(projeto.prazo_termino).toLocaleDateString('pt-BR')}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Estágio</Label>
          <Select value={stage} onValueChange={(v) => onStageChange(v as Stage)} disabled={isUpdating}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-1">
          {STAGES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === stage ? 'default' : 'outline'}
              className="h-7 px-2 text-xs flex-1"
              onClick={() => onStageChange(s)}
              disabled={isUpdating || s === stage}
            >
              {s}
            </Button>
          ))}
        </div>

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={onClose}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Concluir / Fechar Projeto
        </Button>
      </CardContent>
    </Card>
  );
}
