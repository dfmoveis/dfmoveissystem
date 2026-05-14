import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Clock, User, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const Route = createFileRoute('/_dashboard/agenda')({
  component: AgendaPage,
});

function AgendaPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
    tipo: 'REUNIAO',
    cliente_id: ''
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ['agendamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, criado_por:users(nome), cliente:clientes(nome)')
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes-agenda'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('id, nome').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const createEvent = useMutation({
    mutationFn: async (event: any) => {
      const data_inicio = new Date(`${event.data}T${event.hora_inicio}`).toISOString();
      const data_fim = new Date(`${event.data}T${event.hora_fim}`).toISOString();
      
      const { error } = await supabase.from('agendamentos').insert([{
        titulo: event.titulo,
        descricao: event.descricao,
        data_inicio,
        data_fim,
        tipo: event.tipo,
        cliente_id: event.cliente_id || null,
        criado_por: user?.id
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
      setIsDialogOpen(false);
      setFormData({ titulo: '', descricao: '', data: '', hora_inicio: '', hora_fim: '', tipo: 'REUNIAO', cliente_id: '' });
      toast.success('Agendamento realizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao agendar: ' + error.message);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agenda de Atendimentos</h1>
          <p className="text-muted-foreground text-sm">Visualize e gerencie as reuniões e compromissos de toda a equipe.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Agendar Compromisso</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})} placeholder="Ex: Reunião de Briefing" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="data">Data</Label>
                  <Input id="data" type="date" value={formData.data} onChange={(e) => setFormData({...formData, data: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({...formData, tipo: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REUNIAO">Reunião</SelectItem>
                      <SelectItem value="ATENDIMENTO">Atendimento</SelectItem>
                      <SelectItem value="VISITA">Visita Técnica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="inicio">Hora Início</Label>
                  <Input id="inicio" type="time" value={formData.hora_inicio} onChange={(e) => setFormData({...formData, hora_inicio: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fim">Hora Fim</Label>
                  <Input id="fim" type="time" value={formData.hora_fim} onChange={(e) => setFormData({...formData, hora_fim: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cliente">Cliente (Opcional)</Label>
                <Select value={formData.cliente_id} onValueChange={(v) => setFormData({...formData, cliente_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createEvent.mutate(formData)} disabled={createEvent.isPending}>
                Confirmar Agendamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : events?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">Nenhum agendamento para exibir.</p>
              <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Agendamento" para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {events?.map((event: any) => (
              <Card key={event.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-primary/5 border border-primary/10">
                      <span className="text-[10px] uppercase font-bold text-primary opacity-70">
                        {new Date(event.data_inicio).toLocaleDateString('pt-BR', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold text-primary leading-tight">
                        {new Date(event.data_inicio).getDate()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground leading-none">{event.titulo}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(event.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - 
                          {new Date(event.data_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {event.criado_por?.nome}
                        </span>
                        {event.cliente && (
                          <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                            Cliente: {event.cliente.nome}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                    event.tipo === 'REUNIAO' ? 'bg-blue-100 text-blue-700' :
                    event.tipo === 'VISITA' ? 'bg-purple-100 text-purple-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {event.tipo}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
