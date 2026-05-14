import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from './index';
import { ensureAuthStoreHydrated } from '@/hooks/use-auth';

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const { user, role } = await ensureAuthStoreHydrated();
    if (user) {
      throw redirect({
        to: role === 'ADMIN' ? "/admin/dashboard" : "/projetista/dashboard",
      });
    }
  },
  component: LoginPage,
});
