import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Clock, User, Plus, Search, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { useState, useMemo } from 'react';
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
import { Calendar } from '@/components/ui/calendar';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { format, startOfDay, isSameDay, parseISO, areIntervalsOverlapping } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Route = createFileRoute('/_dashboard/agenda')({
  component: AgendaPage,
});

const TIPO_LABELS: Record<string, string> = {
  'REUNIAO': 'Reunião com Cliente',
  'ATENDIMENTO': 'Atendimento',
  'VISITA': 'Tirar Medida'
};

const TIPO_COLORS: Record<string, string> = {
  'REUNIAO': 'bg-red-500 text-white',
  'ATENDIMENTO': 'bg-blue-500 text-white',
  'VISITA': 'bg-green-500 text-white'
};

const TIPO_BADGE_COLORS: Record<string, string> = {
  'REUNIAO': 'bg-red-100 text-red-700',
  'ATENDIMENTO': 'bg-blue-100 text-blue-700',
  'VISITA': 'bg-green-100 text-green-700'
};

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

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

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

  const filteredEvents = useMemo(() => {
    if (!events || !selectedDate) return [];
    return events.filter(e => isSameDay(parseISO(e.data_inicio), selectedDate));
  }, [events, selectedDate]);

  const dayTooltips = useMemo(() => {
    const tooltips: Record<string, React.ReactNode> = {};
    if (!events) return tooltips;

    const grouped = events.reduce((acc: any, event) => {
      const dateKey = event.data_inicio.split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(event);
      return acc;
    }, {});

    Object.keys(grouped).forEach(dateKey => {
      tooltips[dateKey] = (
        <div className="space-y-2">
          {grouped[dateKey].slice(0, 3).map((e: any) => (
            <div key={e.id} className="text-[10px] border-b border-border last:border-0 pb-1">
              <p className="font-bold truncate">{e.titulo}</p>
              <p className="text-muted-foreground">
                {format(parseISO(e.data_inicio), "HH:mm")} - {e.cliente?.nome || 'Sem cliente'}
              </p>
            </div>
          ))}
          {grouped[dateKey].length > 3 && (
            <p className="text-[9px] text-center font-bold">+ {grouped[dateKey].length - 3} compromissos</p>
          )}
        </div>
      );
    });

    return tooltips;
  }, [events]);

  const modifiers = useMemo(() => {
    const mods: Record<string, Date[]> = { REUNIAO: [], ATENDIMENTO: [], VISITA: [] };
    events?.forEach(e => {
      if (mods[e.tipo]) {
        mods[e.tipo].push(parseISO(e.data_inicio));
      }
    });
    return mods;
  }, [events]);

  const saveMutation = useMutation({
    mutationFn: async (event: any) => {
      if (!event.titulo?.trim()) throw new Error('Informe o título do compromisso.');
      if (!event.data) throw new Error('Selecione a data.');
      if (!event.hora_inicio || !event.hora_fim) throw new Error('Informe os horários de início e fim.');
      if (!user?.id) throw new Error('Sessão inválida. Faça login novamente.');

      const data_inicio = new Date(`${event.data}T${event.hora_inicio}`);
      const data_fim = new Date(`${event.data}T${event.hora_fim}`);

      if (isNaN(data_inicio.getTime()) || isNaN(data_fim.getTime())) {
        throw new Error('Data ou hora inválida.');
      }

      if (data_fim <= data_inicio) {
        throw new Error('A hora de término deve ser após a hora de início.');
      }

      // Check for overlaps in the same team (or just globally for simplicity as per request)
      const hasOverlap = events?.some(e => {
        if (editingEventId && e.id === editingEventId) return false;
        
        const eStart = parseISO(e.data_inicio);
        const eEnd = parseISO(e.data_fim);
        
        return areIntervalsOverlapping(
          { start: data_inicio, end: data_fim },
          { start: eStart, end: eEnd }
        );
      });

      if (hasOverlap) {
        throw new Error('Já existe um agendamento neste horário. Por favor, escolha outro horário.');
      }

      const payload = {
        titulo: event.titulo,
        descricao: event.descricao,
        data_inicio: data_inicio.toISOString(),
        data_fim: data_fim.toISOString(),
        tipo: event.tipo,
        cliente_id: event.cliente_id || null,
        criado_por: user?.id || '00000000-0000-0000-0000-000000000000'
      };

      const payload = {
        titulo: event.titulo,
        descricao: event.descricao,
        data_inicio: data_inicio.toISOString(),
        data_fim: data_fim.toISOString(),
        tipo: event.tipo,
        cliente_id: event.cliente_id || null,
        criado_por: user.id,
      };

      if (editingEventId) {
        const { error } = await supabase.from('agendamentos').update(payload).eq('id', editingEventId);
        if (error) { console.error('[agenda] update error', error); throw error; }
      } else {
        const { error } = await supabase.from('agendamentos').insert([payload]);
        if (error) { console.error('[agenda] insert error', error); throw error; }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
      setIsDialogOpen(false);
      setEditingEventId(null);
      setFormData({ titulo: '', descricao: '', data: '', hora_inicio: '', hora_fim: '', tipo: 'REUNIAO', cliente_id: '' });
      toast.success(editingEventId ? 'Agendamento atualizado!' : 'Agendamento realizado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
      toast.success('Agendamento cancelado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao cancelar: ' + error.message);
    }
  });

  const handleEdit = (event: any) => {
    const start = parseISO(event.data_inicio);
    const end = parseISO(event.data_fim);
    setFormData({
      titulo: event.titulo,
      descricao: event.descricao || '',
      data: format(start, 'yyyy-MM-dd'),
      hora_inicio: format(start, 'HH:mm'),
      hora_fim: format(end, 'HH:mm'),
      tipo: event.tipo,
      cliente_id: event.cliente_id || ''
    });
    setEditingEventId(event.id);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja realmente cancelar este agendamento?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Agenda de Atendimentos</h1>
          <p className="text-muted-foreground text-sm">Organize as reuniões e compromissos da DF Móveis.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingEventId(null);
            setFormData({ titulo: '', descricao: '', data: '', hora_inicio: '', hora_fim: '', tipo: 'REUNIAO', cliente_id: '' });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>{editingEventId ? 'Editar Compromisso' : 'Agendar Compromisso'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-4">
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
                  <Label htmlFor="tipo">Tipo de Compromisso</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({...formData, tipo: v})}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VISITA">📏 Tirar Medida (Verde)</SelectItem>
                      <SelectItem value="ATENDIMENTO">📞 Atendimento (Azul)</SelectItem>
                      <SelectItem value="REUNIAO">🤝 Reunião Cliente (Vermelho)</SelectItem>
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
                <Label htmlFor="cliente">Cliente Vinculado (Opcional)</Label>
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
              <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} className="w-full sm:w-auto">
                {editingEventId ? 'Salvar Alterações' : 'Confirmar Agendamento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 border-none shadow-md h-fit">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">Calendário</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className="rounded-md w-full"
              modifiers={modifiers}
              dayTooltips={dayTooltips}
              modifiersClassNames={{
                VISITA: "bg-green-100 text-green-700 font-bold border-b-2 border-green-500",
                ATENDIMENTO: "bg-blue-100 text-blue-700 font-bold border-b-2 border-blue-500",
                REUNIAO: "bg-red-100 text-red-700 font-bold border-b-2 border-red-500"
              }}
            />
            <div className="mt-4 p-3 border-t grid grid-cols-1 gap-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Legendas:</p>
              <div className="flex items-center gap-2 text-xs font-medium">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>📏 Tirar Medida (Verde)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>📞 Atendimento (Azul)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span>🤝 Reunião com Cliente (Vermelho)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Compromissos do Dia: {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : ''}
            </h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">Nenhum compromisso para este dia.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredEvents.map((event: any) => (
                <Card key={event.id} className="hover:shadow-md transition-all border-l-4 border-l-transparent overflow-hidden group" style={{ borderLeftColor: event.tipo === 'REUNIAO' ? '#ef4444' : event.tipo === 'ATENDIMENTO' ? '#3b82f6' : '#22c55e' }}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg bg-muted/50`}>
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground">{event.titulo}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIPO_BADGE_COLORS[event.tipo]}`}>
                            {TIPO_LABELS[event.tipo]}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-primary/80">
                            {format(parseISO(event.data_inicio), "HH:mm")} - {format(parseISO(event.data_fim), "HH:mm")}
                          </span>
                          <span className="flex items-center gap-1 border-l pl-3">
                            <User className="h-3 w-3" />
                            {event.criado_por?.nome}
                          </span>
                          {event.cliente && (
                            <span className="font-medium bg-muted px-2 rounded">
                              Cliente: {event.cliente.nome}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleEdit(event)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(event.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
