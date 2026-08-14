import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export interface AdminApprovalItem {
  id: string;
  kind: "DESIGNER_REGISTRATION";
  title: string;
  description: string;
  createdAt: string | null;
  target: "/admin/equipe";
}

export const ADMIN_APPROVALS_QUERY_KEY = ["admin-approval-center"] as const;

export function useAdminApprovals() {
  const role = useAuthStore((state) => state.role);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ADMIN_APPROVALS_QUERY_KEY,
    enabled: role === "ADMIN",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, nome, email, created_at")
        .eq("role", "PROJETISTA")
        .eq("status", "PENDENTE")
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((designer): AdminApprovalItem => ({
        id: designer.id,
        kind: "DESIGNER_REGISTRATION",
        title: designer.nome,
        description: designer.email,
        createdAt: designer.created_at,
        target: "/admin/equipe",
      }));
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (role !== "ADMIN") return;

    const channel = supabase
      .channel("admin-approval-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => void queryClient.invalidateQueries({ queryKey: ADMIN_APPROVALS_QUERY_KEY }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, role]);

  const items = query.data ?? [];

  return {
    ...query,
    items,
    pendingCount: items.length,
  };
}
