import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, AlertCircle, DollarSign } from 'lucide-react';

export const Route = createFileRoute('/_dashboard/admin/dashboard')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const stats = [
    { title: 'Projetos Ativos', value: '12', icon: Briefcase, color: 'text-blue-500' },
    { title: 'Projetos Atrasados', value: '3', icon: AlertCircle, color: 'text-destructive' },
    { title: 'Vendido no Mês', value: 'R$ 145.200,00', icon: DollarSign, color: 'text-green-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard Administrativo</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos os Projetos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            Nenhum projeto encontrado. Os dados aparecerão aqui após o cadastro.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
