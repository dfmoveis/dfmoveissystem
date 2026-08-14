import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@/types/database";
import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-auth";

export type MemberStatus = "PENDENTE" | "ATIVO" | "BLOQUEADO";

export interface CreateDesignerInput {
  nome: string;
  email: string;
  password: string;
  adminPassword: string;
}

export interface DeleteDesignerInput {
  id: string;
  adminPassword: string;
}

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
    mutationFn: async ({ id, adminPassword }: DeleteDesignerInput) => {
      if (!administrator?.id || administrator.role !== "ADMIN") {
        throw new Error("Somente o superusuário pode remover usuários.");
      }

      const { data, error } = await supabase.rpc("admin_delete_designer", {
        p_admin_id: administrator.id,
        p_admin_password: adminPassword,
        p_designer_id: id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-projects"] });
      toast.success("Projetista e todos os dados vinculados foram removidos.");
    },
    onError: (error: Error) => toast.error("Erro ao remover usuário: " + error.message),
  });

  const createMember = useMutation({
    mutationFn: async ({ nome, email, password, adminPassword }: CreateDesignerInput) => {
      if (!administrator?.id || administrator.role !== "ADMIN") {
        throw new Error("Somente o superusuário pode adicionar projetistas.");
      }

      const { data, error } = await supabase.rpc("admin_create_designer", {
        p_admin_id: administrator.id,
        p_admin_password: adminPassword,
        p_nome: nome,
        p_email: email,
        p_password: password,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Projetista adicionada com acesso liberado!");
    },
    onError: (error: Error) => toast.error("Erro ao adicionar projetista: " + error.message),
  });

  return { ...query, updateStatus, deleteMember, createMember };
}
