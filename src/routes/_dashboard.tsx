import { createFileRoute, redirect } from '@tanstack/react-router';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuthStore } from "@/hooks/use-auth";

export const Route = createFileRoute('/_dashboard')({
  beforeLoad: () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      throw redirect({
        to: "/",
      });
    }
  },
  component: DashboardLayout,
});
