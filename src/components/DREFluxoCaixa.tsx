import { useMemo, useState } from 'react';
import { Pagina5Record, FluxoCaixaBanco } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Wallet, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, Landmark, FileText, BarChart3, Filter, Building2, ArrowRightLeft } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  data: Pagina5Record[];
  allData?: Pagina5Record[];
  selectedMonth?: string;
  selectedYear?: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Calculate saldo final per banco for a given month's data
const calcSaldoFinalPorBanco = (monthData: Pagina5Record[]): Record<string, number> => {
  const bancos: Record<string, { si: number; rec: number; desp: number; saidas: number; entradas: number; transf: number }> = {};
  const ensure = (b: string) => {
    if (!b || b === 'PROVISAO') return;
    if (!bancos[b]) bancos[b] = { si: 0, rec: 0, desp: 0, saidas: 0, entradas: 0, transf: 0 };
  };

  monthData.forEach(r => {
    if (r.custoNum === 0) { ensure(r.banco); if (bancos[r.banco]) bancos[r.banco].si += r.valorBruto; }
    else if (r.custoNum >= 1 && r.custoNum <= 10 && r.banco !== 'PROVISAO') { ensure(r.banco); if (bancos[r.banco]) bancos[r.banco].rec += r.valorLiquido; }
    else if (r.custoNum >= 11 && r.custoNum <= 20 && (r.banco || '').toUpperCase() !== 'PAGO' && r.banco !== 'PROVISAO') { ensure(r.banco); if (bancos[r.banco]) bancos[r.banco].desp += Math.abs(r.valorLiquido); }
    else if (r.custoNum >= 21 && r.custoNum <= 30 && r.banco !== 'PROVISAO') { ensure(r.banco); if (bancos[r.banco]) bancos[r.banco].saidas += Math.abs(r.valorLiquido); }
    else if ((r.custoNum === 97 || r.custoNum === 98) && r.banco !== 'PROVISAO') { ensure(r.banco); if (bancos[r.banco]) bancos[r.banco].entradas += Math.abs(r.valorLiquido); }
    else if (r.custoNum === 99) { ensure(r.banco); if (bancos[r.banco]) bancos[r.banco].transf += r.valorLiquido; }
  });

  const result: Record<string, number> = {};
  Object.entries(bancos).forEach(([banco, v]) => {
    result[banco] = v.si + v.rec - v.desp - v.saidas + v.entradas + v.transf;
  });
  return result;
};

// Recursively find saldo inicial for a month by computing previous month's saldo final
const calcSaldoInicialTransportado = (
  allData: Pagina5Record[],
  month: number,
  year: number,
  depth: number = 0
): { bancos: Record<string, number>; fromMonth: number; fromYear: number } | null => {
  if (depth > 12) return null;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevData = allData.filter(r => r.month === prevMonth && r.year === prevYear);

  if (prevData.length === 0) return null;

  // Check if prev month has manual saldo inicial
  const prevSaldoInicial = prevData.filter(r => r.custoNum === 0);
  if (prevSaldoInicial.length === 0) {
    // Recursively get saldo inicial for prev month first
    const inherited = calcSaldoInicialTransportado(allData, prevMonth, prevYear, depth + 1);
    if (inherited) {
      // Inject synthetic saldo inicial into prevData for calculation
      const syntheticRecords = Object.entries(inherited.bancos).map(([banco, valor]) => ({
        id: `synthetic-${banco}`, date: '', descricao: 'Saldo Transportado', detalhamento: '',
        custo: '00-Saldo Inicial', custoNum: 0, valorBruto: valor, taxas: 0, acrescimos: 0,
        valorLiquido: valor, banco, impAliq: 0, vrImposto: 0, vendedor: '', vrVendedor: 0,
        mkt: '', vrMkt: 0, month: prevMonth, year: prevYear,
      } as Pagina5Record));
      const augmentedPrevData = [...prevData, ...syntheticRecords];
      return { bancos: calcSaldoFinalPorBanco(augmentedPrevData), fromMonth: prevMonth, fromYear: prevYear };
    }
  }

  return { bancos: calcSaldoFinalPorBanco(prevData), fromMonth: prevMonth, fromYear: prevYear };
};

const DREFluxoCaixa = ({ data, allData, selectedMonth, selectedYear }: Props) => {
  const [selectedBanco, setSelectedBanco] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({});
  const [expandedFluxoRow, setExpandedFluxoRow] = useState<string | null>(null);

  const toggleFluxoRow = (key: string) => setExpandedFluxoRow(prev => prev === key ? null : key);

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleCourse = (key: string) => setOpenCourses(prev => ({ ...prev, [key]: !prev[key] }));

  // Check if saldo inicial needs to be transported from previous month
  const saldoTransportado = useMemo(() => {
    const manualSaldo = data.filter(r => r.custoNum === 0);
    if (manualSaldo.length > 0 || !allData || !selectedMonth || !selectedYear) return null;

    const m = parseInt(selectedMonth);
    const y = parseInt(selectedYear);
    return calcSaldoInicialTransportado(allData, m, y);
  }, [data, allData, selectedMonth, selectedYear]);

  const grouped = useMemo(() => {
    let saldoInicial = data.filter(r => r.custoNum === 0);

    // If no manual saldo inicial, inject synthetic records from previous month
    if (saldoInicial.length === 0 && saldoTransportado) {
      saldoInicial = Object.entries(saldoTransportado.bancos)
        .filter(([, valor]) => valor !== 0)
        .map(([banco, valor]) => ({
          id: `transported-${banco}`,
          date: '',
          descricao: 'Saldo Transportado',
          detalhamento: `Transportado de ${MONTH_NAMES[saldoTransportado.fromMonth - 1]}/${saldoTransportado.fromYear}`,
          custo: '00-Saldo Inicial',
          custoNum: 0,
          valorBruto: valor,
          taxas: 0,
          acrescimos: 0,
          valorLiquido: valor,
          banco,
          impAliq: 0,
          vrImposto: 0,
          vendedor: '',
          vrVendedor: 0,
          mkt: '',
          vrMkt: 0,
          month: parseInt(selectedMonth || '0'),
          year: parseInt(selectedYear || '0'),
        } as Pagina5Record));
    }

    const receitas: Record<string, Pagina5Record[]> = {};
    const despesas: Record<string, Pagina5Record[]> = {};
    const saidasCaixa: Record<string, Pagina5Record[]> = {};
    const entradasCaixa: Record<string, Pagina5Record[]> = {};
    const transferencias = data.filter(r => r.custoNum === 99);

    const provisoes: Record<string, Pagina5Record[]> = {};

    data.forEach(r => {
      if (r.custoNum >= 1 && r.custoNum <= 10) {
        if (!receitas[r.custo]) receitas[r.custo] = [];
        receitas[r.custo].push(r);
      } else if (r.custoNum >= 11 && r.custoNum <= 20 && (r.banco || '').toUpperCase() !== 'PAGO') {
        if (!despesas[r.custo]) despesas[r.custo] = [];
        despesas[r.custo].push(r);
      } else if (r.custoNum >= 21 && r.custoNum <= 30) {
        if (!saidasCaixa[r.custo]) saidasCaixa[r.custo] = [];
        saidasCaixa[r.custo].push(r);
      } else if (r.custoNum === 31 && (r.banco || '').toUpperCase() === 'PROVISAO') {
        if (!provisoes[r.custo]) provisoes[r.custo] = [];
        provisoes[r.custo].push(r);
      } else if (r.custoNum === 97 || r.custoNum === 98) {
        if (!entradasCaixa[r.custo]) entradasCaixa[r.custo] = [];
        entradasCaixa[r.custo].push(r);
      }
    });

    return { saldoInicial, receitas, despesas, saidasCaixa, entradasCaixa, provisoes, transferencias };
  }, [data, saldoTransportado, selectedMonth, selectedYear]);

  // Aggregate all revenue items by course name across all revenue cost centers
  const receitasPorCurso = useMemo(() => {
    const allReceitas = Object.values(grouped.receitas).flat();
    const map = new Map<string, {
      nome: string;
      qtd: number;
      bruto: number;
      taxas: number;
      acrescimos: number;
      liquido: number;
      impostos: number;
      comVendedor: number;
      resultado: number;
      vendas: Pagina5Record[];
    }>();

    allReceitas.forEach(r => {
      const key = r.descricao || 'Sem descrição';
      if (!map.has(key)) {
        map.set(key, { nome: key, qtd: 0, bruto: 0, taxas: 0, acrescimos: 0, liquido: 0, impostos: 0, comVendedor: 0, resultado: 0, vendas: [] });
      }
      const c = map.get(key)!;
      c.qtd++;
      c.bruto += r.valorBruto;
      c.taxas += r.taxas;
      c.acrescimos += r.acrescimos;
      c.liquido += r.valorLiquido;
      c.impostos += r.vrImposto;
      c.comVendedor += r.vendedor ? r.vrVendedor : 0;
      c.vendas.push(r);
    });

    map.forEach(c => {
      c.resultado = c.liquido - c.impostos - c.comVendedor;
    });

    return Array.from(map.values()).sort((a, b) => b.bruto - a.bruto);
  }, [grouped.receitas]);

  const totals = useMemo(() => {
    const totalSaldoInicial = grouped.saldoInicial.reduce((s, r) => s + r.valorBruto, 0);

    const totalBrutoReceitas = receitasPorCurso.reduce((s, c) => s + c.bruto, 0);
    const totalTaxasReceitas = receitasPorCurso.reduce((s, c) => s + c.taxas, 0);
    const totalAcrescimosReceitas = receitasPorCurso.reduce((s, c) => s + c.acrescimos, 0);
    const totalLiquidoReceitas = receitasPorCurso.reduce((s, c) => s + c.liquido, 0);
    const totalImpostosReceitas = receitasPorCurso.reduce((s, c) => s + c.impostos, 0);
    const totalComVendedor = receitasPorCurso.reduce((s, c) => s + c.comVendedor, 0);
    const totalResultadoReceitas = receitasPorCurso.reduce((s, c) => s + c.resultado, 0);

    let totalDespesas = 0;
    Object.values(grouped.despesas).forEach(items => {
      items.forEach(r => { totalDespesas += Math.abs(r.valorLiquido); });
    });

    const resultadoMes = totalResultadoReceitas - totalDespesas;

    // Provisões (custoNum 31, banco=PROVISAO) - diminui resultado mas NÃO afeta fluxo de caixa
    let totalProvisoes = 0;
    Object.values(grouped.provisoes).forEach(items => {
      items.forEach(r => { totalProvisoes += Math.abs(r.valorLiquido); });
    });
    const resultadoAposProvisoes = resultadoMes - totalProvisoes;

    // Saídas de caixa (21-30) - valores absolutos
    let totalSaidasCaixa = 0;
    Object.values(grouped.saidasCaixa).forEach(items => {
      items.forEach(r => { totalSaidasCaixa += Math.abs(r.valorLiquido); });
    });

    // Entradas de caixa (97, 98) - valores positivos
    let totalEntradasCaixa = 0;
    Object.values(grouped.entradasCaixa).forEach(items => {
      items.forEach(r => { totalEntradasCaixa += Math.abs(r.valorLiquido); });
    });

    // Transferências (custoNum 99) - excluindo PROVISAO
    const totalTransferencias = grouped.transferencias
      .filter(r => (r.banco || '').toUpperCase() !== 'PROVISAO')
      .reduce((sum, r) => sum + r.valorLiquido, 0);

    const resultadoCaixa = totalLiquidoReceitas - totalDespesas;
    const disponivelAntes = totalSaldoInicial + resultadoCaixa;
    const saldoFinalLivre = disponivelAntes - totalSaidasCaixa + totalEntradasCaixa + totalTransferencias;

    return {
      totalSaldoInicial,
      totalBrutoReceitas, totalTaxasReceitas, totalAcrescimosReceitas, totalLiquidoReceitas,
      totalImpostosReceitas, totalComVendedor, totalResultadoReceitas,
      totalDespesas, resultadoMes, totalProvisoes, resultadoAposProvisoes,
      resultadoCaixa, totalSaidasCaixa, totalEntradasCaixa, totalTransferencias, disponivelAntes, saldoFinalLivre,
    };
  }, [grouped, receitasPorCurso]);

  const fluxoBancos = useMemo(() => {
    const bancos = new Map<string, FluxoCaixaBanco>();
    const ensureBanco = (b: string) => {
      if (!b || b === 'PROVISAO') return;
      if (!bancos.has(b)) {
        bancos.set(b, { banco: b, saldoInicial: 0, receitas: 0, despesas: 0, destinacoes: 0, resgates: 0, transferencias: 0, saldoFinal: 0 });
      }
    };

    grouped.saldoInicial.forEach(r => { ensureBanco(r.banco); const b = bancos.get(r.banco); if (b) b.saldoInicial += r.valorBruto; });
    Object.values(grouped.receitas).flat().forEach(r => { if (r.banco === 'PROVISAO') return; ensureBanco(r.banco); const b = bancos.get(r.banco); if (b) b.receitas += r.valorLiquido; });
    Object.values(grouped.despesas).flat().forEach(r => { if (r.banco === 'PROVISAO') return; ensureBanco(r.banco); const b = bancos.get(r.banco); if (b) b.despesas += Math.abs(r.valorLiquido); });
    Object.values(grouped.saidasCaixa).flat().forEach(r => { if (r.banco === 'PROVISAO') return; ensureBanco(r.banco); const b = bancos.get(r.banco); if (b) b.destinacoes += Math.abs(r.valorLiquido); });
    Object.values(grouped.entradasCaixa).flat().forEach(r => { if (r.banco === 'PROVISAO') return; ensureBanco(r.banco); const b = bancos.get(r.banco); if (b) b.resgates += Math.abs(r.valorLiquido); });
    grouped.transferencias.forEach(r => { ensureBanco(r.banco); const b = bancos.get(r.banco); if (b) b.transferencias += r.valorLiquido; });

    bancos.forEach(b => { b.saldoFinal = b.saldoInicial + b.receitas - b.despesas - b.destinacoes + b.resgates + b.transferencias; });
    return Array.from(bancos.values()).sort((a, b) => a.banco.localeCompare(b.banco));
  }, [grouped]);

  const fluxoTotal = useMemo(() => {
    return fluxoBancos.reduce(
      (acc, b) => ({ saldoInicial: acc.saldoInicial + b.saldoInicial, receitas: acc.receitas + b.receitas, despesas: acc.despesas + b.despesas, destinacoes: acc.destinacoes + b.destinacoes, resgates: acc.resgates + b.resgates, transferencias: acc.transferencias + b.transferencias, saldoFinal: acc.saldoFinal + b.saldoFinal }),
      { saldoInicial: 0, receitas: 0, despesas: 0, destinacoes: 0, resgates: 0, transferencias: 0, saldoFinal: 0 }
    );
  }, [fluxoBancos]);

  const renderItemList = (items: Pagina5Record[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-1">Data</TableHead>
          <TableHead className="text-xs py-1">Descrição</TableHead>
          <TableHead className="text-xs py-1">Detalhe</TableHead>
          <TableHead className="text-xs py-1 text-right">Valor</TableHead>
          <TableHead className="text-xs py-1">Banco</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(r => (
          <TableRow key={r.id}>
            <TableCell className="text-xs py-1">{r.date}</TableCell>
            <TableCell className="text-xs py-1">{r.descricao}</TableCell>
            <TableCell className="text-xs py-1">{r.detalhamento}</TableCell>
            <TableCell className="text-xs py-1 text-right">{fmt(Math.abs(r.valorBruto))}</TableCell>
            <TableCell className="text-xs py-1">
              {r.banco === 'PROVISAO' ? <Badge variant="outline" className="text-xs border-warning text-warning">PROVISÃO</Badge> : r.banco}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderDespesaSection = (custo: string, items: Pagina5Record[], type: 'despesa' | 'saida' | 'entrada') => {
    const isOpen = openSections[custo] ?? false;
    const total = items.reduce((s, r) => s + Math.abs(r.valorBruto), 0);
    const provisionItems = items.filter(r => r.banco === 'PROVISAO');
    const borderColor = type === 'despesa'
      ? 'hsl(var(--destructive))'
      : type === 'saida'
        ? 'hsl(0 70% 50%)'
        : 'hsl(142 70% 35%)';

    return (
      <Card key={custo} className="border-l-4" style={{ borderLeftColor: borderColor }}>
        <Collapsible open={isOpen} onOpenChange={() => toggleSection(custo)}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-sm font-semibold">{custo}</CardTitle>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  {provisionItems.length > 0 && (
                    <Badge variant="outline" className="text-xs border-warning text-warning">{provisionItems.length} provisão</Badge>
                  )}
                </div>
                <span className="font-bold text-sm" style={{ color: type === 'entrada' ? 'hsl(142 70% 35%)' : undefined }}>
                  {type === 'entrada' ? '+' : '-'}{fmt(total)}
                </span>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4">{renderItemList(items)}</CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  // PDF Generation
  const generatePDF = () => {
    const monthName = selectedMonth ? MONTH_NAMES[parseInt(selectedMonth) - 1] : '';
    const year = selectedYear || '';
    const doc = new jsPDF();
    let y = 15;

    const checkPage = (needed: number) => { if (y + needed > 275) { doc.addPage(); y = 15; } };
    const addSectionTitle = (text: string, color?: number[]) => {
      checkPage(15);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(text, 14, y);
      y += 8;
    };
    const addSubtitle = (text: string) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(text, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
    };

    // ══════════════════════════════════════════════
    // PÁGINA 1: DRE (Demonstrativo de Resultado)
    // ══════════════════════════════════════════════
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`DRE + Fluxo de Caixa`, 14, y);
    y += 7;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} ${year}`, 14, y);
    y += 3;
    doc.setDrawColor(0, 100, 180);
    doc.setLineWidth(0.5);
    doc.line(14, y, 196, y);
    y += 8;

    // ── SALDO INICIAL ──
    if (grouped.saldoInicial.length > 0) {
      const saldoRows = grouped.saldoInicial.map(r => [r.banco || r.descricao, fmt(r.valorBruto)]);
      saldoRows.push(['TOTAL SALDO INICIAL', fmt(totals.totalSaldoInicial)]);
      autoTable(doc, {
        startY: y,
        head: [['SALDO INICIAL', 'Valor']],
        body: saldoRows,
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 100, 180], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === saldoRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [230, 240, 255];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── RECEITAS ──
    // Tabela consolidada por curso (igual à tela)
    const cursoRows = receitasPorCurso.map(c => [
      c.nome, String(c.qtd), fmt(c.bruto), `-${fmt(c.taxas)}`,
      c.acrescimos > 0 ? `+${fmt(c.acrescimos)}` : '-',
      fmt(c.liquido), `-${fmt(c.impostos)}`, `-${fmt(c.comVendedor)}`, fmt(c.resultado),
    ]);
    cursoRows.push([
      'TOTAL', '', fmt(totals.totalBrutoReceitas), `-${fmt(totals.totalTaxasReceitas)}`,
      totals.totalAcrescimosReceitas > 0 ? `+${fmt(totals.totalAcrescimosReceitas)}` : '-',
      fmt(totals.totalLiquidoReceitas), `-${fmt(totals.totalImpostosReceitas)}`,
      `-${fmt(totals.totalComVendedor)}`, fmt(totals.totalResultadoReceitas),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Curso / Receita', 'Qtd', 'Bruto', 'Taxas', 'Acrésc.', 'Líquido', 'Impostos', 'Com.Vend', 'Resultado']],
      body: cursoRows,
      theme: 'grid', styles: { fontSize: 7 },
      headStyles: { fillColor: [34, 139, 34], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
        5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === cursoRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [220, 255, 220];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Resumo vertical das receitas (igual ao card na tela)
    const receitaResumo: string[][] = [
      ['Receita Bruta (vendas)', fmt(totals.totalBrutoReceitas)],
      ['(-) Taxas de Plataforma', `-${fmt(totals.totalTaxasReceitas)}`],
    ];
    if (totals.totalAcrescimosReceitas > 0) {
      receitaResumo.push(['(+) Acréscimos', `+${fmt(totals.totalAcrescimosReceitas)}`]);
    }
    receitaResumo.push(['= Receita Líquida', fmt(totals.totalLiquidoReceitas)]);
    receitaResumo.push(['(-) Impostos', `-${fmt(totals.totalImpostosReceitas)}`]);
    receitaResumo.push(['(-) Comissões Vendedores', `-${fmt(totals.totalComVendedor)}`]);
    receitaResumo.push(['= RECEITA LÍQUIDA FINAL', fmt(totals.totalResultadoReceitas)]);

    autoTable(doc, {
      startY: y,
      body: receitaResumo,
      theme: 'plain', styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 130 }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        const lastIdx = receitaResumo.length - 1;
        const liqIdx = totals.totalAcrescimosReceitas > 0 ? 3 : 2;
        if (data.section === 'body' && (data.row.index === liqIdx || data.row.index === lastIdx)) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = data.row.index === lastIdx ? [220, 255, 220] : [240, 240, 240];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── DESPESAS OPERACIONAIS ──
    checkPage(30);
    const despesasResumo = Object.entries(grouped.despesas)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([custo, items]) => [custo, fmt(items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0))]);
    despesasResumo.push(['TOTAL DESPESAS OPERACIONAIS', fmt(totals.totalDespesas)]);

    autoTable(doc, {
      startY: y,
      head: [['DESPESAS OPERACIONAIS', 'Valor']],
      body: despesasResumo,
      theme: 'grid', styles: { fontSize: 9 },
      headStyles: { fillColor: [200, 50, 50], fontStyle: 'bold', textColor: [255, 255, 255] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === despesasResumo.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [255, 230, 230];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // ── RESULTADO DO MÊS ──
    checkPage(30);
    const resultadoBody: string[][] = [
      ['Receita Líquida Final', fmt(totals.totalResultadoReceitas)],
      ['(-) Despesas Operacionais', `-${fmt(totals.totalDespesas)}`],
      ['= RESULTADO DO MÊS', fmt(totals.resultadoMes)],
    ];
    if (totals.totalProvisoes > 0) {
      resultadoBody.push(['', '']);
      Object.entries(grouped.provisoes).sort(([a], [b]) => a.localeCompare(b)).forEach(([, items]) => {
        items.forEach(r => {
          resultadoBody.push([`   ${r.date} - ${r.descricao} ${r.detalhamento || ''}`, `-${fmt(Math.abs(r.valorLiquido))}`]);
        });
      });
      resultadoBody.push(['(-) Total Provisões', `-${fmt(totals.totalProvisoes)}`]);
      resultadoBody.push(['= RESULTADO COM PROVISÕES', fmt(totals.resultadoAposProvisoes)]);
    }

    autoTable(doc, {
      startY: y,
      head: [['RESULTADO', 'Valor']],
      body: resultadoBody,
      theme: 'grid', styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 66, 66], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === 2) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 11;
          data.cell.styles.fillColor = totals.resultadoMes >= 0 ? [220, 255, 220] : [255, 220, 220];
        }
        if (data.section === 'body' && data.row.index === resultadoBody.length - 1 && totals.totalProvisoes > 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 11;
          data.cell.styles.fillColor = totals.resultadoAposProvisoes >= 0 ? [220, 255, 220] : [255, 220, 220];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ══════════════════════════════════════════════
    // PÁGINA 2: FLUXO DE CAIXA
    // ══════════════════════════════════════════════
    doc.addPage();
    y = 15;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Fluxo de Caixa', 14, y);
    y += 7;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} ${year}`, 14, y);
    y += 3;
    doc.setDrawColor(0, 100, 180);
    doc.setLineWidth(0.5);
    doc.line(14, y, 196, y);
    y += 8;

    // Disponível
    autoTable(doc, {
      startY: y,
      body: [
        ['Saldo Inicial', fmt(totals.totalSaldoInicial)],
        ['(+) Resultado de Caixa (Receitas Líq. - Despesas)', fmt(totals.resultadoCaixa)],
        ['= DISPONÍVEL ANTES DE MOVIMENTAÇÕES', fmt(totals.disponivelAntes)],
      ],
      theme: 'grid', styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === 2) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 240, 255];
          data.cell.styles.fontSize = 11;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Saídas de Caixa
    if (Object.keys(grouped.saidasCaixa).length > 0) {
      const saidasResumo = Object.entries(grouped.saidasCaixa)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([custo, items]) => [custo, `-${fmt(items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0))}`]);
      saidasResumo.push(['TOTAL SAÍDAS DE CAIXA', `-${fmt(totals.totalSaidasCaixa)}`]);

      autoTable(doc, {
        startY: y,
        head: [['SAÍDAS DE CAIXA', 'Valor']],
        body: saidasResumo,
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [200, 50, 50], fontStyle: 'bold', textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === saidasResumo.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 230, 230];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
      addSubtitle('Distribuições, pagamentos externos e outras saídas que não são despesas do mês.');
      y += 3;
    }

    // Entradas de Caixa
    if (Object.keys(grouped.entradasCaixa).length > 0) {
      const entradasResumo = Object.entries(grouped.entradasCaixa)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([custo, items]) => [custo, `+${fmt(items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0))}`]);
      entradasResumo.push(['TOTAL ENTRADAS DE CAIXA', `+${fmt(totals.totalEntradasCaixa)}`]);

      autoTable(doc, {
        startY: y,
        head: [['ENTRADAS DE CAIXA', 'Valor']],
        body: entradasResumo,
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 139, 34], fontStyle: 'bold', textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === entradasResumo.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 255, 220];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
      addSubtitle('Resgates, repasses de terceiros e outras entradas que não são receitas do mês.');
      y += 3;
    }

    // ── RESUMO DO FLUXO DE CAIXA ──
    checkPage(50);
    const fluxoResumo: string[][] = [
      ['Saldo Inicial', fmt(totals.totalSaldoInicial)],
      ['(+) Resultado de Caixa', fmt(totals.resultadoCaixa)],
      ['(-) Saídas de Caixa', `-${fmt(totals.totalSaidasCaixa)}`],
      ['(+) Entradas de Caixa', `+${fmt(totals.totalEntradasCaixa)}`],
    ];
    if (totals.totalTransferencias !== 0) {
      fluxoResumo.push(['(+/-) Transferências', fmt(totals.totalTransferencias)]);
    }
    fluxoResumo.push(['= SALDO FINAL LIVRE', fmt(totals.saldoFinalLivre)]);

    autoTable(doc, {
      startY: y,
      head: [['RESUMO DO FLUXO DE CAIXA', 'Valor']],
      body: fluxoResumo,
      theme: 'grid', styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 51, 102], fontStyle: 'bold', textColor: [255, 255, 255] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        const lastIdx = fluxoResumo.length - 1;
        if (data.section === 'body' && data.row.index === lastIdx) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 12;
          data.cell.styles.fillColor = totals.saldoFinalLivre >= 0 ? [220, 255, 220] : [255, 220, 220];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── SALDO POR BANCO ──
    checkPage(40);
    const bancoRows = fluxoBancos.map(b => {
      const entradas = b.receitas + b.resgates + Math.max(0, b.transferencias);
      const saidas = b.despesas + b.destinacoes + Math.abs(Math.min(0, b.transferencias));
      const saldoFinal = b.saldoInicial + entradas - saidas;
      return [b.banco, fmt(b.saldoInicial), `+${fmt(entradas)}`, `-${fmt(saidas)}`, fmt(saldoFinal)];
    });
    const totEntradas = fluxoBancos.reduce((s, b) => s + b.receitas + b.resgates + Math.max(0, b.transferencias), 0);
    const totSaidas = fluxoBancos.reduce((s, b) => s + b.despesas + b.destinacoes + Math.abs(Math.min(0, b.transferencias)), 0);
    const totSaldoFinal = fluxoTotal.saldoInicial + totEntradas - totSaidas;
    bancoRows.push(['TOTAL', fmt(fluxoTotal.saldoInicial), `+${fmt(totEntradas)}`, `-${fmt(totSaidas)}`, fmt(totSaldoFinal)]);

    autoTable(doc, {
      startY: y,
      head: [['SALDO POR BANCO', 'Saldo Inicial', '+ Entradas', '- Saídas', 'Saldo Final']],
      body: bancoRows,
      theme: 'grid', styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 100, 180], fontStyle: 'bold', textColor: [255, 255, 255] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === bancoRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 240, 255];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ══════════════════════════════════════════════
    // PÁGINAS SEGUINTES: DETALHAMENTO
    // ══════════════════════════════════════════════
    doc.addPage();
    y = 15;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalhamento', 14, y);
    y += 7;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} ${year}`, 14, y);
    y += 3;
    doc.setDrawColor(0, 100, 180);
    doc.setLineWidth(0.5);
    doc.line(14, y, 196, y);
    y += 8;

    // ── Detalhamento Receitas por Curso ──
    addSectionTitle('RECEITAS POR CURSO');
    receitasPorCurso.forEach(c => {
      checkPage(25);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${c.nome} (${c.qtd} vendas)`, 14, y);
      y += 5;
      const rows = c.vendas.map(v => [
        v.date, v.detalhamento || '-',
        fmt(v.valorBruto), v.taxas > 0 ? `-${fmt(v.taxas)}` : '-',
        v.acrescimos > 0 ? `+${fmt(v.acrescimos)}` : '-',
        fmt(v.valorLiquido), v.vendedor || '-', v.banco,
      ]);
      rows.push(['', 'TOTAL', fmt(c.bruto), `-${fmt(c.taxas)}`, c.acrescimos > 0 ? `+${fmt(c.acrescimos)}` : '-', fmt(c.liquido), '', '']);
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Aluno', 'Bruto', 'Taxas', 'Acrésc.', 'Líquido', 'Vendedor', 'Banco']],
        body: rows,
        theme: 'striped', styles: { fontSize: 7 },
        headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === rows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    });

    // ── Detalhamento Despesas ──
    checkPage(15);
    addSectionTitle('DESPESAS OPERACIONAIS');
    Object.entries(grouped.despesas).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
      checkPage(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(custo, 14, y);
      y += 5;
      const rows = items.map(r => [r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorLiquido)), r.banco]);
      const total = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
      rows.push(['', '', 'TOTAL', fmt(total), '']);
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']],
        body: rows,
        theme: 'striped', styles: { fontSize: 7 },
        headStyles: { fillColor: [200, 50, 50], textColor: [255, 255, 255] },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === rows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    });

    // ── Detalhamento Saídas de Caixa ──
    if (Object.keys(grouped.saidasCaixa).length > 0) {
      checkPage(15);
      addSectionTitle('SAÍDAS DE CAIXA');
      Object.entries(grouped.saidasCaixa).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
        checkPage(20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(custo, 14, y);
        y += 5;
        const rows = items.map(r => [r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorLiquido)), r.banco]);
        autoTable(doc, {
          startY: y,
          head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']],
          body: rows,
          theme: 'striped', styles: { fontSize: 7 },
          headStyles: { fillColor: [180, 80, 80], textColor: [255, 255, 255] },
          columnStyles: { 3: { halign: 'right' } },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      });
    }

    // ── Detalhamento Entradas de Caixa ──
    if (Object.keys(grouped.entradasCaixa).length > 0) {
      checkPage(15);
      addSectionTitle('ENTRADAS DE CAIXA');
      Object.entries(grouped.entradasCaixa).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
        checkPage(20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(custo, 14, y);
        y += 5;
        const rows = items.map(r => [r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorLiquido)), r.banco]);
        autoTable(doc, {
          startY: y,
          head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']],
          body: rows,
          theme: 'striped', styles: { fontSize: 7 },
          headStyles: { fillColor: [34, 120, 34], textColor: [255, 255, 255] },
          columnStyles: { 3: { halign: 'right' } },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      });
    }

    doc.save(`DRE_FluxoCaixa_${monthName}_${year}.pdf`);
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Nenhum dado encontrado para o período selecionado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* PDF Button */}
      <div className="flex justify-end">
        <Button onClick={generatePDF} variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Gerar PDF
        </Button>
      </div>

      {/* SALDO INICIAL - Colapsável */}
      {grouped.saldoInicial.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <div className="flex justify-between items-center py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">SALDO INICIAL</span>
                  {saldoTransportado && (
                    <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                      Transportado de {MONTH_NAMES[saldoTransportado.fromMonth - 1]}/{saldoTransportado.fromYear}
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-bold text-primary">{fmt(totals.totalSaldoInicial)}</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {grouped.saldoInicial.map(r => (
                    <div key={r.id} className="flex justify-between items-center p-2 rounded bg-muted/50">
                      <span className="text-xs font-medium">{r.banco || r.descricao}</span>
                      <span className="text-sm font-bold">{fmt(r.valorBruto)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* RECEITAS - Tabela consolidada por curso */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" style={{ color: 'hsl(var(--success))' }} />
          <h3 className="text-lg font-bold">RECEITAS</h3>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Curso / Receita</TableHead>
                    <TableHead className="text-xs text-center">Qtd</TableHead>
                    <TableHead className="text-xs text-right">Bruto</TableHead>
                    <TableHead className="text-xs text-right">Taxas</TableHead>
                    <TableHead className="text-xs text-right">Acrésc.</TableHead>
                    <TableHead className="text-xs text-right">Líquido</TableHead>
                    <TableHead className="text-xs text-right">Impostos</TableHead>
                    <TableHead className="text-xs text-right">Com. Vend.</TableHead>
                    <TableHead className="text-xs text-right">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receitasPorCurso.map(c => {
                    const isOpen = openCourses[c.nome] ?? false;
                    return (
                      <>
                        <TableRow
                          key={c.nome}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleCourse(c.nome)}
                        >
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-center gap-1">
                              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              {c.nome}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge variant="secondary" className="text-xs">{c.qtd}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right">{fmt(c.bruto)}</TableCell>
                          <TableCell className="text-xs text-right" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(c.taxas)}</TableCell>
                          <TableCell className="text-xs text-right" style={{ color: c.acrescimos > 0 ? 'hsl(142 70% 35%)' : undefined }}>{c.acrescimos > 0 ? `+${fmt(c.acrescimos)}` : '-'}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{fmt(c.liquido)}</TableCell>
                          <TableCell className="text-xs text-right" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(c.impostos)}</TableCell>
                          <TableCell className="text-xs text-right" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(c.comVendedor)}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-primary">{fmt(c.resultado)}</TableCell>
                        </TableRow>
                        {isOpen && c.vendas.map(v => (
                          <TableRow key={v.id} className="bg-muted/20">
                            <TableCell className="text-xs pl-8">{v.date} - {v.detalhamento}</TableCell>
                            <TableCell className="text-xs text-center">{v.vendedor || '-'}</TableCell>
                            <TableCell className="text-xs text-right">{fmt(v.valorBruto)}</TableCell>
                            <TableCell className="text-xs text-right">{v.taxas > 0 ? `-${fmt(v.taxas)}` : '-'}</TableCell>
                            <TableCell className="text-xs text-right">{v.acrescimos > 0 ? `+${fmt(v.acrescimos)}` : '-'}</TableCell>
                            <TableCell className="text-xs text-right">{fmt(v.valorLiquido)}</TableCell>
                            <TableCell className="text-xs text-right">{v.vrImposto > 0 ? `-${fmt(v.vrImposto)}` : '-'}</TableCell>
                            <TableCell className="text-xs text-right">{v.vrVendedor > 0 ? `-${fmt(v.vrVendedor)}` : '-'}</TableCell>
                            <TableCell className="text-xs text-right">{fmt(v.valorLiquido - v.vrImposto - v.vrVendedor)}</TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="text-xs font-bold" colSpan={2}>TOTAL RECEITAS</TableCell>
                    <TableCell className="text-xs text-right font-bold">{fmt(totals.totalBrutoReceitas)}</TableCell>
                    <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totals.totalTaxasReceitas)}</TableCell>
                    <TableCell className="text-xs text-right font-bold" style={{ color: totals.totalAcrescimosReceitas > 0 ? 'hsl(142 70% 35%)' : undefined }}>{totals.totalAcrescimosReceitas > 0 ? `+${fmt(totals.totalAcrescimosReceitas)}` : '-'}</TableCell>
                    <TableCell className="text-xs text-right font-bold">{fmt(totals.totalLiquidoReceitas)}</TableCell>
                    <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totals.totalImpostosReceitas)}</TableCell>
                    <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totals.totalComVendedor)}</TableCell>
                    <TableCell className="text-xs text-right font-bold text-primary">{fmt(totals.totalResultadoReceitas)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Demonstrativo vertical resumido */}
        <Card className="border bg-muted/20">
          <CardContent className="p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-xs">Receita Bruta (vendas)</span><span className="text-xs font-semibold">{fmt(totals.totalBrutoReceitas)}</span></div>
            <div className="flex justify-between"><span className="text-xs">(-) Taxas de Plataforma</span><span className="text-xs font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totals.totalTaxasReceitas)}</span></div>
            {totals.totalAcrescimosReceitas > 0 && (
              <div className="flex justify-between"><span className="text-xs">(+) Acréscimos</span><span className="text-xs font-semibold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(totals.totalAcrescimosReceitas)}</span></div>
            )}
            <div className="border-t my-1" />
            <div className="flex justify-between font-bold"><span className="text-xs">= Receita Líquida</span><span className="text-xs">{fmt(totals.totalLiquidoReceitas)}</span></div>
            <div className="flex justify-between"><span className="text-xs">(-) Impostos</span><span className="text-xs font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totals.totalImpostosReceitas)}</span></div>
            <div className="flex justify-between"><span className="text-xs">(-) Comissões Vendedores</span><span className="text-xs font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totals.totalComVendedor)}</span></div>
            <div className="border-t my-1" />
            <div className="flex justify-between font-bold text-sm"><span>= RECEITA LÍQUIDA FINAL</span><span className="text-primary">{fmt(totals.totalResultadoReceitas)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* DESPESAS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" style={{ color: 'hsl(var(--destructive))' }} />
          <h3 className="text-lg font-bold">DESPESAS</h3>
          <span className="font-bold" style={{ color: 'hsl(var(--destructive))' }}>{fmt(totals.totalDespesas)}</span>
        </div>
        {Object.entries(grouped.despesas)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([custo, items]) => renderDespesaSection(custo, items, 'despesa'))}
      </div>

      {/* RESULTADO DRE */}
      <Card className={`border-2 ${(totals.totalProvisoes > 0 ? totals.resultadoAposProvisoes : totals.resultadoMes) >= 0 ? 'border-primary' : 'border-destructive'}`}>
        <CardContent className="p-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Receita Líquida Final</span><span className="font-bold">{fmt(totals.totalResultadoReceitas)}</span></div>
            <div className="flex justify-between"><span>(-) Despesas Operacionais</span><span className="font-bold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totals.totalDespesas)}</span></div>
            <div className="border-t my-2" />
            <div className="flex justify-between text-lg font-bold">
              <span>= RESULTADO DO MÊS</span>
              <span className={totals.resultadoMes >= 0 ? 'text-primary' : ''} style={totals.resultadoMes < 0 ? { color: 'hsl(var(--destructive))' } : {}}>
                {fmt(totals.resultadoMes)}
              </span>
            </div>

            {/* Provisões dentro do card de resultado */}
            {totals.totalProvisoes > 0 && (
              <>
                <div className="border-t my-2 border-dashed" />
                <div className="text-xs text-muted-foreground font-semibold mt-2">PROVISÕES (não afetam o fluxo de caixa)</div>
                {Object.entries(grouped.provisoes).sort(([a], [b]) => a.localeCompare(b)).map(([custo, items]) => (
                  <div key={custo}>
                    {items.map(r => (
                      <div key={r.id} className="flex justify-between text-xs pl-2">
                        <span>{r.date} - {r.descricao} {r.detalhamento ? `(${r.detalhamento})` : ''}</span>
                        <span style={{ color: 'hsl(var(--destructive))' }}>-{fmt(Math.abs(r.valorLiquido))}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold">
                  <span>(-) Total Provisões</span>
                  <span style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totals.totalProvisoes)}</span>
                </div>
                <div className="border-t my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>= RESULTADO COM PROVISÕES</span>
                  <span className={totals.resultadoAposProvisoes >= 0 ? 'text-primary' : ''} style={totals.resultadoAposProvisoes < 0 ? { color: 'hsl(var(--destructive))' } : {}}>
                    {fmt(totals.resultadoAposProvisoes)}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══════ FLUXO DE CAIXA ═══════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-t-2 border-b-2 border-primary/30 py-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">FLUXO DE CAIXA</h2>
        </div>

        {/* ══════ FILTRO POR BANCO ══════ */}
        {fluxoBancos.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Filtrar por banco:</span>
            <Button
              variant={selectedBanco === null ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedBanco(null)}
            >
              Todos
            </Button>
            {fluxoBancos.map(b => (
              <Button
                key={b.banco}
                variant={selectedBanco === b.banco ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedBanco(prev => prev === b.banco ? null : b.banco)}
              >
                <Building2 className="h-3 w-3 mr-1" />
                {b.banco}
              </Button>
            ))}
          </div>
        )}

        {/* ══════ CARDS RESUMO POR BANCO ══════ */}
        {(() => {
          const bancosToShow = selectedBanco
            ? fluxoBancos.filter(b => b.banco === selectedBanco)
            : fluxoBancos;

          const consolidado = bancosToShow.reduce(
            (acc, b) => ({
              saldoInicial: acc.saldoInicial + b.saldoInicial,
              receitas: acc.receitas + b.receitas,
              despesas: acc.despesas + b.despesas,
              destinacoes: acc.destinacoes + b.destinacoes,
              resgates: acc.resgates + b.resgates,
              transferencias: acc.transferencias + b.transferencias,
              saldoFinal: acc.saldoFinal + b.saldoFinal,
            }),
            { saldoInicial: 0, receitas: 0, despesas: 0, destinacoes: 0, resgates: 0, transferencias: 0, saldoFinal: 0 }
          );

          const renderBankCard = (banco: string, si: number, entradas: number, saidas: number, sf: number, isTotal = false) => {
            const maxVal = Math.max(entradas, saidas, 1);
            const entPct = Math.round((entradas / maxVal) * 100);
            const saiPct = Math.round((saidas / maxVal) * 100);
            return (
              <Card key={banco} className={`border-l-4 ${isTotal ? 'border-l-primary bg-primary/5' : 'border-l-muted-foreground/30'}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {isTotal ? <Landmark className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                    <span className={`text-sm font-bold ${isTotal ? 'text-primary' : ''}`}>{banco}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo Inicial</div>
                      <div className="text-sm font-semibold">{fmt(si)}</div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo Final</div>
                      <div className={`text-sm font-bold ${sf >= 0 ? 'text-primary' : ''}`} style={sf < 0 ? { color: 'hsl(var(--destructive))' } : {}}>{fmt(sf)}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" style={{ color: 'hsl(142 70% 35%)' }} />
                        Entradas
                      </span>
                      <span className="font-semibold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(entradas)}</span>
                    </div>
                    <Progress value={entPct} className="h-2 bg-muted" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" style={{ color: 'hsl(var(--destructive))' }} />
                        Saídas
                      </span>
                      <span className="font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(saidas)}</span>
                    </div>
                    <Progress value={saiPct} className="h-2 bg-muted [&>div]:bg-destructive" />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t">
                    <span>Variação</span>
                    <span className={`font-bold text-xs ${(entradas - saidas) >= 0 ? '' : ''}`} style={{ color: (entradas - saidas) >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                      {(entradas - saidas) >= 0 ? '+' : ''}{fmt(entradas - saidas)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          };

          return (
            <div className={`grid gap-3 ${selectedBanco ? 'grid-cols-1' : bancosToShow.length <= 3 ? `grid-cols-1 md:grid-cols-${bancosToShow.length + 1}` : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
              {!selectedBanco && renderBankCard(
                'CONSOLIDADO',
                consolidado.saldoInicial,
                consolidado.receitas + consolidado.resgates + Math.max(0, consolidado.transferencias),
                consolidado.despesas + consolidado.destinacoes + Math.abs(Math.min(0, consolidado.transferencias)),
                consolidado.saldoFinal,
                true
              )}
              {bancosToShow.map(b => {
                const ent = b.receitas + b.resgates + Math.max(0, b.transferencias);
                const sai = b.despesas + b.destinacoes + Math.abs(Math.min(0, b.transferencias));
                return renderBankCard(b.banco, b.saldoInicial, ent, sai, b.saldoFinal);
              })}
            </div>
          );
        })()}

        {/* ══════ MOVIMENTAÇÕES DO PERÍODO ══════ */}
        {(() => {
          type Movement = Pagina5Record & { tipo: string; tipoColor: string; isEntrada: boolean };
          const movements: Movement[] = [];

          const addMovements = (records: Pagina5Record[], tipo: string, tipoColor: string, isEntrada: boolean) => {
            records.forEach(r => {
              if (r.banco === 'PROVISAO') return;
              if (selectedBanco && r.banco !== selectedBanco) return;
              movements.push({ ...r, tipo, tipoColor, isEntrada });
            });
          };

          Object.values(grouped.receitas).flat().forEach(r => {
            if (r.banco === 'PROVISAO') return;
            if (selectedBanco && r.banco !== selectedBanco) return;
            movements.push({ ...r, tipo: 'Receita', tipoColor: 'hsl(142 70% 35%)', isEntrada: true });
          });
          Object.values(grouped.despesas).flat().forEach(r => {
            if (r.banco === 'PROVISAO') return;
            if (selectedBanco && r.banco !== selectedBanco) return;
            movements.push({ ...r, tipo: 'Despesa', tipoColor: 'hsl(var(--destructive))', isEntrada: false });
          });
          Object.values(grouped.saidasCaixa).flat().forEach(r => {
            if (r.banco === 'PROVISAO') return;
            if (selectedBanco && r.banco !== selectedBanco) return;
            movements.push({ ...r, tipo: 'Saída Caixa', tipoColor: 'hsl(0 70% 50%)', isEntrada: false });
          });
          Object.values(grouped.entradasCaixa).flat().forEach(r => {
            if (r.banco === 'PROVISAO') return;
            if (selectedBanco && r.banco !== selectedBanco) return;
            movements.push({ ...r, tipo: 'Entrada Caixa', tipoColor: 'hsl(142 70% 35%)', isEntrada: true });
          });
          grouped.transferencias.filter(r => (r.banco || '').toUpperCase() !== 'PROVISAO').forEach(r => {
            if (selectedBanco && r.banco !== selectedBanco) return;
            movements.push({ ...r, tipo: 'Transferência', tipoColor: 'hsl(210 70% 50%)', isEntrada: r.valorLiquido >= 0 });
          });

          movements.sort((a, b) => {
            if (a.date && b.date) return a.date.localeCompare(b.date);
            return 0;
          });

          // Calculate saldo acumulado
          const saldoInicialFiltrado = selectedBanco
            ? grouped.saldoInicial.filter(r => r.banco === selectedBanco).reduce((s, r) => s + r.valorBruto, 0)
            : totals.totalSaldoInicial;

          let saldoAcum = saldoInicialFiltrado;
          const movementsWithSaldo = movements.map(m => {
            const valor = m.isEntrada ? Math.abs(m.valorLiquido) : -Math.abs(m.valorLiquido);
            saldoAcum += valor;
            return { ...m, saldoAcumulado: saldoAcum };
          });

          // Group by tipo for subtotals
          const subtotais = new Map<string, { total: number; count: number; color: string }>();
          movements.forEach(m => {
            if (!subtotais.has(m.tipo)) subtotais.set(m.tipo, { total: 0, count: 0, color: m.tipoColor });
            const st = subtotais.get(m.tipo)!;
            st.count++;
            st.total += m.isEntrada ? Math.abs(m.valorLiquido) : -Math.abs(m.valorLiquido);
          });

          return (
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-bold">MOVIMENTAÇÕES DO PERÍODO</CardTitle>
                    <Badge variant="secondary" className="text-xs">{movements.length} itens</Badge>
                    {selectedBanco && <Badge className="text-xs">{selectedBanco}</Badge>}
                  </div>
                </div>
                {/* Subtotais por tipo */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {Array.from(subtotais.entries()).map(([tipo, st]) => (
                    <div key={tipo} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-full px-2.5 py-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                      <span className="font-medium">{tipo}</span>
                      <span className="text-muted-foreground">({st.count})</span>
                      <span className="font-bold" style={{ color: st.color }}>{fmt(st.total)}</span>
                    </div>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1.5 w-16">Data</TableHead>
                        <TableHead className="text-xs py-1.5 w-24">Tipo</TableHead>
                        <TableHead className="text-xs py-1.5">Descrição</TableHead>
                        <TableHead className="text-xs py-1.5">Detalhe</TableHead>
                        <TableHead className="text-xs py-1.5 text-right w-24">Entrada</TableHead>
                        <TableHead className="text-xs py-1.5 text-right w-24">Saída</TableHead>
                        <TableHead className="text-xs py-1.5 text-right w-28">Saldo Acum.</TableHead>
                        {!selectedBanco && <TableHead className="text-xs py-1.5 w-20">Banco</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Linha de saldo inicial */}
                      <TableRow className="bg-primary/5">
                        <TableCell className="text-xs py-1.5 font-medium">—</TableCell>
                        <TableCell className="text-xs py-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Saldo Inicial</Badge>
                        </TableCell>
                        <TableCell colSpan={2} className="text-xs py-1.5 font-medium">Saldo transportado</TableCell>
                        <TableCell className="text-xs py-1.5 text-right" />
                        <TableCell className="text-xs py-1.5 text-right" />
                        <TableCell className="text-xs py-1.5 text-right font-bold">{fmt(saldoInicialFiltrado)}</TableCell>
                        {!selectedBanco && <TableCell className="text-xs py-1.5" />}
                      </TableRow>
                      {movementsWithSaldo.map((m, i) => (
                        <TableRow key={`${m.id}-${i}`} className="hover:bg-muted/30">
                          <TableCell className="text-xs py-1.5">{m.date}</TableCell>
                          <TableCell className="text-xs py-1.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border" style={{ borderColor: m.tipoColor, color: m.tipoColor }}>
                              {m.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs py-1.5 max-w-[200px] truncate" title={m.descricao}>{m.descricao}</TableCell>
                          <TableCell className="text-xs py-1.5 max-w-[150px] truncate text-muted-foreground" title={m.detalhamento}>{m.detalhamento}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-medium" style={m.isEntrada ? { color: 'hsl(142 70% 35%)' } : {}}>
                            {m.isEntrada ? `+${fmt(Math.abs(m.valorLiquido))}` : ''}
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-medium" style={!m.isEntrada ? { color: 'hsl(var(--destructive))' } : {}}>
                            {!m.isEntrada ? `-${fmt(Math.abs(m.valorLiquido))}` : ''}
                          </TableCell>
                          <TableCell className={`text-xs py-1.5 text-right font-semibold ${m.saldoAcumulado >= 0 ? '' : ''}`} style={{ color: m.saldoAcumulado >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                            {fmt(m.saldoAcumulado)}
                          </TableCell>
                          {!selectedBanco && <TableCell className="text-xs py-1.5 font-medium">{m.banco}</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-primary/10">
                        <TableCell colSpan={2} className="text-xs font-bold">TOTAL</TableCell>
                        <TableCell colSpan={2} className="text-xs" />
                        <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(142 70% 35%)' }}>
                          +{fmt(movements.filter(m => m.isEntrada).reduce((s, m) => s + Math.abs(m.valorLiquido), 0))}
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(var(--destructive))' }}>
                          -{fmt(movements.filter(m => !m.isEntrada).reduce((s, m) => s + Math.abs(m.valorLiquido), 0))}
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold" style={{ color: (movementsWithSaldo[movementsWithSaldo.length - 1]?.saldoAcumulado ?? saldoInicialFiltrado) >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                          {fmt(movementsWithSaldo[movementsWithSaldo.length - 1]?.saldoAcumulado ?? saldoInicialFiltrado)}
                        </TableCell>
                        {!selectedBanco && <TableCell className="text-xs" />}
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* ══════ CONCILIAÇÃO BANCÁRIA ══════ */}
        {fluxoBancos.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold">CONCILIAÇÃO BANCÁRIA</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Detalhamento completo por banco com todas as categorias de movimentação</p>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs py-1.5">Banco</TableHead>
                      <TableHead className="text-xs py-1.5 text-right">Saldo Inicial</TableHead>
                      <TableHead className="text-xs py-1.5 text-right">Receitas</TableHead>
                      <TableHead className="text-xs py-1.5 text-right">Despesas</TableHead>
                      <TableHead className="text-xs py-1.5 text-right">Saídas Cx</TableHead>
                      <TableHead className="text-xs py-1.5 text-right">Entradas Cx</TableHead>
                      <TableHead className="text-xs py-1.5 text-right">Transf.</TableHead>
                      <TableHead className="text-xs py-1.5 text-right font-bold">Saldo Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const bancosToShow = selectedBanco ? fluxoBancos.filter(b => b.banco === selectedBanco) : fluxoBancos;
                      const maxReceita = Math.max(...bancosToShow.map(b => b.receitas), 1);
                      const maxDespesa = Math.max(...bancosToShow.map(b => b.despesas), 1);

                      return bancosToShow.map(b => (
                        <TableRow key={b.banco} className="hover:bg-muted/30">
                          <TableCell className="text-xs py-2 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              {b.banco}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs py-2 text-right">{fmt(b.saldoInicial)}</TableCell>
                          <TableCell className="text-xs py-2 text-right">
                            <div className="space-y-1">
                              <span style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(b.receitas)}</span>
                              <div className="w-full bg-muted rounded-full h-1">
                                <div className="h-1 rounded-full" style={{ width: `${(b.receitas / maxReceita) * 100}%`, backgroundColor: 'hsl(142 70% 35%)' }} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs py-2 text-right">
                            <div className="space-y-1">
                              <span style={{ color: 'hsl(var(--destructive))' }}>-{fmt(b.despesas)}</span>
                              <div className="w-full bg-muted rounded-full h-1">
                                <div className="h-1 rounded-full bg-destructive" style={{ width: `${(b.despesas / maxDespesa) * 100}%` }} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs py-2 text-right" style={{ color: 'hsl(0 70% 50%)' }}>
                            {b.destinacoes > 0 ? `-${fmt(b.destinacoes)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-right" style={{ color: 'hsl(142 70% 35%)' }}>
                            {b.resgates > 0 ? `+${fmt(b.resgates)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-right">
                            <span style={{ color: b.transferencias >= 0 ? 'hsl(210 70% 50%)' : 'hsl(var(--destructive))' }}>
                              {b.transferencias !== 0 ? `${b.transferencias >= 0 ? '+' : ''}${fmt(b.transferencias)}` : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs py-2 text-right font-bold" style={{ color: b.saldoFinal >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                            {fmt(b.saldoFinal)}
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                  <TableFooter>
                    {(() => {
                      const bancosToShow = selectedBanco ? fluxoBancos.filter(b => b.banco === selectedBanco) : fluxoBancos;
                      const totSI = bancosToShow.reduce((s, b) => s + b.saldoInicial, 0);
                      const totRec = bancosToShow.reduce((s, b) => s + b.receitas, 0);
                      const totDesp = bancosToShow.reduce((s, b) => s + b.despesas, 0);
                      const totDest = bancosToShow.reduce((s, b) => s + b.destinacoes, 0);
                      const totResg = bancosToShow.reduce((s, b) => s + b.resgates, 0);
                      const totTransf = bancosToShow.reduce((s, b) => s + b.transferencias, 0);
                      const totSF = bancosToShow.reduce((s, b) => s + b.saldoFinal, 0);
                      return (
                        <TableRow className="bg-primary/10">
                          <TableCell className="text-xs font-bold">TOTAL</TableCell>
                          <TableCell className="text-xs text-right font-bold">{fmt(totSI)}</TableCell>
                          <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(totRec)}</TableCell>
                          <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totDesp)}</TableCell>
                          <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(0 70% 50%)' }}>{totDest > 0 ? `-${fmt(totDest)}` : '—'}</TableCell>
                          <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(142 70% 35%)' }}>{totResg > 0 ? `+${fmt(totResg)}` : '—'}</TableCell>
                          <TableCell className="text-xs text-right font-bold" style={{ color: totTransf >= 0 ? 'hsl(210 70% 50%)' : 'hsl(var(--destructive))' }}>
                            {totTransf !== 0 ? `${totTransf >= 0 ? '+' : ''}${fmt(totTransf)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold text-primary">{fmt(totSF)}</TableCell>
                        </TableRow>
                      );
                    })()}
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════ RESUMO DO FLUXO (card colapsável existente) ══════ */}
        <Card className="border-2 border-primary">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-bold">RESUMO DO FLUXO DE CAIXA</CardTitle>
            <p className="text-xs text-muted-foreground">Clique em cada linha para ver o detalhamento</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-0">
            {/* Saldo Inicial */}
            <Collapsible open={expandedFluxoRow === 'saldo'} onOpenChange={() => toggleFluxoRow('saldo')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex justify-between items-center text-sm py-2 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-1">
                    {expandedFluxoRow === 'saldo' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span>Saldo Inicial</span>
                  </div>
                  <span className="font-semibold">{fmt(totals.totalSaldoInicial)}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-muted/50 rounded p-3 mb-2 ml-4 space-y-1">
                  {grouped.saldoInicial.map(r => (
                    <div key={r.id} className="flex justify-between text-xs">
                      <span>{r.banco || r.descricao}</span>
                      <span className="font-semibold">{fmt(r.valorBruto)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-1 mt-1 flex justify-between text-xs font-bold">
                    <span>Total</span>
                    <span>{fmt(totals.totalSaldoInicial)}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Resultado de Caixa */}
            <Collapsible open={expandedFluxoRow === 'resultado'} onOpenChange={() => toggleFluxoRow('resultado')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex justify-between items-center text-sm py-2 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-1">
                    {expandedFluxoRow === 'resultado' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span>(+) Resultado de Caixa</span>
                  </div>
                  <span className="font-semibold" style={{ color: totals.resultadoCaixa >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                    {totals.resultadoCaixa >= 0 ? '+' : ''}{fmt(totals.resultadoCaixa)}
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-muted/50 rounded p-3 mb-2 ml-4 space-y-1">
                  <div className="text-xs font-semibold mb-1">Receitas Líquidas:</div>
                  {Object.entries(grouped.receitas).sort(([a], [b]) => a.localeCompare(b)).map(([custo, items]) => (
                    <div key={custo} className="flex justify-between text-xs pl-2">
                      <span>{custo}</span>
                      <span className="font-semibold" style={{ color: 'hsl(142 70% 35%)' }}>{fmt(items.reduce((s, r) => s + r.valorLiquido, 0))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold border-t pt-1">
                    <span>Subtotal Receitas</span>
                    <span style={{ color: 'hsl(142 70% 35%)' }}>{fmt(totals.totalLiquidoReceitas)}</span>
                  </div>
                  <div className="text-xs font-semibold mt-2 mb-1">Despesas:</div>
                  {Object.entries(grouped.despesas).sort(([a], [b]) => a.localeCompare(b)).map(([custo, items]) => (
                    <div key={custo} className="flex justify-between text-xs pl-2">
                      <span>{custo}</span>
                      <span className="font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold border-t pt-1">
                    <span>Subtotal Despesas</span>
                    <span style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totals.totalDespesas)}</span>
                  </div>
                  <div className="border-t-2 border-dashed pt-1 mt-2 flex justify-between text-xs font-bold">
                    <span>= Resultado: {fmt(totals.totalLiquidoReceitas)} - {fmt(totals.totalDespesas)}</span>
                    <span style={{ color: totals.resultadoCaixa >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>{fmt(totals.resultadoCaixa)}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Saídas de Caixa */}
            <Collapsible open={expandedFluxoRow === 'saidas'} onOpenChange={() => toggleFluxoRow('saidas')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex justify-between items-center text-sm py-2 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-1">
                    {expandedFluxoRow === 'saidas' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span>(-) Saídas de Caixa</span>
                  </div>
                  <span className="font-semibold" style={{ color: 'hsl(0 70% 50%)' }}>-{fmt(totals.totalSaidasCaixa)}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-muted/50 rounded p-3 mb-2 ml-4 space-y-1">
                  {Object.entries(grouped.saidasCaixa).sort(([a], [b]) => a.localeCompare(b)).map(([custo, items]) => (
                    <div key={custo} className="flex justify-between text-xs">
                      <span>{custo}</span>
                      <span className="font-semibold" style={{ color: 'hsl(0 70% 50%)' }}>-{fmt(items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0))}</span>
                    </div>
                  ))}
                  {Object.keys(grouped.saidasCaixa).length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhuma saída de caixa no período</span>
                  )}
                  <div className="border-t pt-1 mt-1 flex justify-between text-xs font-bold">
                    <span>Total Saídas</span>
                    <span style={{ color: 'hsl(0 70% 50%)' }}>-{fmt(totals.totalSaidasCaixa)}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Entradas de Caixa */}
            <Collapsible open={expandedFluxoRow === 'entradas'} onOpenChange={() => toggleFluxoRow('entradas')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex justify-between items-center text-sm py-2 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-1">
                    {expandedFluxoRow === 'entradas' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span>(+) Entradas de Caixa</span>
                  </div>
                  <span className="font-semibold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(totals.totalEntradasCaixa)}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-muted/50 rounded p-3 mb-2 ml-4 space-y-1">
                  {Object.entries(grouped.entradasCaixa).sort(([a], [b]) => a.localeCompare(b)).map(([custo, items]) => (
                    <div key={custo} className="flex justify-between text-xs">
                      <span>{custo}</span>
                      <span className="font-semibold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0))}</span>
                    </div>
                  ))}
                  {Object.keys(grouped.entradasCaixa).length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhuma entrada de caixa no período</span>
                  )}
                  <div className="border-t pt-1 mt-1 flex justify-between text-xs font-bold">
                    <span>Total Entradas</span>
                    <span style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(totals.totalEntradasCaixa)}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Transferências */}
            {totals.totalTransferencias !== 0 && (
              <Collapsible open={expandedFluxoRow === 'transferencias'} onOpenChange={() => toggleFluxoRow('transferencias')}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex justify-between items-center text-sm py-2 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-1">
                      {expandedFluxoRow === 'transferencias' ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span>(+/-) Transferências</span>
                    </div>
                    <span className="font-semibold" style={{ color: totals.totalTransferencias >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                      {totals.totalTransferencias >= 0 ? '+' : ''}{fmt(totals.totalTransferencias)}
                    </span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="bg-muted/50 rounded p-3 mb-2 ml-4 space-y-1">
                    {grouped.transferencias.filter(r => (r.banco || '').toUpperCase() !== 'PROVISAO').map(r => (
                      <div key={r.id} className="flex justify-between text-xs">
                        <span>{r.date} - {r.descricao} {r.detalhamento ? `(${r.detalhamento})` : ''} — {r.banco}</span>
                        <span className="font-semibold" style={{ color: r.valorLiquido >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                          {r.valorLiquido >= 0 ? '+' : ''}{fmt(r.valorLiquido)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-1 mt-1 flex justify-between text-xs font-bold">
                      <span>Total Transferências</span>
                      <span style={{ color: totals.totalTransferencias >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                        {totals.totalTransferencias >= 0 ? '+' : ''}{fmt(totals.totalTransferencias)}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Saldo Final */}
            <div className="border-t-2 border-primary my-2" />
            <Collapsible open={expandedFluxoRow === 'saldofinal'} onOpenChange={() => toggleFluxoRow('saldofinal')}>
              <CollapsibleTrigger className="w-full">
                <div className="flex justify-between items-center text-lg font-bold py-1 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-1">
                    {expandedFluxoRow === 'saldofinal' ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span>= SALDO FINAL LIVRE</span>
                  </div>
                  <span className={totals.saldoFinalLivre >= 0 ? 'text-primary' : ''} style={totals.saldoFinalLivre < 0 ? { color: 'hsl(var(--destructive))' } : {}}>
                    {fmt(totals.saldoFinalLivre)}
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-muted/50 rounded p-3 mb-2 ml-4 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Saldo Inicial</span><span className="font-semibold">{fmt(totals.totalSaldoInicial)}</span></div>
                  <div className="flex justify-between"><span>(+) Resultado de Caixa</span><span className="font-semibold">{totals.resultadoCaixa >= 0 ? '+' : ''}{fmt(totals.resultadoCaixa)}</span></div>
                  <div className="flex justify-between"><span>(-) Saídas de Caixa</span><span className="font-semibold">-{fmt(totals.totalSaidasCaixa)}</span></div>
                  <div className="flex justify-between"><span>(+) Entradas de Caixa</span><span className="font-semibold">+{fmt(totals.totalEntradasCaixa)}</span></div>
                  {totals.totalTransferencias !== 0 && (
                    <div className="flex justify-between"><span>(+/-) Transferências</span><span className="font-semibold">{totals.totalTransferencias >= 0 ? '+' : ''}{fmt(totals.totalTransferencias)}</span></div>
                  )}
                  <div className="border-t-2 border-dashed pt-1 mt-1 flex justify-between font-bold text-sm">
                    <span>= {fmt(totals.totalSaldoInicial)} {totals.resultadoCaixa >= 0 ? '+' : ''} {fmt(totals.resultadoCaixa)} - {fmt(totals.totalSaidasCaixa)} + {fmt(totals.totalEntradasCaixa)}{totals.totalTransferencias !== 0 ? ` ${totals.totalTransferencias >= 0 ? '+' : ''} ${fmt(totals.totalTransferencias)}` : ''}</span>
                    <span className={totals.saldoFinalLivre >= 0 ? 'text-primary' : ''} style={totals.saldoFinalLivre < 0 ? { color: 'hsl(var(--destructive))' } : {}}>
                      {fmt(totals.saldoFinalLivre)}
                    </span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DREFluxoCaixa;
