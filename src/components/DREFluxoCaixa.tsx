import { useMemo, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Pagina5Record, FluxoCaixaBanco } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Wallet, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, Landmark, FileText, BarChart3, Building2, ArrowRightLeft, PiggyBank, Package, Banknote } from 'lucide-react';
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
// Ultra-simple: saldo = valorBruto(SI) + sum(valorLiquido) — matches spreadsheet SOMA filter
const calcSaldoFinalPorBanco = (monthData: Pagina5Record[]): Record<string, number> => {
  const NON_BANKS = ['PROVISAO', 'PAGO', 'INVEST', 'L2', ''];
  const bancos: Record<string, number> = {};

  monthData.forEach(r => {
    const banco = (r.banco || '').toUpperCase();
    if (NON_BANKS.includes(banco)) return;
    if (!bancos[r.banco]) bancos[r.banco] = 0;

    if (r.custoNum === 0) {
      bancos[r.banco] += r.valorBruto;
    } else {
      bancos[r.banco] += r.valorLiquido;
    }
  });

  return bancos;
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
  const [investimentoXPAtivo, setInvestimentoXPAtivo] = useState(false);
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
    const investimentos: Pagina5Record[] = [];
    const reservas: Record<string, Pagina5Record[]> = {};
    const lanceADois: Pagina5Record[] = [];
    const despMesSub: Record<string, Pagina5Record[]> = {};
    const investimento34: Record<string, Pagina5Record[]> = {};

    data.forEach(r => {
      if (r.custoNum >= 1 && r.custoNum <= 10) {
        if (!receitas[r.custo]) receitas[r.custo] = [];
        receitas[r.custo].push(r);
      } else if (r.custoNum >= 11 && r.custoNum <= 20 && (r.banco || '').toUpperCase() !== 'PAGO') {
        // Aglutina 15.x dentro de "15-CURSOS"
        const key = r.custoNum === 15 ? '15-CURSOS' : r.custo;
        if (!despesas[key]) despesas[key] = [];
        despesas[key].push(r);
      } else if (r.custoNum >= 21 && r.custoNum <= 30) {
        if (!saidasCaixa[r.custo]) saidasCaixa[r.custo] = [];
        saidasCaixa[r.custo].push(r);
      } else if (r.custoNum === 31 && (r.banco || '').toUpperCase() === 'PROVISAO') {
        if (!provisoes[r.custo]) provisoes[r.custo] = [];
        provisoes[r.custo].push(r);
    } else if (r.custoNum === 32) {
      lanceADois.push(r);
    } else if (r.custoNum === 33) {
      const key = r.descricao || 'Sem descrição';
      if (!despMesSub[key]) despMesSub[key] = [];
      despMesSub[key].push(r);
    } else if (r.custoNum === 34) {
      const key = r.descricao || 'Sem descrição';
      if (!investimento34[key]) investimento34[key] = [];
      investimento34[key].push(r);
    } else if (r.custoNum === 50) {
      investimentos.push(r);
    } else if (r.custoNum === 51 || r.custoNum === 52) {
        if (!reservas[r.custo]) reservas[r.custo] = [];
        reservas[r.custo].push(r);
      } else if (r.custoNum === 96 || r.custoNum === 97 || r.custoNum === 98) {
        if (!entradasCaixa[r.custo]) entradasCaixa[r.custo] = [];
        entradasCaixa[r.custo].push(r);
      }
    });

    return { saldoInicial, receitas, despesas, saidasCaixa, entradasCaixa, provisoes, transferencias, investimentos, reservas, lanceADois, despMesSub, investimento34 };
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

    // Entradas de caixa (96, 97, 98) - valores positivos
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

  // Simple bank balance: iterate ALL records for the month, group by banco, sum values
  // This matches spreadsheet filter logic: filter by banco + month → sum valorLiquido
  const fluxoBancos = useMemo(() => {
    const NON_BANKS = ['PROVISAO', 'PAGO', 'INVEST', 'L2', ''];
    const bancos = new Map<string, FluxoCaixaBanco>();

    const ensure = (b: string) => {
      if (NON_BANKS.includes((b || '').toUpperCase())) return false;
      if (!bancos.has(b)) {
        bancos.set(b, { banco: b, saldoInicial: 0, receitas: 0, despesas: 0, destinacoes: 0, resgates: 0, transferencias: 0, saldoFinal: 0 });
      }
      return true;
    };

    // Include saldo inicial (which may be synthetic/transported)
    grouped.saldoInicial.forEach(r => {
      if (ensure(r.banco)) {
        const b = bancos.get(r.banco)!;
        b.saldoInicial += r.valorBruto;
      }
    });

    // Iterate ALL original data records (not grouped) to catch every custoNum
    data.forEach(r => {
      if (!ensure(r.banco)) return;
      const b = bancos.get(r.banco)!;
      const cn = r.custoNum;

      if (cn === 0) return; // already handled via grouped.saldoInicial
      if (cn >= 1 && cn <= 10) { b.receitas += r.valorLiquido; }
      else if (cn >= 11 && cn <= 20) { b.despesas += Math.abs(r.valorLiquido); }
      else if (cn >= 21 && cn <= 30) { b.destinacoes += Math.abs(r.valorLiquido); }
      else if (cn === 97 || cn === 98) { b.resgates += Math.abs(r.valorLiquido); }
      else if (cn === 99) { b.transferencias += r.valorLiquido; }
      // All other custoNum (31,32,50,51,52 etc) with real banco: count as outflow
      else { b.destinacoes += Math.abs(r.valorLiquido); }
    });

    // saldoFinal = cumulative YTD: filter allData from month 1..selectedMonth for the year + banco
    // This matches spreadsheet logic: filter by banco + months 01..MM → sum all valorLiquido
    const m = parseInt(selectedMonth);
    const y = parseInt(selectedYear);
    bancos.forEach(b => {
      // Get all records for this bank from month 1 to selected month in the selected year
      const ytdRecords = allData.filter(r => r.banco === b.banco && r.year === y && r.month >= 1 && r.month <= m);
      // Saldo inicial = sum of valorBruto for custoNum 0 in the FIRST month that has it
      let saldoInicialYTD = 0;
      let sumVL = 0;
      ytdRecords.forEach(r => {
        if (r.custoNum === 0) {
          saldoInicialYTD += r.valorBruto;
        } else {
          sumVL += r.valorLiquido;
        }
      });
      b.saldoFinal = saldoInicialYTD + sumVL;
    });
    return Array.from(bancos.values()).sort((a, b) => a.banco.localeCompare(b.banco));
  }, [data, allData, selectedMonth, selectedYear, grouped.saldoInicial]);

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
            <CardContent className="pt-0 px-4 pb-4">
              {(() => {
                const subCustos = Array.from(new Set(items.map(i => i.custo)));
                if (subCustos.length <= 1) return renderItemList(items);
                return (
                  <div className="space-y-4">
                    {subCustos.sort().map(sc => {
                      const subItems = items.filter(i => i.custo === sc);
                      const subTotal = subItems.reduce((s, r) => s + Math.abs(r.valorBruto), 0);
                      return (
                        <div key={sc} className="border rounded-md p-2">
                          <div className="flex items-center justify-between mb-1 px-1">
                            <span className="text-xs font-semibold">{sc}</span>
                            <span className="text-xs font-bold">-{fmt(subTotal)}</span>
                          </div>
                          {renderItemList(subItems)}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
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

    // ── INVESTIMENTOS (custoNum 50) ──
    const totalInvestidoPDF = grouped.investimentos.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
    const saldoFinalBancosReaisPDF = fluxoBancos.filter(b => !['INVEST', 'L2', 'PROVISAO'].includes(b.banco.toUpperCase())).reduce((s, b) => s + b.saldoFinal, 0);
    const patrimonioTotalPDF = saldoFinalBancosReaisPDF + totalInvestidoPDF;
    const totalProvisao32PDF = grouped.lanceADois.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
    const patrimonioLiquidoPDF = patrimonioTotalPDF - totalProvisao32PDF;
    const investimentoXPpdf = patrimonioLiquidoPDF * (investimentoXPAtivo ? 0.10 : 0);
    const patrimonioFinalPDF = patrimonioLiquidoPDF - investimentoXPpdf;
    const allDespSubPDF = Object.values(grouped.despMesSub).flat();
    const totalDespMesSubPDF = allDespSubPDF.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
    const allInv34PDF = Object.values(grouped.investimento34).flat();
    const totalInv34PDF = allInv34PDF.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
    const resultadoMensalPDF = patrimonioFinalPDF - totalDespMesSubPDF - totalInv34PDF;
    const resultadoDivTresPDF = resultadoMensalPDF / 3;

    if (grouped.investimentos.length > 0) {
      checkPage(30);
      const investRows = grouped.investimentos.map(r => [r.date || '-', r.descricao, r.detalhamento || '-', fmt(Math.abs(r.valorLiquido)), r.banco || '-']);
      investRows.push(['', '', 'TOTAL INVESTIMENTOS', fmt(totalInvestidoPDF), '']);
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']],
        body: investRows,
        theme: 'grid', styles: { fontSize: 8 },
        headStyles: { fillColor: [180, 150, 40], fontStyle: 'bold', textColor: [255, 255, 255] },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === investRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 250, 220];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── PATRIMÔNIO ──
    checkPage(50);
    const patrimonioRows: string[][] = [
      ['Saldo em Bancos Reais', fmt(saldoFinalBancosReaisPDF)],
      ['(+) Investimentos (50)', fmt(totalInvestidoPDF)],
      ['= PATRIMÔNIO TOTAL', fmt(patrimonioTotalPDF)],
    ];
    if (totalProvisao32PDF > 0) {
      patrimonioRows.push(['(-) Provisão Lance a Dois (32)', `-${fmt(totalProvisao32PDF)}`]);
    }
    patrimonioRows.push(['= PATRIMÔNIO LÍQUIDO', fmt(patrimonioLiquidoPDF)]);
    patrimonioRows.push([`(-) Investimento XP (${investimentoXPAtivo ? '10%' : '0%'})`, `-${fmt(investimentoXPpdf)}`]);
    patrimonioRows.push(['= PATRIMÔNIO FINAL', fmt(patrimonioFinalPDF)]);

    autoTable(doc, {
      startY: y,
      head: [['PATRIMÔNIO', 'Valor']],
      body: patrimonioRows,
      theme: 'grid', styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 100, 180], fontStyle: 'bold', textColor: [255, 255, 255] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        const lastIdx = patrimonioRows.length - 1;
        if (data.section === 'body' && data.row.index === lastIdx) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 12;
          data.cell.styles.fillColor = [220, 235, 255];
        }
        if (data.section === 'body' && data.row.index === 2) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 240, 255];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── DESPESAS MÊS SUBSEQUENTE (33) ──
    if (allDespSubPDF.length > 0) {
      checkPage(30);
      const dmsRows: string[][] = [];
      Object.entries(grouped.despMesSub).sort(([a], [b]) => a.localeCompare(b)).forEach(([desc, items]) => {
        const descTotal = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
        items.forEach(r => {
          dmsRows.push([`   ${r.date || '-'} - ${r.detalhamento || desc}`, `-${fmt(Math.abs(r.valorLiquido))}`]);
        });
        if (items.length > 1) {
          dmsRows.push([`   Subtotal: ${desc}`, `-${fmt(descTotal)}`]);
        }
      });
      dmsRows.push(['TOTAL DESP MÊS SUBSEQUENTE', `-${fmt(totalDespMesSubPDF)}`]);

      autoTable(doc, {
        startY: y,
        head: [['(-) DESPESAS MÊS SUBSEQUENTE [33]', 'Valor']],
        body: dmsRows,
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [200, 50, 50], fontStyle: 'bold', textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === dmsRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 230, 230];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── INVESTIMENTO (34) ──
    if (allInv34PDF.length > 0) {
      checkPage(30);
      const inv34Rows: string[][] = [];
      Object.entries(grouped.investimento34).sort(([a], [b]) => a.localeCompare(b)).forEach(([desc, items]) => {
        const descTotal = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
        items.forEach(r => {
          inv34Rows.push([`   ${r.date || '-'} - ${r.detalhamento || desc}`, `-${fmt(Math.abs(r.valorLiquido))}`]);
        });
        if (items.length > 1) {
          inv34Rows.push([`   Subtotal: ${desc}`, `-${fmt(descTotal)}`]);
        }
      });
      inv34Rows.push(['TOTAL INVESTIMENTO (34)', `-${fmt(totalInv34PDF)}`]);

      autoTable(doc, {
        startY: y,
        head: [['(-) INVESTIMENTO [34]', 'Valor']],
        body: inv34Rows,
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [180, 150, 40], fontStyle: 'bold', textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === inv34Rows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 250, 220];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── RESULTADO MENSAL + ÷ 3 ──
    checkPage(20);
    const resultMensalRows: string[][] = [
      ['Patrimônio Final', fmt(patrimonioFinalPDF)],
      ['(-) Investimento (34)', `-${fmt(totalInv34PDF)}`],
      ['(-) Desp Mês Subsequente', `-${fmt(totalDespMesSubPDF)}`],
      ['= RESULTADO MENSAL', fmt(resultadoMensalPDF)],
      ['÷ 3', fmt(resultadoDivTresPDF)],
    ];
    autoTable(doc, {
      startY: y,
      head: [['RESULTADO MENSAL', 'Valor']],
      body: resultMensalRows,
      theme: 'grid', styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 66, 66], fontStyle: 'bold', textColor: [255, 255, 255] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === 2) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 12;
          data.cell.styles.fillColor = resultadoMensalPDF >= 0 ? [220, 255, 220] : [255, 220, 220];
        }
        if (data.section === 'body' && data.row.index === 3) {
          data.cell.styles.fillColor = [245, 245, 245];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── RESERVAS / CAIXINHAS (51, 52) ──
    if (Object.keys(grouped.reservas).length > 0) {
      checkPage(30);
      const reservaRows: string[][] = [];
      const totalReservasPDF = Object.values(grouped.reservas).flat().reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
      Object.entries(grouped.reservas).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
        const custoTotal = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
        reservaRows.push([custo, `(${items.length})`, fmt(custoTotal)]);
      });
      reservaRows.push(['TOTAL EM RESERVAS', '', fmt(totalReservasPDF)]);

      autoTable(doc, {
        startY: y,
        head: [['RESERVAS / CAIXINHAS', 'Qtd', 'Valor']],
        body: reservaRows,
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [100, 150, 220], fontStyle: 'bold', textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            data.cell.styles.fillColor = [230, 240, 255];
          }
          if (data.section === 'body' && data.row.index === reservaRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [200, 220, 255];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

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
      const subCustos = Array.from(new Set(items.map(i => i.custo)));
      const rows: any[] = [];
      const subtotalRowIdx: number[] = [];
      if (subCustos.length > 1) {
        subCustos.sort().forEach(sc => {
          const subItems = items.filter(i => i.custo === sc);
          subItems.forEach(r => rows.push([r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorLiquido)), r.banco]));
          const subTot = subItems.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
          rows.push(['', '', `Subtotal ${sc}`, fmt(subTot), '']);
          subtotalRowIdx.push(rows.length - 1);
        });
      } else {
        items.forEach(r => rows.push([r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorLiquido)), r.banco]));
      }
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
            data.cell.styles.fillColor = [240, 220, 220];
          } else if (data.section === 'body' && subtotalRowIdx.includes(data.row.index)) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [250, 240, 240];
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

    // ── Detalhamento Provisões (31) ──
    if (Object.keys(grouped.provisoes).length > 0) {
      checkPage(15);
      addSectionTitle('PROVISÕES (31)');
      Object.entries(grouped.provisoes).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
        checkPage(20);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(custo, 14, y); y += 5;
        const rows = items.map(r => [r.date, r.descricao, r.detalhamento || '-', fmt(Math.abs(r.valorLiquido)), r.banco]);
        const total = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
        rows.push(['', '', 'TOTAL', fmt(total), '']);
        autoTable(doc, {
          startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
          theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [150, 120, 50], textColor: [255, 255, 255] },
          columnStyles: { 3: { halign: 'right' } },
          didParseCell: (data: any) => { if (data.section === 'body' && data.row.index === rows.length - 1) data.cell.styles.fontStyle = 'bold'; },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      });
    }

    // ── Detalhamento Lance a Dois (32) ──
    if (grouped.lanceADois.length > 0) {
      checkPage(15);
      addSectionTitle('LANCE A DOIS (32)');
      const rows = grouped.lanceADois.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(r => [r.date, r.descricao, r.detalhamento || '-', fmt(Math.abs(r.valorLiquido)), r.banco || '-']);
      const total = grouped.lanceADois.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
      rows.push(['', '', 'TOTAL', fmt(total), '']);
      autoTable(doc, {
        startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
        theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [180, 80, 80], textColor: [255, 255, 255] },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (data: any) => { if (data.section === 'body' && data.row.index === rows.length - 1) data.cell.styles.fontStyle = 'bold'; },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── Detalhamento Desp Mês Subsequente (33) ──
    if (allDespSubPDF.length > 0) {
      checkPage(15);
      addSectionTitle('DESPESAS MÊS SUBSEQUENTE (33)');
      Object.entries(grouped.despMesSub).sort(([a], [b]) => a.localeCompare(b)).forEach(([desc, items]) => {
        checkPage(20);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(desc, 14, y); y += 5;
        const rows = items.map(r => [r.date, r.descricao, r.detalhamento || '-', fmt(Math.abs(r.valorLiquido)), r.banco || '-']);
        const total = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
        rows.push(['', '', 'TOTAL', fmt(total), '']);
        autoTable(doc, {
          startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
          theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [200, 50, 50], textColor: [255, 255, 255] },
          columnStyles: { 3: { halign: 'right' } },
          didParseCell: (data: any) => { if (data.section === 'body' && data.row.index === rows.length - 1) data.cell.styles.fontStyle = 'bold'; },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      });
    }

    // ── Detalhamento Investimentos (50) ──
    if (grouped.investimentos.length > 0) {
      checkPage(15);
      addSectionTitle('INVESTIMENTOS (50)');
      const rows = grouped.investimentos.map(r => [r.date, r.descricao, r.detalhamento || '-', fmt(Math.abs(r.valorLiquido)), r.banco || '-']);
      const total = grouped.investimentos.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
      rows.push(['', '', 'TOTAL', fmt(total), '']);
      autoTable(doc, {
        startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
        theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [180, 150, 40], textColor: [255, 255, 255] },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (data: any) => { if (data.section === 'body' && data.row.index === rows.length - 1) data.cell.styles.fontStyle = 'bold'; },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── Detalhamento Reservas (51, 52) ──
    if (Object.keys(grouped.reservas).length > 0) {
      checkPage(15);
      addSectionTitle('RESERVAS / CAIXINHAS (51, 52)');
      Object.entries(grouped.reservas).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
        checkPage(20);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(custo, 14, y); y += 5;
        const rows = items.map(r => [r.date, r.descricao, r.detalhamento || '-', fmt(Math.abs(r.valorLiquido)), r.banco || '-']);
        const total = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
        rows.push(['', '', 'TOTAL', fmt(total), '']);
        autoTable(doc, {
          startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
          theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [100, 150, 220], textColor: [255, 255, 255] },
          columnStyles: { 3: { halign: 'right' } },
          didParseCell: (data: any) => { if (data.section === 'body' && data.row.index === rows.length - 1) data.cell.styles.fontStyle = 'bold'; },
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

      {/* ═══════ FLUXO DE CAIXA - EXTRATO COMPACTO ═══════ */}
      <div className="space-y-0">
        <div className="flex items-center gap-2 border-t-2 border-b-2 border-primary/30 py-3 mb-4">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">FLUXO DE CAIXA</h2>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* ── SALDO INICIAL ── */}
            <div className="bg-primary/5 border-b border-border">
              <Collapsible>
                <CollapsibleTrigger className="w-full">
                  <div className="flex justify-between items-center py-3 px-4 hover:bg-primary/10 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold">SALDO INICIAL EM CAIXA</span>
                      {saldoTransportado && (
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                          Transportado
                        </Badge>
                      )}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-bold text-primary">{fmt(totals.totalSaldoInicial)}</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-3 space-y-1">
                    {grouped.saldoInicial.map(r => (
                      <div key={r.id} className="flex justify-between items-center text-xs pl-6">
                        <span className="text-muted-foreground">{r.banco || r.descricao}</span>
                        <span className="font-semibold">{fmt(r.valorBruto)}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* ── (+) ENTRADAS ── */}
            {(() => {
              // Entradas = receitas + entradasCaixa + transferências positivas, agrupadas por centro de custo
              const entradasPorCusto: Record<string, Pagina5Record[]> = {};
              Object.entries(grouped.receitas).forEach(([custo, items]) => {
                const filtered = items.filter(r => r.banco !== 'PROVISAO');
                if (filtered.length > 0) entradasPorCusto[custo] = filtered;
              });
              Object.entries(grouped.entradasCaixa).forEach(([custo, items]) => {
                if (!entradasPorCusto[custo]) entradasPorCusto[custo] = [];
                entradasPorCusto[custo].push(...items);
              });
              const transferenciasPositivas = grouped.transferencias.filter(r => r.valorLiquido > 0 && (r.banco || '').toUpperCase() !== 'PROVISAO');
              if (transferenciasPositivas.length > 0) {
                const key = '99-Transferências (entrada)';
                entradasPorCusto[key] = transferenciasPositivas;
              }

              const totalEntradas = Object.values(entradasPorCusto).flat().reduce((s, r) => s + Math.abs(r.valorLiquido), 0);

              return (
                <div className="border-b border-border">
                  <div className="flex justify-between items-center py-2 px-4" style={{ backgroundColor: 'hsl(142 70% 35% / 0.05)' }}>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" style={{ color: 'hsl(142 70% 35%)' }} />
                      <span className="text-sm font-bold">(+) ENTRADAS</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(totalEntradas)}</span>
                  </div>
                  <div className="space-y-0">
                    {Object.entries(entradasPorCusto).sort(([a], [b]) => a.localeCompare(b)).map(([custo, items]) => {
                      const custoTotal = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
                      const isOpen = openSections[`ent-${custo}`] ?? false;
                      return (
                        <Collapsible key={custo} open={isOpen} onOpenChange={() => toggleSection(`ent-${custo}`)}>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex justify-between items-center text-xs py-1.5 px-4 pl-8 hover:bg-muted/30 transition-colors cursor-pointer border-t border-border/30">
                              <div className="flex items-center gap-1.5">
                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span className="font-medium">{custo}</span>
                                <span className="text-muted-foreground">({items.length})</span>
                              </div>
                              <span className="font-semibold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(custoTotal)}</span>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="pl-12 pr-4 pb-1">
                              {items.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(r => (
                                <div key={r.id} className="flex justify-between items-center text-[11px] py-0.5 text-muted-foreground">
                                  <span className="truncate max-w-[60%]">{r.date} - {r.descricao} {r.detalhamento ? `- ${r.detalhamento}` : ''} {r.banco ? `[${r.banco}]` : ''}</span>
                                  <span className="font-medium" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(Math.abs(r.valorLiquido))}</span>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── (-) SAÍDAS ── */}
            {(() => {
              const saidasPorCusto: Record<string, Pagina5Record[]> = {};
              Object.entries(grouped.despesas).forEach(([custo, items]) => {
                const filtered = items.filter(r => r.banco !== 'PROVISAO');
                if (filtered.length > 0) saidasPorCusto[custo] = filtered;
              });
              Object.entries(grouped.saidasCaixa).forEach(([custo, items]) => {
                if (!saidasPorCusto[custo]) saidasPorCusto[custo] = [];
                saidasPorCusto[custo].push(...items);
              });
              const transferenciasNegativas = grouped.transferencias.filter(r => r.valorLiquido < 0 && (r.banco || '').toUpperCase() !== 'PROVISAO');
              if (transferenciasNegativas.length > 0) {
                const key = '99-Transferências (saída)';
                saidasPorCusto[key] = transferenciasNegativas;
              }

              const totalSaidas = Object.values(saidasPorCusto).flat().reduce((s, r) => s + Math.abs(r.valorLiquido), 0);

              return (
                <div className="border-b border-border">
                  <div className="flex justify-between items-center py-2 px-4" style={{ backgroundColor: 'hsl(var(--destructive) / 0.05)' }}>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" style={{ color: 'hsl(var(--destructive))' }} />
                      <span className="text-sm font-bold">(-) SAÍDAS</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totalSaidas)}</span>
                  </div>
                  <div className="space-y-0">
                    {Object.entries(saidasPorCusto).sort(([a], [b]) => a.localeCompare(b)).map(([custo, items]) => {
                      const custoTotal = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
                      const isOpen = openSections[`sai-${custo}`] ?? false;
                      return (
                        <Collapsible key={custo} open={isOpen} onOpenChange={() => toggleSection(`sai-${custo}`)}>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex justify-between items-center text-xs py-1.5 px-4 pl-8 hover:bg-muted/30 transition-colors cursor-pointer border-t border-border/30">
                              <div className="flex items-center gap-1.5">
                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span className="font-medium">{custo}</span>
                                <span className="text-muted-foreground">({items.length})</span>
                              </div>
                              <span className="font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(custoTotal)}</span>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="pl-12 pr-4 pb-1">
                              {items.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(r => (
                                <div key={r.id} className="flex justify-between items-center text-[11px] py-0.5 text-muted-foreground">
                                  <span className="truncate max-w-[60%]">{r.date} - {r.descricao} {r.detalhamento ? `- ${r.detalhamento}` : ''} {r.banco ? `[${r.banco}]` : ''}</span>
                                  <span className="font-medium" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(Math.abs(r.valorLiquido))}</span>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── SALDO FINAL DO MÊS ── */}
            <div className="border-b border-border bg-primary/10">
              <Collapsible>
                <CollapsibleTrigger className="w-full">
                  <div className="flex justify-between items-center py-3 px-4 hover:bg-primary/15 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold">═ SALDO FINAL DO MÊS</span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-base font-bold" style={{ color: fluxoBancos.filter(b => !['INVEST', 'L2', 'PROVISAO'].includes(b.banco.toUpperCase())).reduce((s, b) => s + b.saldoFinal, 0) >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                      {fmt(fluxoBancos.filter(b => !['INVEST', 'L2', 'PROVISAO'].includes(b.banco.toUpperCase())).reduce((s, b) => s + b.saldoFinal, 0))}
                    </span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-3 space-y-1">
                    {fluxoBancos.filter(b => !['INVEST', 'L2', 'PROVISAO'].includes(b.banco.toUpperCase())).map(b => (
                      <div key={b.banco} className="flex justify-between items-center text-xs pl-6">
                        <span className="text-muted-foreground">{b.banco}</span>
                        <span className="font-semibold" style={{ color: b.saldoFinal >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>{fmt(b.saldoFinal)}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* ── INVESTIMENTOS (custoNum 50) ── */}
            {(() => {
              const totalInvestido = grouped.investimentos.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
              const saldoFinalBancosReais = fluxoBancos.filter(b => !['INVEST', 'L2', 'PROVISAO'].includes(b.banco.toUpperCase())).reduce((s, b) => s + b.saldoFinal, 0);
              const patrimonioTotal = saldoFinalBancosReais + totalInvestido;

              return (
                <div className="border-b border-border">
                  {grouped.investimentos.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex justify-between items-center py-2.5 px-4 hover:bg-muted/30 transition-colors cursor-pointer" style={{ backgroundColor: 'hsl(45 80% 50% / 0.05)' }}>
                        <div className="flex items-center gap-2">
                          <PiggyBank className="h-4 w-4" style={{ color: 'hsl(45 80% 50%)' }} />
                          <span className="text-sm font-bold">INVESTIMENTOS</span>
                          <Badge variant="outline" className="text-[10px]">50</Badge>
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-bold" style={{ color: 'hsl(45 80% 50%)' }}>{fmt(totalInvestido)}</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-2 pl-10">
                        {grouped.investimentos.map(r => (
                          <div key={r.id} className="flex justify-between items-center text-[11px] py-0.5 text-muted-foreground">
                            <span className="truncate max-w-[65%]">{r.date} - {r.descricao} {r.detalhamento ? `- ${r.detalhamento}` : ''} {r.banco ? `[${r.banco}]` : ''}</span>
                            <span className="font-medium">{fmt(Math.abs(r.valorLiquido))}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  )}
                  {/* Patrimônio Total */}
                  {(() => {
                    const totalProvisao32 = grouped.lanceADois.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
                    const patrimonioLiquido = patrimonioTotal - totalProvisao32;
                    const investimentoXP = patrimonioLiquido * (investimentoXPAtivo ? 0.10 : 0);
                    const patrimonioFinal = patrimonioLiquido - investimentoXP;

                    return (
                      <div className="border-t border-border/50 bg-muted/30 space-y-0">
                        {/* Patrimônio Total */}
                        <div className="flex justify-between items-center py-2 px-4">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold">PATRIMÔNIO TOTAL</span>
                            <span className="text-[10px] text-muted-foreground">(Saldo em Bancos + Investimentos)</span>
                          </div>
                          <span className="text-sm font-bold text-primary">{fmt(patrimonioTotal)}</span>
                        </div>

                        {/* Provisão Lance a Dois */}
                        {grouped.lanceADois.length > 0 && (
                          <Collapsible>
                            <CollapsibleTrigger className="w-full">
                              <div className="flex justify-between items-center text-xs py-1.5 px-4 pl-8 hover:bg-muted/40 transition-colors cursor-pointer border-t border-border/30">
                                <div className="flex items-center gap-1.5">
                                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium text-destructive">(-) Provisão Lance a Dois</span>
                                  <Badge variant="outline" className="text-[10px]">32</Badge>
                                  <span className="text-muted-foreground">({grouped.lanceADois.length})</span>
                                </div>
                                <span className="font-semibold text-destructive">-{fmt(totalProvisao32)}</span>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="pl-12 pr-4 pb-1">
                                {grouped.lanceADois.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(r => (
                                  <div key={r.id} className="flex justify-between items-center text-[11px] py-0.5 text-muted-foreground">
                                    <span className="truncate max-w-[65%]">{r.date} - {r.descricao} {r.detalhamento ? `- ${r.detalhamento}` : ''} {r.banco ? `[${r.banco}]` : ''}</span>
                                    <span className="font-medium">{fmt(Math.abs(r.valorLiquido))}</span>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Patrimônio Líquido */}
                        <div className="flex justify-between items-center py-2 px-4 border-t border-border/50 bg-primary/5">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold">PATRIMÔNIO LÍQUIDO</span>
                            <span className="text-[10px] text-muted-foreground">(Patrimônio Total - Provisão)</span>
                          </div>
                          <span className="text-sm font-bold text-primary">{fmt(patrimonioLiquido)}</span>
                        </div>

                        {/* Investimento XP (10%) */}
                        <div className="flex justify-between items-center text-xs py-1.5 px-4 pl-8 border-t border-border/30">
                          <div className="flex items-center gap-1.5">
                            <TrendingDown className="h-3 w-3" style={{ color: 'hsl(45 80% 50%)' }} />
                            <span className="font-medium">(-) Investimento XP ({investimentoXPAtivo ? '10%' : '0%'})</span>
                            <Switch checked={investimentoXPAtivo} onCheckedChange={setInvestimentoXPAtivo} className="h-4 w-8 ml-1" />
                          </div>
                          <span className="font-semibold" style={{ color: 'hsl(45 80% 50%)' }}>-{fmt(investimentoXP)}</span>
                        </div>

                        {/* Patrimônio Final */}
                        <div className="flex justify-between items-center py-2.5 px-4 border-t border-border bg-primary/10">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold">PATRIMÔNIO FINAL</span>
                          </div>
                          <span className="text-base font-bold text-primary">{fmt(patrimonioFinal)}</span>
                        </div>

                        {/* ── INVESTIMENTO (custoNum 34) + DESPESAS MÊS SUBSEQUENTE (custoNum 33) ── */}
                        {(() => {
                          const allDespSub = Object.values(grouped.despMesSub).flat();
                          const totalDespMesSub = allDespSub.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
                          const allInv34 = Object.values(grouped.investimento34).flat();
                          const totalInv34 = allInv34.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
                          const resultadoMensal = patrimonioFinal - totalDespMesSub - totalInv34;
                          const resultadoDivTres = resultadoMensal / 3;

                          return (
                            <>
                              {allInv34.length > 0 && (
                                <div className="border-t border-border">
                                  <div className="flex justify-between items-center py-2 px-4" style={{ backgroundColor: 'hsl(45 80% 50% / 0.08)' }}>
                                    <div className="flex items-center gap-2">
                                      <PiggyBank className="h-4 w-4" style={{ color: 'hsl(45 80% 50%)' }} />
                                      <span className="text-xs font-bold" style={{ color: 'hsl(45 80% 35%)' }}>(-) INVESTIMENTO</span>
                                      <Badge variant="outline" className="text-[10px]">34</Badge>
                                    </div>
                                  </div>
                                  <div className="space-y-0">
                                    {Object.entries(grouped.investimento34).sort(([a], [b]) => a.localeCompare(b)).map(([desc, items]) => {
                                      const descTotal = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
                                      const isOpen = openSections[`inv34-${desc}`] ?? false;
                                      return (
                                        <Collapsible key={desc} open={isOpen} onOpenChange={() => toggleSection(`inv34-${desc}`)}>
                                          <CollapsibleTrigger className="w-full">
                                            <div className="flex justify-between items-center text-xs py-1.5 px-4 pl-8 hover:bg-muted/30 transition-colors cursor-pointer border-t border-border/30">
                                              <div className="flex items-center gap-1.5">
                                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                <span className="font-medium">{desc}</span>
                                                <span className="text-muted-foreground">({items.length})</span>
                                              </div>
                                              <span className="font-semibold" style={{ color: 'hsl(45 80% 35%)' }}>-{fmt(descTotal)}</span>
                                            </div>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent>
                                            <div className="pl-12 pr-4 pb-1">
                                              {items.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(r => (
                                                <div key={r.id} className="flex justify-between items-center text-[11px] py-0.5 text-muted-foreground">
                                                  <span className="truncate max-w-[65%]">{r.date} - {r.detalhamento || r.descricao} {r.banco ? `[${r.banco}]` : ''}</span>
                                                  <span className="font-medium">-{fmt(Math.abs(r.valorLiquido))}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      );
                                    })}
                                  </div>
                                  <div className="flex justify-between items-center text-xs py-1.5 px-4 border-t border-border/50" style={{ backgroundColor: 'hsl(45 80% 50% / 0.08)' }}>
                                    <span className="font-semibold" style={{ color: 'hsl(45 80% 35%)' }}>TOTAL INVESTIMENTO (34)</span>
                                    <span className="font-bold" style={{ color: 'hsl(45 80% 35%)' }}>-{fmt(totalInv34)}</span>
                                  </div>
                                </div>
                              )}

                              {allDespSub.length > 0 && (
                                <div className="border-t border-border">
                                  <div className="flex justify-between items-center py-2 px-4 bg-destructive/5">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-destructive" />
                                      <span className="text-xs font-bold text-destructive">(-) DESP MÊS SUBSEQUENTE</span>
                                      <Badge variant="outline" className="text-[10px]">33</Badge>
                                    </div>
                                  </div>
                                  <div className="space-y-0">
                                    {Object.entries(grouped.despMesSub).sort(([a], [b]) => a.localeCompare(b)).map(([desc, items]) => {
                                      const descTotal = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
                                      const isOpen = openSections[`dms-${desc}`] ?? false;
                                      return (
                                        <Collapsible key={desc} open={isOpen} onOpenChange={() => toggleSection(`dms-${desc}`)}>
                                          <CollapsibleTrigger className="w-full">
                                            <div className="flex justify-between items-center text-xs py-1.5 px-4 pl-8 hover:bg-muted/30 transition-colors cursor-pointer border-t border-border/30">
                                              <div className="flex items-center gap-1.5">
                                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                <span className="font-medium">{desc}</span>
                                                <span className="text-muted-foreground">({items.length})</span>
                                              </div>
                                              <span className="font-semibold text-destructive">-{fmt(descTotal)}</span>
                                            </div>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent>
                                            <div className="pl-12 pr-4 pb-1">
                                              {items.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(r => (
                                                <div key={r.id} className="flex justify-between items-center text-[11px] py-0.5 text-muted-foreground">
                                                  <span className="truncate max-w-[65%]">{r.date} - {r.detalhamento || r.descricao} {r.banco ? `[${r.banco}]` : ''}</span>
                                                  <span className="font-medium">-{fmt(Math.abs(r.valorLiquido))}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      );
                                    })}
                                  </div>
                                  <div className="flex justify-between items-center text-xs py-1.5 px-4 border-t border-border/50 bg-destructive/5">
                                    <span className="font-semibold text-destructive">TOTAL DESP MÊS SUB</span>
                                    <span className="font-bold text-destructive">-{fmt(totalDespMesSub)}</span>
                                  </div>
                                </div>
                              )}

                              {/* RESULTADO MENSAL */}
                              <div className="flex justify-between items-center py-2.5 px-4 border-t-2 border-border bg-accent/20">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-accent-foreground" />
                                  <span className="text-sm font-bold">RESULTADO MENSAL</span>
                                  <span className="text-[10px] text-muted-foreground">(Patrimônio Final - Investimento (34) - Desp Mês Sub)</span>
                                </div>
                                <span className={`text-base font-bold ${resultadoMensal >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{fmt(resultadoMensal)}</span>
                              </div>

                              {/* RESULTADO ÷ 3 */}
                              <div className="flex justify-between items-center py-1.5 px-4 pl-8 border-t border-border/50 bg-accent/10">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">÷ 3</span>
                                </div>
                                <span className={`text-sm font-semibold ${resultadoDivTres >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{fmt(resultadoDivTres)}</span>
                              </div>
                            </>
                          );
                        })()}

                        {/* ── RESERVAS / CAIXINHAS (custoNum 51, 52) ── */}
                        {(() => {
                          const totalReservas = Object.values(grouped.reservas).flat().reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
                          if (Object.keys(grouped.reservas).length === 0) return null;

                          return (
                            <div className="border-t-2 border-border" style={{ backgroundColor: 'hsl(210 70% 50% / 0.06)' }}>
                              <div className="flex justify-between items-center py-2 px-4">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4" style={{ color: 'hsl(210 70% 50%)' }} />
                                  <span className="text-sm font-bold">RESERVAS / CAIXINHAS</span>
                                </div>
                              </div>
                              <div className="space-y-0">
                                {Object.entries(grouped.reservas).sort(([a], [b]) => a.localeCompare(b)).map(([custo, items]) => {
                                  const custoTotal = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
                                  const isOpen = openSections[`res-${custo}`] ?? false;
                                  return (
                                    <Collapsible key={custo} open={isOpen} onOpenChange={() => toggleSection(`res-${custo}`)}>
                                      <CollapsibleTrigger className="w-full">
                                        <div className="flex justify-between items-center text-xs py-1.5 px-4 pl-8 hover:bg-muted/30 transition-colors cursor-pointer border-t border-border/30">
                                          <div className="flex items-center gap-1.5">
                                            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                            <span className="font-medium">{custo}</span>
                                            <span className="text-muted-foreground">({items.length})</span>
                                          </div>
                                          <span className="font-semibold" style={{ color: 'hsl(210 70% 50%)' }}>{fmt(custoTotal)}</span>
                                        </div>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="pl-12 pr-4 pb-1">
                                          {items.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(r => (
                                            <div key={r.id} className="flex justify-between items-center text-[11px] py-0.5 text-muted-foreground">
                                              <span className="truncate max-w-[65%]">{r.date} - {r.descricao} {r.detalhamento ? `- ${r.detalhamento}` : ''}</span>
                                              <span className="font-medium">{fmt(Math.abs(r.valorLiquido))}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  );
                                })}
                              </div>
                              <div className="border-t border-border/50 px-4 py-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-semibold">Total em Reservas</span>
                                  <span className="font-bold" style={{ color: 'hsl(210 70% 50%)' }}>{fmt(totalReservas)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DREFluxoCaixa;
