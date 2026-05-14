import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Projeto, User, Comissao } from '@/types/database';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Fetch projects with client and designer info
      const { data: projetos, error: pError } = await supabase
        .from('projetos')
        .select('*, cliente:clientes(*), projetista:users(*)');

      if (pError) throw pError;

      // Fetch all designers
      const { data: projetistas, error: uError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'PROJETISTA');

      if (uError) throw uError;

      // Calculate KPIs
      const totalVendas = (projetos as Projeto[])
        .filter(p => p.status_venda === 'VENDEU')
        .reduce((acc, p) => acc + (Number(p.valor_venda) || 0), 0);

      const projetosExecucao = (projetos as Projeto[])
        .filter(p => p.status === 'EM_EXECUCAO').length;

      const totalLeads = (projetos as Projeto[]).length;
      const totalVendasCount = (projetos as Projeto[])
        .filter(p => p.status_venda === 'VENDEU').length;
      
      const taxaConversao = totalLeads > 0 ? (totalVendasCount / totalLeads) * 100 : 0;

      // Data for charts
      const statusData = [
        { name: 'Pronto', value: projetos.filter(p => p.status === 'PRONTO').length },
        { name: 'Execução', value: projetos.filter(p => p.status === 'EM_EXECUCAO').length },
        { name: 'Atrasado', value: projetos.filter(p => p.status === 'ATRASADO').length },
        { name: 'Finalizado', value: projetos.filter(p => p.status === 'FINALIZADO').length },
      ].filter(d => d.value > 0);

      const vendasPorProjetista = projetistas.map(u => {
        const vendas = (projetos as Projeto[])
          .filter(p => p.projetista_id === u.id && p.status_venda === 'VENDEU')
          .reduce((acc, p) => acc + (Number(p.valor_venda) || 0), 0);
        return { name: u.nome, total: vendas };
      });

      return {
        totalVendas,
        projetosExecucao,
        taxaConversao,
        statusData,
        vendasPorProjetista,
        projetosRecentes: (projetos as Projeto[]).slice(0, 5),
      };
    },
  });
}
