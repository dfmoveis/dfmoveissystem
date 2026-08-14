import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { validateStoredAccess } from "@/hooks/use-auth";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      return;
    }

    const access = await validateStoredAccess();
    if (access.authorized) return;

    if (access.account && ["PENDING", "BLOCKED"].includes(access.reason)) {
      throw redirect({
        to: "/aguardando-aprovacao",
        search: { email: access.account.email },
      });
    }

    throw redirect({ to: "/" });
  },
  component: DashboardLayout,
});
