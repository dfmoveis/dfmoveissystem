import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Comissao } from '@/types/database';

export function useCommissions(month?: string) {
  return useQuery({
    queryKey: ['commissions', month],
    queryFn: async () => {
      let query = supabase
        .from('comissoes')
        .select('*, projeto:projetos(*, cliente:clientes(*)), projetista:users(*)')
        .order('created_at', { ascending: false });

      if (month) {
        // month format YYYY-MM
        const start = `${month}-01`;
        const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0).toISOString().split('T')[0];
        query = query.gte('mes_referencia', start).lte('mes_referencia', end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Comissao[];
    },
  });
}
