import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/database';
import { toast } from 'sonner';

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
      return data as User[];
    },
  });

  const addMember = useMutation({
    mutationFn: async (newMember: Partial<User>) => {
      const { data, error } = await supabase
        .from('users')
        .insert([{ ...newMember, role: 'PROJETISTA' }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Membro da equipe adicionado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar membro: ' + error.message);
    },
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

  return { ...query, addMember, deleteMember };
}
