import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Pagina5Record } from '@/types/pagina5';
import { ORIGEM_LABEL, ORIGEM_ORDEM, type OrigemCategoria } from '@/utils/classificarOrigemCursos';

export interface OrigemCursosPdfGrupo {
  categoria: OrigemCategoria;
  itens: { r: Pagina5Record; fonte: 'Regra' | 'IA' | '—' }[];
}

const AZUL: [number, number, number] = [3, 105, 161];
const AZUL_CLARO: [number, number, number] = [224, 242, 254];
const VERDE: [number, number, number] = [5, 150, 105];
const CINZA: [number, number, number] = [71, 85, 105];
const LINHA: [number, number, number] = [226, 232, 240];

const fmt = (valor: number) => valor.toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
});

const limpar = (texto: string) => texto.replace(/\s+/g, ' ').trim();

export function exportOrigemCursosPDF(grupos: OrigemCursosPdfGrupo[], total: number) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const anos = Array.from(new Set(grupos.flatMap(g => g.itens.map(i => i.r.year)).filter(Boolean))).sort();
  const periodo = anos.length === 1 ? String(anos[0]) : anos.length ? `${anos[0]}–${anos[anos.length - 1]}` : 'Histórico';

  doc.setFillColor(...AZUL);
  doc.rect(0, 0, largura, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Entradas de Cursos por Origem', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Período: ${periodo}  •  Centro de custo 01-Cursos`, 14, 22);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, largura - 14, 22, { align: 'right' });

  const resumo = ORIGEM_ORDEM.map(categoria => {
    const grupo = grupos.find(g => g.categoria === categoria);
    const valor = grupo?.itens.reduce((s, item) => s + item.r.valorLiquido, 0) ?? 0;
    return [ORIGEM_LABEL[categoria], String(grupo?.itens.length ?? 0), total ? `${((valor / total) * 100).toFixed(1)}%` : '0,0%', fmt(valor)];
  });

  autoTable(doc, {
    startY: 42,
    theme: 'grid',
    head: [['Origem', 'Lançamentos', '% do total', 'Valor']],
    body: resumo,
    foot: [['Total', String(grupos.reduce((s, g) => s + g.itens.length, 0)), '100,0%', fmt(total)]],
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: LINHA, lineWidth: 0.15 },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: AZUL_CLARO, textColor: AZUL, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
    pageBreak: 'avoid',
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  grupos.filter(g => g.itens.length > 0).forEach(grupo => {
    const subtotal = grupo.itens.reduce((s, item) => s + item.r.valorLiquido, 0);
    if (y > altura - 48) {
      doc.addPage();
      y = 18;
    }

    doc.setFillColor(...VERDE);
    doc.roundedRect(14, y - 5, largura - 28, 9, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${ORIGEM_LABEL[grupo.categoria]}  •  ${grupo.itens.length} lançamentos`, 17, y + 0.8);
    doc.text(fmt(subtotal), largura - 17, y + 0.8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 7;

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      head: [['Data', 'Descrição / detalhamento', 'Classificação', 'Valor']],
      body: grupo.itens.map(item => [
        item.r.date,
        limpar([item.r.descricao, item.r.detalhamento].filter(Boolean).join(' — ')),
        item.fonte,
        fmt(item.r.valorLiquido),
      ]),
      foot: [['', `Subtotal ${ORIGEM_LABEL[grupo.categoria]}`, '', fmt(subtotal)]],
      styles: { fontSize: 7.7, cellPadding: 1.8, lineColor: LINHA, lineWidth: 0.12, overflow: 'linebreak' },
      headStyles: { fillColor: CINZA, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: AZUL_CLARO, textColor: AZUL, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 23 },
        1: { cellWidth: 104 },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 31, halign: 'right' },
      },
      margin: { left: 14, right: 14, top: 16, bottom: 14 },
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 11;
  });

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setDrawColor(...LINHA);
    doc.line(14, altura - 11, largura - 14, altura - 11);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Painel Financeiro • Histórico', 14, altura - 6.5);
    doc.text(`Página ${pagina} de ${paginas}`, largura - 14, altura - 6.5, { align: 'right' });
  }

  doc.save(`entradas-cursos-por-origem-${periodo.replace('–', '-')}.pdf`);
}