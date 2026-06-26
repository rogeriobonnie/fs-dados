import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatDateBR } from '@/utils/dateUtils';
import type { StudentAggregate, GroupKey } from '@/components/RelatorioInadimplencia.types';

const GROUP_META: Record<GroupKey, { title: string; rgb: [number, number, number] }> = {
  VENCIDO: { title: 'Em Atraso', rgb: [220, 38, 38] },
  EM_NEGOCIACAO: { title: 'Em Negociação / Acordo', rgb: [234, 88, 12] },
  DISTRATO: { title: 'Distratos', rgb: [82, 82, 91] },
  A_PAGAR: { title: 'A Pagar', rgb: [37, 99, 235] },
  PAGO: { title: 'Pagos / Adimplentes', rgb: [22, 163, 74] },
};

const ORDER: GroupKey[] = ['VENCIDO', 'EM_NEGOCIACAO', 'DISTRATO', 'A_PAGAR', 'PAGO'];

export interface ReportSummary {
  totalContracted: number;
  totalReceived: number;
  totalOpen: number;
  totalOverdue: number;
  totalLost: number;
  inadimplenciaPct: number;
  byGroup: Record<GroupKey, { count: number; total: number }>;
}

export function exportInadimplenciaPDF(
  groups: Record<GroupKey, StudentAggregate[]>,
  summary: ReportSummary,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const today = new Date().toLocaleDateString('pt-BR');

  // Header
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Inadimplência — FS Turma IV', margin, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em ${today}`, margin, 17);

  let y = 28;

  // Summary cards
  const cardW = (pageW - margin * 2 - 8) / 5;
  const cardH = 18;
  ORDER.forEach((key, i) => {
    const x = margin + i * (cardW + 2);
    const meta = GROUP_META[key];
    doc.setFillColor(...meta.rgb);
    doc.rect(x, y, cardW, 5, 'F');
    doc.setDrawColor(220);
    doc.setFillColor(250, 250, 250);
    doc.rect(x, y + 5, cardW, cardH - 5, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(meta.title, x + 1.5, y + 3.6);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.text(String(summary.byGroup[key].count), x + 1.5, y + 11);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('alunos', x + 8, y + 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(summary.byGroup[key].total), x + 1.5, y + 16);
  });
  y += cardH + 6;

  // Consolidated block
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, pageW - margin * 2, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const consolidated: Array<[string, string]> = [
    ['Contratado', formatCurrency(summary.totalContracted)],
    ['Recebido', formatCurrency(summary.totalReceived)],
    ['Em aberto', formatCurrency(summary.totalOpen)],
    ['Em atraso', formatCurrency(summary.totalOverdue)],
    ['Perdido', formatCurrency(summary.totalLost)],
    ['% Inadimplência', `${summary.inadimplenciaPct.toFixed(1)}%`],
  ];
  const colW = (pageW - margin * 2) / consolidated.length;
  consolidated.forEach(([label, value], i) => {
    const cx = margin + i * colW;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 200, 220);
    doc.text(label, cx + 2, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(value, cx + 2, y + 12);
  });
  y += 20;

  // Tables per group
  ORDER.forEach(key => {
    const list = groups[key];
    if (!list || list.length === 0) return;
    const meta = GROUP_META[key];
    const showObs = key === 'VENCIDO' || key === 'DISTRATO';

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[
        `${meta.title}  (${list.length})`,
        'Consultora',
        'Condição',
        'Parc.',
        'Contratado',
        'Recebido',
        'Em aberto',
        'Atraso',
        'Contrato',
        ...(showObs ? ['Observação'] : []),
      ]],
      body: list.map(s => [
        s.name,
        s.consultant,
        s.specialConditions.join(' · '),
        `${s.installmentsPaid}/${s.totalInstallments}`,
        formatCurrency(s.totalContracted),
        formatCurrency(s.totalReceived),
        formatCurrency(s.totalOpen),
        s.maxDaysOverdue > 0 ? `${s.maxDaysOverdue}d` : '-',
        s.contractDate ? formatDateBR(s.contractDate) : '-',
        ...(showObs ? [s.observations.join(' · ') || '-'] : []),
      ]),
      didParseCell: (data) => {
        if (data.section === 'body') {
          const row = list[data.row.index];
          if (row && row.specialConditions.length > 0) {
            data.cell.styles.fillColor = [243, 232, 255];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      foot: [[
        'TOTAL',
        '',
        '',
        '',
        formatCurrency(list.reduce((a, s) => a + s.totalContracted, 0)),
        formatCurrency(list.reduce((a, s) => a + s.totalReceived, 0)),
        formatCurrency(list.reduce((a, s) => a + s.totalOpen, 0)),
        '',
        '',
        ...(showObs ? [''] : []),
      ]],
      styles: { fontSize: 7.5, cellPadding: 1.6 },
      headStyles: {
        fillColor: meta.rgb,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: {
        2: { textColor: [88, 28, 135], fontStyle: 'bold' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right', textColor: [22, 101, 52] },
        6: { halign: 'right', textColor: [153, 27, 27] },
        7: { halign: 'center' },
      },
    });
    // @ts-expect-error lastAutoTable injected by plugin
    y = doc.lastAutoTable.finalY + 6;
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageW - margin,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'right' },
    );
    doc.text('FS — Relatório de Inadimplência', margin, doc.internal.pageSize.getHeight() - 5);
  }

  const filename = `Inadimplencia_FS_Turma_IV_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}