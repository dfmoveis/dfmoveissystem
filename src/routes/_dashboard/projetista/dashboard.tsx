import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  ArrowUpRight
} from 'lucide-react';
import { useAuthStore } from '@/hooks/use-auth';
import { useProjetistaStats } from '@/hooks/use-projetista-data';
import { motion } from 'framer-motion';
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
  'PRONTO': 'bg-gray-100/50 text-gray-700 border-gray-100',
  'EM_EXECUCAO': 'bg-blue-100/50 text-blue-700 border-blue-100',
  'PAUSADO': 'bg-yellow-100/50 text-yellow-700 border-yellow-100',
  'ATRASADO': 'bg-red-100/50 text-red-700 border-red-100',
  'FINALIZADO': 'bg-green-100/50 text-green-700 border-green-100',
};

const VENDA_COLORS: Record<string, string> = {
  'EM_NEGOCIACAO': 'bg-purple-100/50 text-purple-700 border-purple-100',
  'VENDEU': 'bg-emerald-100/50 text-emerald-700 border-emerald-100',
  'NAO_VENDEU': 'bg-rose-100/50 text-rose-700 border-rose-100',
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
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
      value: stats?.totalVendido || 0,
      isCurrency: true,
      icon: DollarSign, 
      color: 'text-emerald-500',
      bg: 'bg-emerald-50/50'
    },
    { 
      title: 'Projetos Ativos', 
      value: stats?.projetosAtivos || 0, 
      icon: Briefcase, 
      color: 'text-blue-500',
      bg: 'bg-blue-50/50'
    },
    { 
      title: 'Comissão Acumulada', 
      value: stats?.comissaoTotal || 0,
      isCurrency: true,
      icon: TrendingUp, 
      color: 'text-purple-500',
      bg: 'bg-purple-50/50'
    },
    { 
      title: 'Conversão', 
      value: stats?.taxaConversao || 0,
      isPercent: true,
      icon: CheckCircle2, 
      color: 'text-amber-500',
      bg: 'bg-amber-50/50'
    },
  ];

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-8"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Bem-vindo, {user?.nome}</h1>
        <p className="text-muted-foreground">Acompanhe seus projetos e performance comercial com a DF Móveis.</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <motion.div key={kpi.title} variants={item}>
            <Card className="overflow-hidden border-none shadow-md bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group">
              <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform`}>
                <kpi.icon className={`h-16 w-16 ${kpi.color}`} />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{kpi.title}</CardTitle>
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-2xl font-bold truncate max-w-full">
                  {kpi.isCurrency 
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(kpi.value)
                    : kpi.isPercent
                      ? `${kpi.value.toFixed(1)}%`
                      : kpi.value
                  }
                </div>
                <div className="flex items-center mt-1 text-xs font-medium text-emerald-600">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  <span>Meta do mês</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <motion.div variants={item} className="lg:col-span-4">
          <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Pipeline de Vendas
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.pipelineData}>
                  <defs>
                    <linearGradient id="barGradientProjetista" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#64748b' }}
                  />
                  <YAxis 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#64748b' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                  />
                  <Bar dataKey="value" fill="url(#barGradientProjetista)" radius={[6, 6, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} className="lg:col-span-3">
          <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Status dos Projetos
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={8}
                    dataKey="value"
                    animationBegin={200}
                    animationDuration={1500}
                  >
                    {stats?.statusData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-2 pb-4">
                {stats?.statusData?.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-lg font-semibold">Meus Projetos Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative w-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/10 text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
                    <th className="h-12 px-6 text-left align-middle font-bold">Cliente</th>
                    <th className="h-12 px-6 text-left align-middle font-bold">Status Projeto</th>
                    <th className="h-12 px-6 text-left align-middle font-bold">Venda</th>
                    <th className="h-12 px-6 text-left align-middle font-bold">Prazo</th>
                    <th className="h-12 px-6 text-right align-middle font-bold">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats?.meusProjetos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        Nenhum projeto encontrado.
                      </td>
                    </tr>
                  ) : (
                    stats?.meusProjetos.map((projeto) => (
                      <tr key={projeto.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4 align-middle">
                          <div className="font-semibold text-foreground">{projeto.cliente?.nome}</div>
                          <div className="text-[10px] text-muted-foreground">{projeto.cliente?.email}</div>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase border tracking-tighter ${STATUS_COLORS[projeto.status]}`}>
                            {projeto.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase border tracking-tighter ${VENDA_COLORS[projeto.status_venda]}`}>
                            {projeto.status_venda.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs">{new Date(projeto.prazo_termino).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle text-right font-mono font-bold text-foreground">
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
      </motion.div>
    </motion.div>
  );
}
  );
}
