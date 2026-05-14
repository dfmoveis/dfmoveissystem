import { createFileRoute, redirect } from '@tanstack/react-router';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ensureAuthStoreHydrated } from "@/hooks/use-auth";

export const Route = createFileRoute('/_dashboard')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const { user } = await ensureAuthStoreHydrated();
    if (!user) {
      throw redirect({
        to: "/",
      });
    }
  },
  component: DashboardLayout,
});
