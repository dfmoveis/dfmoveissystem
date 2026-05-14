import { createFileRoute } from '@tanstack/react-router';
import { useTeam, type MemberStatus } from '@/hooks/use-team';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Mail, User as UserIcon, Loader2, Check, Ban } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const Route = createFileRoute('/_dashboard/admin/equipe')({
  component: EquipePage,
});

const STATUS_META: Record<MemberStatus, { label: string; className: string }> = {
  PENDENTE: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  ATIVO: { label: 'Ativo', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  BLOQUEADO: { label: 'Bloqueado', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
};

function EquipePage() {
  const { data: team, isLoading, updateStatus, deleteMember } = useTeam();
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [memberStats, setMemberStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const handleShowStats = async (member: any) => {
    setSelectedMember(member);
    setIsStatsOpen(true);
    setLoadingStats(true);

    try {
      const { data: projects, error } = await supabase
        .from('projetos')
        .select('*')
        .eq('projetista_id', member.id);

      if (error) throw error;

      const totalVendido = projects
        .filter((p) => p.status_venda === 'VENDEU')
        .reduce((acc, p) => acc + (Number(p.valor_venda) || 0), 0);

      const projetosAtivos = projects.filter((p) => p.status === 'EM_EXECUCAO').length;
      const totalLeads = projects.length;
      const totalVendasCount = projects.filter((p) => p.status_venda === 'VENDEU').length;
      const taxaConversao = totalLeads > 0 ? (totalVendasCount / totalLeads) * 100 : 0;

      setMemberStats({ totalVendido, projetosAtivos, totalLeads, taxaConversao });
    } catch (error) {
      console.error('Erro ao carregar stats do projetista:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Equipe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aprove novos cadastros e gerencie o acesso dos projetistas.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))
        ) : (
          team?.map((member) => {
            const status = (member.status as MemberStatus) || 'PENDENTE';
            const meta = STATUS_META[status];
            return (
              <Card
                key={member.id}
                className="overflow-hidden group hover:border-primary/50 transition-colors"
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <UserIcon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle
                        className="text-lg truncate cursor-pointer hover:text-primary"
                        onClick={() => handleShowStats(member)}
                      >
                        {member.nome}
                      </CardTitle>
                      <Badge className={meta.className} variant="secondary">
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground truncate">
                      <Mail className="mr-1 h-3 w-3" />
                      {member.email}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2 mt-2 pt-4 border-t">
                    {status !== 'ATIVO' && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: member.id, status: 'ATIVO' })}
                      >
                        <Check className="mr-1 h-4 w-4" /> Aprovar Acesso
                      </Button>
                    )}
                    {status !== 'BLOQUEADO' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: member.id, status: 'BLOQUEADO' })}
                      >
                        <Ban className="mr-1 h-4 w-4" /> Bloquear Acesso
                      </Button>
                    )}
                    <div className="ml-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja remover este projetista?')) {
                            deleteMember.mutate(member.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={isStatsOpen} onOpenChange={setIsStatsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Desempenho: {selectedMember?.nome}</DialogTitle>
          </DialogHeader>
          {loadingStats ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando desempenho...</p>
            </div>
          ) : (
            <div className="grid gap-4 py-4 md:grid-cols-2">
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">Total Vendido</div>
                  <div className="text-2xl font-bold mt-1 text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      memberStats?.totalVendido || 0,
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">Projetos Ativos</div>
                  <div className="text-2xl font-bold mt-1 text-blue-600">
                    {memberStats?.projetosAtivos || 0} Projetos
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">Taxa de Conversão</div>
                  <div className="text-2xl font-bold mt-1 text-purple-600">
                    {memberStats?.taxaConversao.toFixed(1) || 0}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Baseado em {memberStats?.totalLeads || 0} leads
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">Acesso</div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">E-mail:</span>
                      <span className="font-medium">{selectedMember?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium">
                        {STATUS_META[(selectedMember?.status as MemberStatus) || 'PENDENTE'].label}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setIsStatsOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!isLoading && team?.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">Nenhum projetista cadastrado ainda.</p>
        </div>
      )}
    </div>
  );
}
