import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const LOGO_URL = 'https://rmetppilvfrxosvxzhgj.supabase.co/storage/v1/object/public/message-attachments/209c78c7-5f85-4fcb-a4ee-6c7dd71e3717/1778783898939_luewqy_8.png';

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
  
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = LOGO_URL;
  
  img.onload = () => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Add watermark on first page
    doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
    const watermarkWidth = 100;
    const watermarkHeight = 100;
    doc.addImage(img, 'PNG', (pageWidth - watermarkWidth) / 2, (pageHeight - watermarkHeight) / 2, watermarkWidth, watermarkHeight);
    doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
    
    // Header
    doc.addImage(img, 'PNG', 14, 10, 20, 20);
    doc.setFontSize(18);
    doc.text('DF Moveis Planejados', 38, 20);
    doc.setFontSize(14);
    doc.text(title, 38, 30);
    
    const total = commissions.reduce((acc, c) => acc + Number(c.valor_calculado), 0);
    doc.setFontSize(12);
    doc.text(`Total do Periodo: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}`, 14, 45);

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
      startY: 55,
      theme: 'striped',
      headStyles: { fillColor: [33, 33, 33] },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
          doc.addImage(img, 'PNG', (pageWidth - watermarkWidth) / 2, (pageHeight - watermarkHeight) / 2, watermarkWidth, watermarkHeight);
          doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
        }
      }
    });

    doc.save(`comissoes-${month}.pdf`);
  };

  img.onerror = () => {
    doc.setFontSize(18);
    doc.text('DF Moveis Planejados', 14, 20);
    doc.setFontSize(14);
    doc.text(title, 14, 30);
    doc.save(`comissoes-${month}.pdf`);
  };
};
