import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from './index';
import { useAuthStore } from '@/hooks/use-auth';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const { user, role } = useAuthStore.getState();
    if (user) {
      throw redirect({
        to: role === 'ADMIN' ? "/admin/dashboard" : "/projetista/dashboard",
      });
    }
  },
  component: LoginPage,
});
