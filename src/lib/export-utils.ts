import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Comissao } from '@/types/database';

export const exportToCSV = (commissions: any[], month: string) => {
  if (!commissions || commissions.length === 0) return;

  const headers = ['Projetista,Cliente,Projeto ID,Valor Venda,Percentual,Valor Comissao'];
  const rows = commissions.map(c => [
    `"${c.projetista?.nome || ''}"`,
    `"${c.projeto?.cliente?.nome || ''}"`,
    `"${c.projeto_id}"`,
    c.projeto?.valor_venda || 0,
    c.percentual,
    c.valor_calculado
  ].join(','));

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `comissoes-${month}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (commissions: any[], month: string) => {
  if (!commissions || commissions.length === 0) return;

  const doc = new jsPDF();
  const title = `Relatorio de Comissoes - ${month}`;
  
  doc.setFontSize(18);
  doc.text('DF Moveis Planejados', 14, 20);
  doc.setFontSize(14);
  doc.text(title, 14, 30);
  
  const total = commissions.reduce((acc, c) => acc + Number(c.valor_calculado), 0);
  doc.setFontSize(12);
  doc.text(`Total do Periodo: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}`, 14, 40);

  const tableColumn = ["Projetista", "Cliente", "Valor Venda", "%", "Comissao"];
  const tableRows = commissions.map(c => [
    c.projetista?.nome || '',
    c.projeto?.cliente?.nome || '',
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c.projeto?.valor_venda || 0)),
    `${c.percentual}%`,
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c.valor_calculado))
  ]);

  (doc as any).autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 50,
    theme: 'striped',
    headStyles: { fillStyle: [59, 130, 246] }
  });

  doc.save(`comissoes-${month}.pdf`);
};
