import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { useAuthStore } from '@/hooks/use-auth';
import { useProjetistaStats } from '@/hooks/use-projetista-data';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

export const Route = createFileRoute('/_dashboard/projetista/dashboard')({
  component: ProjetistaDashboard,
});

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const STATUS_COLORS: Record<string, string> = {
  'PRONTO': 'bg-gray-100 text-gray-800',
  'EM_EXECUCAO': 'bg-blue-100 text-blue-800',
  'PAUSADO': 'bg-yellow-100 text-yellow-800',
  'ATRASADO': 'bg-red-100 text-red-800',
  'FINALIZADO': 'bg-green-100 text-green-800',
};

const VENDA_COLORS: Record<string, string> = {
  'EM_NEGOCIACAO': 'bg-purple-100 text-purple-800',
  'VENDEU': 'bg-emerald-100 text-emerald-800',
  'NAO_VENDEU': 'bg-rose-100 text-rose-800',
};

function ProjetistaDashboard() {
  const { user } = useAuthStore();
  const { data: stats, isLoading } = useProjetistaStats(user?.id || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const kpis = [
    { 
      title: 'Vendas Totais', 
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.totalVendido || 0), 
      icon: DollarSign, 
      color: 'text-emerald-500' 
    },
    { 
      title: 'Projetos Ativos', 
      value: stats?.projetosAtivos || 0, 
      icon: Briefcase, 
      color: 'text-blue-500' 
    },
    { 
      title: 'Comissão Acumulada', 
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.comissaoTotal || 0), 
      icon: TrendingUp, 
      color: 'text-purple-500' 
    },
    { 
      title: 'Conversão', 
      value: `${stats?.taxaConversao.toFixed(1)}%`, 
      icon: CheckCircle2, 
      color: 'text-amber-500' 
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Bem-vindo, {user?.nome}</h1>
        <p className="text-muted-foreground">Acompanhe seus projetos e performance comercial.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Pipeline de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.pipelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Bar dataKey="value" fill="var(--color-primary, #3b82f6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Status dos Projetos</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats?.statusData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs">
              {stats?.statusData?.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span>{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meus Projetos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Cliente</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Status do Projeto</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Venda</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Prazo</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {stats?.meusProjetos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      Nenhum projeto encontrado.
                    </td>
                  </tr>
                ) : (
                  stats?.meusProjetos.map((projeto) => (
                    <tr key={projeto.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-2 align-middle">
                        <div className="flex flex-col">
                          <span className="font-medium">{projeto.cliente?.nome}</span>
                          <span className="text-xs text-muted-foreground">{projeto.cliente?.email}</span>
                        </div>
                      </td>
                      <td className="p-2 align-middle">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[projeto.status]}`}>
                          {projeto.status}
                        </span>
                      </td>
                      <td className="p-2 align-middle">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${VENDA_COLORS[projeto.status_venda]}`}>
                          {projeto.status_venda.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-2 align-middle">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{new Date(projeto.prazo_termino).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </td>
                      <td className="p-2 align-middle text-right font-medium">
                        {projeto.valor_venda ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(projeto.valor_venda)) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
