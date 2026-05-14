import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/projetista/perfil')({
  component: () => <div className="p-4"><h1>Meu Perfil</h1><p>Em desenvolvimento...</p></div>,
});
