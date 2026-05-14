import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/database';
import { toast } from 'sonner';

export type MemberStatus = 'PENDENTE' | 'ATIVO' | 'BLOQUEADO';

export function useTeam() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'PROJETISTA')
        .order('nome');

      if (error) throw error;
      return data as (User & { status?: MemberStatus; password?: string })[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MemberStatus }) => {
      const { error } = await supabase.from('users').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      const label =
        vars.status === 'ATIVO' ? 'aprovado' : vars.status === 'BLOQUEADO' ? 'bloqueado' : 'atualizado';
      toast.success(`Projetista ${label} com sucesso!`);
    },
    onError: (err: any) => toast.error('Erro ao atualizar status: ' + err.message),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Membro removido com sucesso!');
    },
  });

  return { ...query, updateStatus, deleteMember };
}
