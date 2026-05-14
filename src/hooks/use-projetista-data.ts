import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Projeto, Comissao } from '@/types/database';

export function useProjetistaStats(projetistaId: string) {
  return useQuery({
    queryKey: ['projetista-stats', projetistaId],
    queryFn: async () => {
      if (!projetistaId) return null;

      // Fetch designer's projects
      const { data: projetos, error: pError } = await supabase
        .from('projetos')
        .select('*, cliente:clientes(*)')
        .eq('projetista_id', projetistaId);

      if (pError) throw pError;

      // Fetch designer's commissions
      const { data: comissoes, error: cError } = await supabase
        .from('comissoes')
        .select('*')
        .eq('projetista_id', projetistaId);

      if (cError) throw cError;

      const typedProjetos = projetos as Projeto[];
      const typedComissoes = comissoes as Comissao[];

      // Calculate KPIs
      const totalVendido = typedProjetos
        .filter(p => p.status_venda === 'VENDEU')
        .reduce((acc, p) => acc + (Number(p.valor_venda) || 0), 0);

      const projetosAtivos = typedProjetos
        .filter(p => p.status === 'EM_EXECUCAO' || p.status === 'ATRASADO').length;

      const comissaoTotal = typedComissoes
        .reduce((acc, c) => acc + (Number(c.valor_calculado) || 0), 0);

      const totalLeads = typedProjetos.length;
      const totalVendasCount = typedProjetos.filter(p => p.status_venda === 'VENDEU').length;
      const taxaConversao = totalLeads > 0 ? (totalVendasCount / totalLeads) * 100 : 0;

      // Pipeline Data
      const pipelineData = [
        { name: 'Negociação', value: typedProjetos.filter(p => p.status_venda === 'EM_NEGOCIACAO').length },
        { name: 'Vendeu', value: typedProjetos.filter(p => p.status_venda === 'VENDEU').length },
        { name: 'Não Vendeu', value: typedProjetos.filter(p => p.status_venda === 'NAO_VENDEU').length },
      ].filter(d => d.value > 0);

      // Projects by Status
      const statusData = [
        { name: 'Pronto', value: typedProjetos.filter(p => p.status === 'PRONTO').length },
        { name: 'Execução', value: typedProjetos.filter(p => p.status === 'EM_EXECUCAO').length },
        { name: 'Atrasado', value: typedProjetos.filter(p => p.status === 'ATRASADO').length },
        { name: 'Finalizado', value: typedProjetos.filter(p => p.status === 'FINALIZADO').length },
      ].filter(d => d.value > 0);

      return {
        totalVendido,
        projetosAtivos,
        comissaoTotal,
        taxaConversao,
        pipelineData,
        statusData,
        meusProjetos: typedProjetos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      };
    },
    enabled: !!projetistaId,
  });
}
