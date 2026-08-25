import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ContratosResumo, MesTurma, Pagina5TurmaResultado } from '@/utils/turma04Overview';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AZUL: [number, number, number] = [14, 116, 144];
const VERDE: [number, number, number] = [22, 128, 96];
const ROXO: [number, number, number] = [109, 40, 217];
const CINZA: [number, number, number] = [55, 65, 81];

export interface VisaoGeralPDFParams {
  contratos: ContratosResumo;
  meses: MesTurma[];
  totalP2: { bruto: number; impostos: number; comVendedor: number; comLad: number; liquido: number; peso: number };
  p5: Pagina5TurmaResultado;
  recebidoMeses: RecebidoMes[];
}

export function exportVisaoGeralTurmaPDF({ contratos, meses, totalP2, p5, recebidoMeses }: VisaoGeralPDFParams) {

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 0;

  // Capa / cabeçalho
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('Visão Geral — FS Turma 04', 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Contratos (Página1) • Recebimentos ago–dez/2025 (Página2) • Resultado ${p5.periodo} (Página5)`,
    14,
    21,
  );
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    pageW - 14,
    21,
    { align: 'right' },
  );
  doc.setTextColor(0, 0, 0);
  y = 38;

  const section = (titulo: string, cor: [number, number, number]) => {
    if (y > 245) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(...cor);
    doc.rect(14, y - 5, pageW - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, 17, y + 0.8);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 8;
  };

  const afterTable = () => {
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  };

  // ── Bloco 1 ──
  section('1. Contratos da turma (Página1)', AZUL);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    head: [['Indicador', 'Valor', 'Alunos']],
    body: [
      ['Receita total contratada', fmt(contratos.totalContratado), String(contratos.totalAlunos)],
      ['Valores recebidos', fmt(contratos.totalRecebido), '—'],
      ['Valores pendentes (em dia)', fmt(contratos.totalPendente), '—'],
      ['Valores vencidos', fmt(contratos.totalVencido), String(contratos.alunosAtraso)],
      ['Distratos — recebido', fmt(contratos.distratoRecebido), String(contratos.alunosDistrato)],
      ['Distratos — perdido (aberto)', fmt(contratos.distratoPerdido), String(contratos.alunosDistrato)],
      ['Já quitados', fmt(contratos.totalQuitado), String(contratos.alunosQuitados)],
      ['Ticket médio por aluno', fmt(contratos.ticketMedio), '—'],
      [
        'Parcelas pagas / total',
        `${contratos.parcelasPagas} de ${contratos.parcelas}`,
        '—',
      ],
    ],
    margin: { left: 14, right: 14 },
    pageBreak: 'avoid',
  });
  afterTable();

  // ── Bloco 2 ──
  section('2. Recebimentos ago–dez/2025 (Página2)', VERDE);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.8, halign: 'right' },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    head: [['Mês', 'Receita bruta', 'Impostos/Taxas', 'Com. vendedores', 'Com. Lance a Dois', 'Receita líquida', '% turma']],
    body: meses.map(m => [
      m.label,
      fmtN(m.bruto),
      fmtN(m.impostos),
      fmtN(m.comVendedor),
      fmtN(m.comLad),
      fmtN(m.liquido),
      `${(m.peso * 100).toFixed(1)}%`,
    ]),
    foot: [[
      'Total',
      fmtN(totalP2.bruto),
      fmtN(totalP2.impostos),
      fmtN(totalP2.comVendedor),
      fmtN(totalP2.comLad),
      fmtN(totalP2.liquido),
      `${(totalP2.peso * 100).toFixed(1)}%`,
    ]],
    footStyles: { fillColor: [209, 250, 229], textColor: 20, fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
    pageBreak: 'avoid',
  });
  afterTable();
  doc.setFontSize(7.5);
  doc.setTextColor(90);
  doc.text(
    'Impostos/taxas e comissões da Página2 não são marcados por turma: rateados pelo peso da receita bruta da turma no mês.',
    14,
    y - 7,
  );
  doc.setTextColor(0);

  // Detalhamento dos recebimentos por mês
  meses
    .filter(m => m.receitas.length > 0)
    .forEach(m => {
      section(`2.${m.month} Recebimentos de ${m.label}/2025`, [21, 128, 61]);
      autoTable(doc, {
        startY: y,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [21, 128, 61], textColor: 255 },
        columnStyles: { 2: { halign: 'right' } },
        head: [['Data', 'Descrição', 'Valor']],
        body: m.receitas.map(l => [l.data, l.descricao, fmtN(l.valor)]),
        foot: [['', 'Subtotal', fmtN(m.bruto)]],
        footStyles: { fillColor: [220, 252, 231], textColor: 20, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
        pageBreak: 'avoid',
      });
      afterTable();
    });

  // ── Bloco 3 ──
  section(`3. Resultado ${p5.periodo} (Página5)`, ROXO);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: ROXO, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    columnStyles: { 1: { halign: 'right' } },
    head: [['Item', 'Valor']],
    body: [
      ['Receita bruta', fmt(p5.bruto)],
      ['Acréscimos (juros/multas)', fmt(p5.acrescimos)],
      ['Taxas', fmt(p5.taxas)],
      ['Receita líquida', fmt(p5.liquido)],
      ['Impostos', fmt(p5.impostos)],
      ['Comissão vendedores', fmt(p5.comVendedor)],
      ['Comissão MKT (Lance a Dois)', fmt(p5.comMkt)],
      ['Despesas de curso (coluna S / hands on)', fmt(p5.despCursos)],
      ['Despesas totais', fmt(p5.despesasTotais)],
      ['Resultado do semestre', fmt(p5.resultado)],
    ],
    margin: { left: 14, right: 14 },
    pageBreak: 'avoid',
  });
  afterTable();

  if (p5.despesasItens.length) {
    section('3.1 Despesas diretas do semestre', [124, 58, 237]);
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255 },
      columnStyles: { 2: { halign: 'right' } },
      head: [['Data', 'Descrição', 'Valor']],
      body: p5.despesasItens.map(l => [l.data, l.descricao, fmtN(l.valor)]),
      foot: [['', 'Subtotal', fmtN(p5.despCursos)]],
      footStyles: { fillColor: [237, 233, 254], textColor: 20, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
      pageBreak: 'avoid',
    });
    afterTable();
  }

  // ── Bloco 4 ──
  section('4. Consolidado da Turma 04', CINZA);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 2.4 },
    headStyles: { fillColor: CINZA, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    head: [['Consolidado', 'Valor']],
    body: [
      ['Total contratado (Página1)', fmt(contratos.totalContratado)],
      ['Recebido até hoje (Página1)', fmt(contratos.totalRecebido)],
      ['Líquido apurado ago–dez/2025 (Página2)', fmt(totalP2.liquido)],
      [`Resultado ${p5.periodo} (Página5)`, fmt(p5.resultado)],
      ['Em aberto (em dia + vencido)', fmt(contratos.totalPendente + contratos.totalVencido)],
      ['Perdido em distratos', fmt(contratos.distratoPerdido)],
    ],
    margin: { left: 14, right: 14 },
    pageBreak: 'avoid',
  });
  afterTable();

  // ── Bloco 5 — Resumo final ──
  const despP2 = totalP2.impostos + totalP2.comVendedor + totalP2.comLad;
  const despP5 = p5.taxas + p5.impostos + p5.comVendedor + p5.comMkt + p5.despCursos;
  const recebido = recebidoMeses.reduce((s, m) => s + m.valor, 0);
  const totalFinal = recebido - despP2 - despP5;

  section('5. Recebimentos por mês (Página1)', VERDE);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    head: [['Mês', 'Parcelas', 'Recebido']],
    body: recebidoMeses.map(m => [m.label, String(m.parcelas), fmt(m.valor)]),
    foot: [[
      'Total recebido',
      String(recebidoMeses.reduce((s, m) => s + m.parcelas, 0)),
      fmt(recebido),
    ]],
    footStyles: { fillColor: [209, 250, 229], textColor: 20, fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
    pageBreak: 'avoid',
  });
  afterTable();

  section('6. Resumo final (ago/2025 a jun/2026)', CINZA);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 2.8 },
    headStyles: { fillColor: CINZA, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold', cellWidth: 45 } },
    head: [['Resumo final', 'Valor']],
    body: [
      ['Total recebido (Página1)', fmt(recebido)],
      ['(-) Despesas ago-dez/2025', fmt(despP2)],
      [`(-) Despesas ${p5.periodo}`, fmt(despP5)],
      ['Total final da Turma 04', fmt(totalFinal)],
    ],
    didParseCell: d => {
      if (d.section !== 'body') return;
      if (d.row.index === 3) {
        d.cell.styles.fillColor = totalFinal >= 0 ? VERDE : [185, 28, 28];
        d.cell.styles.textColor = 255;
        d.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 14, right: 14 },
    pageBreak: 'avoid',
  });



  // Paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Página ${i} de ${total}`,
      pageW - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
  }

  doc.save('visao-geral-turma-04.pdf');
}
