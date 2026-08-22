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
  const BOTTOM = H - 14;

  const drawHeader = () => {
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 0, W, 20, 'F');
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 18, W, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`Resultado por Curso — ${periodo}`, margin, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, margin, 16);
    doc.setTextColor(0, 0, 0);
  };

  drawHeader();
  let y = 26;

  const newPage = () => {
    doc.addPage();
    drawHeader();
    y = 26;
  };

  const sectionTitle = (titulo: string, cor: [number, number, number], h = 8) => {
    doc.setFillColor(cor[0], cor[1], cor[2]);
    doc.roundedRect(margin, y, W - margin * 2, h, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(titulo.toUpperCase(), margin + 3, y + h / 2 + 1.4);
    doc.setTextColor(0, 0, 0);
    y += h + 2;
  };

  const head = [[
    'Curso / Receita', 'Qtd', 'Bruto', 'Vlr médio', 'Taxas', 'Impostos',
    'Com. Vend.', 'Com. MKT (L2)', 'Desp. direta', ...rateioLabels, 'Despesas totais', 'Líquido', 'Resultado',
  ]];
  const RC = rateioLabels.length;
  const ROW_H = 4.6;

  blocos.forEach(bloco => {
    if (bloco.linhas.length === 0) return;
    const t = totalize(bloco.linhas);
    // Evita tabela cortada: reserva espaço para título + cabeçalho + linhas + total
    const needed = 10 + 6 + (bloco.linhas.length + 1) * ROW_H;
    if (y + needed > BOTTOM) newPage();

    sectionTitle(bloco.titulo, bloco.cor);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: 26 },
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
        l.despDireta + l.rateio ? `-${fmt(l.despDireta + l.rateio)}` : '-',
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
        `-${fmt(t.despDireta + t.rateio)}`,
        fmt(t.liquido),
        fmt(t.resultado),
      ]],
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 6.2, cellPadding: 1.1, lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: bloco.cor, textColor: 255, fontStyle: 'bold', fontSize: 6.6, halign: 'center' },
      footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 6.8 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [15, 23, 42] },
        1: { halign: 'center' },
        2: { halign: 'right', fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold' },
        3: { halign: 'right' },
        4: { halign: 'right', textColor: [185, 28, 28] },
        5: { halign: 'right', textColor: [185, 28, 28] },
        6: { halign: 'right', textColor: [185, 28, 28] },
        7: { halign: 'right', textColor: [185, 28, 28] },
        8: { halign: 'right', textColor: [185, 28, 28] },
        ...Object.fromEntries(rateioLabels.map((_, i) => [9 + i, { halign: 'right', textColor: [239, 68, 68] }])),
        [9 + RC]: { halign: 'right', textColor: [153, 27, 27], fontStyle: 'bold', fillColor: [254, 242, 242] },
        [10 + RC]: { halign: 'right', fontStyle: 'bold' },
        [11 + RC]: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216], fillColor: [239, 246, 255] },
      } as Record<number, Record<string, unknown>>,
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 11 + RC) {
          const raw = String(data.cell.raw);
          if (raw.trim().startsWith('-R$')) {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fillColor = [254, 242, 242];
          }
        }
      },
    });
    // @ts-expect-error injected by plugin
    y = doc.lastAutoTable.finalY + 8;
  });

  // Matriz mês a mês
  if (matriz.length > 0) {
    const needed = 10 + 8 + (matriz.length + 1) * 5.6;
    if (y + needed > BOTTOM) newPage();
    sectionTitle('Receita bruta por mês', [30, 64, 175]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, top: 26 },
      head: [['Curso', ...mesesLabels, 'Total']],
      body: matriz.map(m => [m.nome, ...m.meses.map(v => (v ? fmt(v) : '-')), fmt(m.total)]),
      foot: [[
        'TOTAL',
        ...mesesLabels.map((_, i) => fmt(matriz.reduce((s, m) => s + m.meses[i], 0))),
        fmt(matriz.reduce((s, m) => s + m.total, 0)),
      ]],
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 7.5, cellPadding: 1.4, halign: 'right', lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, halign: 'center', fontStyle: 'bold' },
      footStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', textColor: [15, 23, 42] },
        [mesesLabels.length + 1]: { fontStyle: 'bold', textColor: [29, 78, 216], fillColor: [239, 246, 255] },
      } as Record<number, Record<string, unknown>>,
    });
    // @ts-expect-error injected by plugin
    y = doc.lastAutoTable.finalY + 8;
  }

  // Consolidado
  if (y + 26 > BOTTOM) newPage();
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, W - margin * 2, 22, 2, 2, 'F');
  doc.setFillColor(resultadoSemestre >= 0 ? 34 : 220, resultadoSemestre >= 0 ? 197 : 38, resultadoSemestre >= 0 ? 94 : 38);
  doc.rect(margin, y, 3, 22, 'F');
  doc.setTextColor(148, 180, 214);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('RECEITA LÍQUIDA DO SEMESTRE', margin + 8, y + 8);
  doc.text('RESULTADO DO SEMESTRE', W / 2 + 4, y + 8);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(fmt(liquidoSemestre), margin + 8, y + 17);
  doc.setTextColor(resultadoSemestre >= 0 ? 134 : 252, resultadoSemestre >= 0 ? 239 : 165, resultadoSemestre >= 0 ? 172 : 165);
  doc.text(fmt(resultadoSemestre), W / 2 + 4, y + 17);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, H - 9, W - margin, H - 9);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.setFont('helvetica', 'normal');
    doc.text('FS — Resultado por Curso', margin, H - 5);
    doc.text(`Página ${i} de ${pages}`, W - margin, H - 5, { align: 'right' });
  }

  doc.save(`resultado-por-curso-${periodo.replace('/', '-')}.pdf`);
}
