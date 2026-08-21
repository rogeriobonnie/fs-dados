import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface CursoLinhaPDF {
  nome: string;
  qtd: number;
  bruto: number;
  medio: number;
  taxas: number;
  impostos: number;
  comVendedor: number;
  comMkt: number;
  despDireta: number;
  rateio: number;
  rateioCols: number[];
  liquido: number;
  resultado: number;
}

export interface BlocoPDF {
  titulo: string;
  cor: [number, number, number];
  linhas: CursoLinhaPDF[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const totalize = (linhas: CursoLinhaPDF[]) =>
  linhas.reduce(
    (a, l) => ({
      qtd: a.qtd + l.qtd,
      bruto: a.bruto + l.bruto,
      taxas: a.taxas + l.taxas,
      impostos: a.impostos + l.impostos,
      comVendedor: a.comVendedor + l.comVendedor,
      comMkt: a.comMkt + l.comMkt,
      despDireta: a.despDireta + l.despDireta,
      rateio: a.rateio + l.rateio,
      rateioCols: l.rateioCols.map((v, i) => (a.rateioCols[i] || 0) + v),
      liquido: a.liquido + l.liquido,
      resultado: a.resultado + l.resultado,
    }),
    { qtd: 0, bruto: 0, taxas: 0, impostos: 0, comVendedor: 0, comMkt: 0, despDireta: 0, rateio: 0, rateioCols: [] as number[], liquido: 0, resultado: 0 },
  );

export function exportResultadoCursosPDF(params: {
  periodo: string;
  blocos: BlocoPDF[];
  rateioLabels: string[];
  matriz: { nome: string; meses: number[]; total: number }[];
  mesesLabels: string[];
  resultadoSemestre: number;
  liquidoSemestre: number;
}) {
  const { periodo, blocos, rateioLabels, matriz, mesesLabels, resultadoSemestre, liquidoSemestre } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Header
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, W, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`Resultado por Curso — ${periodo}`, margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, margin, 16);

  let y = 26;

  const head = [[
    'Curso / Receita', 'Qtd', 'Bruto', 'Vlr médio', 'Taxas', 'Impostos',
    'Com. Vend.', 'Com. MKT (L2)', 'Desp. direta', ...rateioLabels, 'Rateio total', 'Líquido', 'Resultado',
  ]];
  const RC = rateioLabels.length;

  blocos.forEach(bloco => {
    if (bloco.linhas.length === 0) return;
    const t = totalize(bloco.linhas);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head,
      body: bloco.linhas.map(l => [
        l.nome,
        String(l.qtd),
        fmt(l.bruto),
        fmt(l.medio),
        l.taxas ? `-${fmt(l.taxas)}` : '-',
        l.impostos ? `-${fmt(l.impostos)}` : '-',
        l.comVendedor ? `-${fmt(l.comVendedor)}` : '-',
        l.comMkt ? `-${fmt(l.comMkt)}` : '-',
        l.despDireta ? `-${fmt(l.despDireta)}` : '-',
        ...l.rateioCols.map(v => (v ? `-${fmt(v)}` : '-')),
        l.rateio ? `-${fmt(l.rateio)}` : '-',
        fmt(l.liquido),
        fmt(l.resultado),
      ]),
      foot: [[
        `TOTAL — ${bloco.titulo}`,
        String(t.qtd),
        fmt(t.bruto),
        '',
        `-${fmt(t.taxas)}`,
        `-${fmt(t.impostos)}`,
        `-${fmt(t.comVendedor)}`,
        `-${fmt(t.comMkt)}`,
        `-${fmt(t.despDireta)}`,
        ...rateioLabels.map((_, i) => `-${fmt(t.rateioCols[i] || 0)}`),
        `-${fmt(t.rateio)}`,
        fmt(t.liquido),
        fmt(t.resultado),
      ]],
      theme: 'grid',
      styles: { fontSize: 6.2, cellPadding: 1 },
      headStyles: { fillColor: bloco.cor, textColor: 255, fontStyle: 'bold', fontSize: 6.6 },
      footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold', fontSize: 6.6 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', textColor: [185, 28, 28] },
        5: { halign: 'right', textColor: [185, 28, 28] },
        6: { halign: 'right', textColor: [185, 28, 28] },
        7: { halign: 'right', textColor: [185, 28, 28] },
        8: { halign: 'right', textColor: [185, 28, 28] },
        ...Object.fromEntries(rateioLabels.map((_, i) => [9 + i, { halign: 'right', textColor: [239, 68, 68] }])),
        [9 + RC]: { halign: 'right', textColor: [185, 28, 28], fontStyle: 'bold' },
        [10 + RC]: { halign: 'right', fontStyle: 'bold' },
        [11 + RC]: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216] },
      } as Record<number, Record<string, unknown>>,
      didDrawPage: () => undefined,
    });
    // @ts-expect-error injected by plugin
    y = doc.lastAutoTable.finalY + 8;
  });

  // Matriz mês a mês
  if (matriz.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Curso (receita bruta por mês)', ...mesesLabels, 'Total']],
      body: matriz.map(m => [m.nome, ...m.meses.map(v => (v ? fmt(v) : '-')), fmt(m.total)]),
      foot: [[
        'TOTAL',
        ...mesesLabels.map((_, i) => fmt(matriz.reduce((s, m) => s + m.meses[i], 0))),
        fmt(matriz.reduce((s, m) => s + m.total, 0)),
      ]],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.4, halign: 'right' },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, halign: 'center' },
      footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { halign: 'left' } },
    });
    // @ts-expect-error injected by plugin
    y = doc.lastAutoTable.finalY + 8;
  }

  // Consolidado
  if (y > H - 30) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, W - margin * 2, 18, 'F');
  doc.setTextColor(180, 200, 220);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Receita líquida do semestre', margin + 4, y + 6);
  doc.text('Resultado do semestre', W / 2 + 4, y + 6);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(fmt(liquidoSemestre), margin + 4, y + 14);
  doc.text(fmt(resultadoSemestre), W / 2 + 4, y + 14);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.setFont('helvetica', 'normal');
    doc.text('FS — Resultado por Curso', margin, H - 5);
    doc.text(`Página ${i} de ${pages}`, W - margin, H - 5, { align: 'right' });
  }

  doc.save(`resultado-por-curso-${periodo.replace('/', '-')}.pdf`);
}
