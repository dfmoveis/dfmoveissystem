import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@/types/database";
import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-auth";

export type MemberStatus = "PENDENTE" | "ATIVO" | "BLOQUEADO";

export function useTeam() {
  const queryClient = useQueryClient();
  const administrator = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, nome, email, role, status, avatar_url, created_at")
        .eq("role", "PROJETISTA")
        .order("status", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as unknown as User[];
    },
    refetchInterval: 15_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MemberStatus }) => {
      if (!administrator?.id || administrator.role !== "ADMIN") {
        throw new Error("Somente o superusuário pode alterar acessos.");
      }

      const { error } = await supabase
        .from("users")
        .update({ status })
        .eq("id", id)
        .eq("role", "PROJETISTA");
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      const label =
        vars.status === "ATIVO"
          ? "aprovado"
          : vars.status === "BLOQUEADO"
            ? "bloqueado"
            : "atualizado";
      toast.success(`Projetista ${label} com sucesso!`);
    },
    onError: (error: Error) => toast.error("Erro ao atualizar status: " + error.message),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      if (!administrator?.id || administrator.role !== "ADMIN") {
        throw new Error("Somente o superusuário pode remover usuários.");
      }
      const { error } = await supabase.from("users").delete().eq("id", id).eq("role", "PROJETISTA");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Membro removido com sucesso!");
    },
    onError: (error: Error) => toast.error("Erro ao remover usuário: " + error.message),
  });

  return { ...query, updateStatus, deleteMember };
}
