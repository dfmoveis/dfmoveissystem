import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/projetista/dashboard')({
  component: ProjetistaDashboard,
});

function ProjetistaDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Meus Projetos</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-2">Em Execução</h3>
          <div className="text-sm text-muted-foreground">
            Você não tem projetos em execução no momento.
          </div>
        </div>
      </div>
    </div>
  );
}
