import { createFileRoute } from '@tanstack/react-router';
import { useTeam } from '@/hooks/use-team';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Mail, User as UserIcon, Key, Copy, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute('/_dashboard/admin/equipe')({
  component: EquipePage,
});

function EquipePage() {
  const { data: team, isLoading, addMember, deleteMember } = useTeam();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [newMember, setNewMember] = useState({ nome: '', email: '' });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);
  
  // States for stats
  const [memberStats, setMemberStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const generateRandomPassword = () => {
    const numbers = Math.floor(1000 + Math.random() * 9000);
    return `DF${numbers}`;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = generateRandomPassword();
    console.log('[ADD MEMBER] Tentando inserir:', { ...newMember, password });
    try {
      const result = await addMember.mutateAsync({
        ...newMember,
        avatar_url: password,
        password,
      });
      console.log('[ADD MEMBER] Sucesso:', result);
      setGeneratedPassword(password);
      setNewMember({ nome: '', email: '' });
    } catch (err) {
      console.error('[ADD MEMBER] Erro:', err);
    }
  };

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
        .filter(p => p.status_venda === 'VENDEU')
        .reduce((acc, p) => acc + (Number(p.valor_venda) || 0), 0);
      
      const projetosAtivos = projects.filter(p => p.status === 'EM_EXECUCAO').length;
      const totalLeads = projects.length;
      const totalVendasCount = projects.filter(p => p.status_venda === 'VENDEU').length;
      const taxaConversao = totalLeads > 0 ? (totalVendasCount / totalLeads) * 100 : 0;
      
      setMemberStats({
        totalVendido,
        projetosAtivos,
        totalLeads,
        taxaConversao
      });
    } catch (error) {
      console.error("Erro ao carregar stats do projetista:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Equipe</h1>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Projetista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Projetista</DialogTitle>
            </DialogHeader>
            {generatedPassword ? (
              <div className="space-y-6 py-6 text-center">
                <div className="flex flex-col items-center space-y-2">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <Check className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-lg">Projetista Adicionado!</h3>
                  <p className="text-sm text-muted-foreground px-4">
                    Copie a senha abaixo e envie para o novo integrante da equipe.
                  </p>
                </div>
                
                <div className="bg-muted p-4 rounded-lg flex items-center justify-between group relative">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono font-bold text-xl tracking-widest">{generatedPassword}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={copyToClipboard}
                    className="shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => {
                    setGeneratedPassword('');
                    setIsOpen(false);
                  }}
                >
                  Concluir
                </Button>
              </div>
            ) : (
              <form onSubmit={handleAdd} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input 
                    id="nome" 
                    value={newMember.nome}
                    onChange={e => setNewMember(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Carlos Designer" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail Corporativo</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={newMember.email}
                    onChange={e => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="carlos@dfmoveis.com" 
                    required 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={addMember.isPending}>
                  {addMember.isPending ? 'Salvando...' : 'Adicionar e Gerar Senha'}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))
        ) : team?.map((member) => (
          <Card 
            key={member.id} 
            className="overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => handleShowStats(member)}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UserIcon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">{member.nome}</CardTitle>
                <div className="flex items-center text-sm text-muted-foreground truncate">
                  <Mail className="mr-1 h-3 w-3" />
                  {member.email}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mt-2 pt-4 border-t">
                <div className="text-sm font-medium">
                  Senha: <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{(member as any).password || 'N/A'}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Tem certeza que deseja remover este projetista?')) {
                      deleteMember.mutate(member.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
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
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(memberStats?.totalVendido || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Acumulado histórico</div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">Projetos Ativos</div>
                  <div className="text-2xl font-bold mt-1 text-blue-600">{memberStats?.projetosAtivos || 0} Projetos</div>
                  <div className="text-xs text-muted-foreground mt-1">Status em execução</div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">Taxa de Conversão</div>
                  <div className="text-2xl font-bold mt-1 text-purple-600">{memberStats?.taxaConversao.toFixed(1) || 0}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Baseado em {memberStats?.totalLeads || 0} leads</div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">Informações de Acesso</div>
                  <div className="mt-2 space-y-1">
                    <div className="text-xs flex justify-between">
                      <span className="text-muted-foreground">E-mail:</span>
                      <span className="font-medium">{selectedMember?.email}</span>
                    </div>
                    <div className="text-xs flex justify-between">
                      <span className="text-muted-foreground">Senha Atual:</span>
                      <span className="font-mono font-bold text-primary">{selectedMember?.password}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setIsStatsOpen(false)}>Fechar</Button>
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

