import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/admin/comissoes')({
  component: () => <div className="p-4"><h1>Gestão de Comissões</h1><p>Em desenvolvimento...</p></div>,
});
