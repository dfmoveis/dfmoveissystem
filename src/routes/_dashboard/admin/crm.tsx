import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/admin/crm')({
  component: () => <div className="p-4"><h1>CRM - Clientes</h1><p>Em desenvolvimento...</p></div>,
});
