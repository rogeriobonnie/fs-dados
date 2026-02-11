import { useMemo, useState } from 'react';
import { Pagina5Record, FluxoCaixaBanco } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Wallet, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, Landmark, FileText, BarChart3 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  data: Pagina5Record[];
  selectedMonth?: string;
  selectedYear?: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const DREFluxoCaixa = ({ data, selectedMonth, selectedYear }: Props) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleCourse = (key: string) => setOpenCourses(prev => ({ ...prev, [key]: !prev[key] }));

  const grouped = useMemo(() => {
    const saldoInicial = data.filter(r => r.custoNum === 0);
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
        // Despesas: exclui banco=PAGO (já foi pago, não entra no resultado)
        if (!despesas[r.custo]) despesas[r.custo] = [];
        despesas[r.custo].push(r);
      } else if (r.custoNum >= 21 && r.custoNum <= 30) {
        if (!saidasCaixa[r.custo]) saidasCaixa[r.custo] = [];
        saidasCaixa[r.custo].push(r);
      } else if (r.custoNum === 31 && (r.banco || '').toUpperCase() === 'PROVISAO') {
        // Provisões: apenas banco=PROVISAO (banco=PAGO ou outro = já foi pago, ignora)
        if (!provisoes[r.custo]) provisoes[r.custo] = [];
        provisoes[r.custo].push(r);
      } else if (r.custoNum === 97 || r.custoNum === 98) {
        if (!entradasCaixa[r.custo]) entradasCaixa[r.custo] = [];
        entradasCaixa[r.custo].push(r);
      }
    });

    return { saldoInicial, receitas, despesas, saidasCaixa, entradasCaixa, provisoes, transferencias };
  }, [data]);

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
      c.comVendedor += r.vrVendedor;
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
      items.forEach(r => { totalSaidasCaixa += Math.abs(r.valorBruto); });
    });

    // Entradas de caixa (97, 98) - valores positivos
    let totalEntradasCaixa = 0;
    Object.values(grouped.entradasCaixa).forEach(items => {
      items.forEach(r => { totalEntradasCaixa += Math.abs(r.valorBruto); });
    });

    const resultadoCaixa = totalLiquidoReceitas - totalDespesas;
    const disponivelAntes = totalSaldoInicial + resultadoCaixa;
    const saldoFinalLivre = disponivelAntes - totalSaidasCaixa + totalEntradasCaixa;

    return {
      totalSaldoInicial,
      totalBrutoReceitas, totalTaxasReceitas, totalLiquidoReceitas,
      totalImpostosReceitas, totalComVendedor, totalResultadoReceitas,
      totalDespesas, resultadoMes, totalProvisoes, resultadoAposProvisoes,
      resultadoCaixa, totalSaidasCaixa, totalEntradasCaixa, disponivelAntes, saldoFinalLivre,
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
    const addSectionTitle = (text: string) => { checkPage(15); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(text, 14, y); y += 7; };

    // ========== PAGE 1: DRE RESUMIDA ==========
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`DRE - ${monthName} ${year}`, 14, y);
    y += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Demonstrativo de Resultado do Exercício', 14, y);
    y += 8;

    // Receitas resumo
    autoTable(doc, {
      startY: y,
      head: [['RECEITAS', 'Valor']],
      body: [
        ['Receita Bruta (vendas)', fmt(totals.totalBrutoReceitas)],
        ['(-) Taxas de Plataforma', `-${fmt(totals.totalTaxasReceitas)}`],
        ['= Receita Líquida', fmt(totals.totalLiquidoReceitas)],
        ['(-) Impostos', `-${fmt(totals.totalImpostosReceitas)}`],
        ['(-) Comissões de Vendedores', `-${fmt(totals.totalComVendedor)}`],
        ['= RECEITA LÍQUIDA FINAL', fmt(totals.totalResultadoReceitas)],
      ],
      theme: 'grid', styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 139, 34], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && (data.row.index === 2 || data.row.index === 5)) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Despesas resumo
    const despesasResumo = Object.entries(grouped.despesas)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([custo, items]) => [custo, fmt(items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0))]);
    despesasResumo.push(['TOTAL DESPESAS', fmt(totals.totalDespesas)]);

    autoTable(doc, {
      startY: y,
      head: [['DESPESAS OPERACIONAIS', 'Valor']],
      body: despesasResumo,
      theme: 'grid', styles: { fontSize: 9 },
      headStyles: { fillColor: [200, 50, 50], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === despesasResumo.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Resultado do mês
    const resultadoBody: string[][] = [
      ['RESULTADO DO MÊS (Receita Líquida - Despesas)', fmt(totals.resultadoMes)],
    ];
    // Provisões dentro do resultado
    if (totals.totalProvisoes > 0) {
      Object.entries(grouped.provisoes).sort(([a], [b]) => a.localeCompare(b)).forEach(([, items]) => {
        items.forEach(r => {
          resultadoBody.push([`  ${r.date} - ${r.descricao} ${r.detalhamento || ''}`, `-${fmt(Math.abs(r.valorLiquido))}`]);
        });
      });
      resultadoBody.push(['(-) Total Provisões', `-${fmt(totals.totalProvisoes)}`]);
      resultadoBody.push(['RESULTADO COM PROVISÕES', fmt(totals.resultadoAposProvisoes)]);
    }

    autoTable(doc, {
      startY: y,
      body: resultadoBody,
      theme: 'grid', styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === 0) {
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

    // ========== PAGE 2: FLUXO DE CAIXA ==========
    doc.addPage();
    y = 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Fluxo de Caixa - ${monthName} ${year}`, 14, y);
    y += 10;

    // Saldo Inicial + Resultado
    autoTable(doc, {
      startY: y,
      head: [['COMPOSIÇÃO DO FLUXO', 'Valor']],
      body: [
        ['Saldo Inicial', fmt(totals.totalSaldoInicial)],
        ['(+) Resultado de Caixa', fmt(totals.resultadoCaixa)],
        ['= Disponível antes de movimentações', fmt(totals.disponivelAntes)],
      ],
      theme: 'grid', styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === 2) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 240, 255];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Saídas de Caixa
    if (Object.keys(grouped.saidasCaixa).length > 0) {
      const saidasResumo = Object.entries(grouped.saidasCaixa)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([custo, items]) => [custo, `-${fmt(items.reduce((s, r) => s + Math.abs(r.valorBruto), 0))}`]);
      saidasResumo.push(['TOTAL SAÍDAS DE CAIXA', `-${fmt(totals.totalSaidasCaixa)}`]);

      autoTable(doc, {
        startY: y,
        head: [['SAÍDAS DE CAIXA (não são despesas do mês)', 'Valor']],
        body: saidasResumo,
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [200, 50, 50], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === saidasResumo.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 230, 230];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Entradas de Caixa
    if (Object.keys(grouped.entradasCaixa).length > 0) {
      const entradasResumo = Object.entries(grouped.entradasCaixa)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([custo, items]) => [custo, `+${fmt(items.reduce((s, r) => s + Math.abs(r.valorBruto), 0))}`]);
      entradasResumo.push(['TOTAL ENTRADAS DE CAIXA', `+${fmt(totals.totalEntradasCaixa)}`]);

      autoTable(doc, {
        startY: y,
        head: [['ENTRADAS DE CAIXA (não são receitas do mês)', 'Valor']],
        body: entradasResumo,
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 139, 34], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === entradasResumo.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 255, 220];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Resumo do Fluxo
    autoTable(doc, {
      startY: y,
      head: [['RESUMO DO FLUXO DE CAIXA', 'Valor']],
      body: [
        ['Saldo Inicial', fmt(totals.totalSaldoInicial)],
        ['(+) Resultado de Caixa', fmt(totals.resultadoCaixa)],
        ['(-) Saídas de Caixa', `-${fmt(totals.totalSaidasCaixa)}`],
        ['(+) Entradas de Caixa', `+${fmt(totals.totalEntradasCaixa)}`],
        ['= SALDO FINAL LIVRE', fmt(totals.saldoFinalLivre)],
      ],
      theme: 'grid', styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 51, 102], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === 4) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 12;
          data.cell.styles.fillColor = totals.saldoFinalLivre >= 0 ? [220, 255, 220] : [255, 220, 220];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Saldo por Banco - Simplificado
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
      startY: y, head: [['Banco', 'Saldo Inicial', '+ Entradas', '- Saídas', 'Saldo Final']], body: bancoRows,
      theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [66, 66, 66] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === bancoRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ========== DETALHAMENTO ==========
    doc.addPage();
    y = 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALHAMENTO DAS RECEITAS', 14, y);
    y += 8;

    const cursoRows = receitasPorCurso.map(c => [
      c.nome, String(c.qtd), fmt(c.bruto), `-${fmt(c.taxas)}`, fmt(c.liquido), `-${fmt(c.impostos)}`, `-${fmt(c.comVendedor)}`, fmt(c.resultado),
    ]);
    cursoRows.push([
      'TOTAL', '', fmt(totals.totalBrutoReceitas), `-${fmt(totals.totalTaxasReceitas)}`,
      fmt(totals.totalLiquidoReceitas), `-${fmt(totals.totalImpostosReceitas)}`,
      `-${fmt(totals.totalComVendedor)}`, fmt(totals.totalResultadoReceitas),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Curso/Receita', 'Qtd', 'Bruto', 'Taxas', 'Líquido', 'Impostos', 'Com.Vend', 'Resultado']],
      body: cursoRows,
      theme: 'grid', styles: { fontSize: 7 },
      headStyles: { fillColor: [34, 139, 34] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === cursoRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Detalhamento despesas
    checkPage(15);
    addSectionTitle('DETALHAMENTO DAS DESPESAS');
    Object.entries(grouped.despesas).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
      checkPage(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(custo, 14, y);
      y += 5;
      const rows = items.map(r => [r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorBruto)), r.banco]);
      const total = items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
      rows.push(['', '', 'TOTAL', fmt(total), '']);
      autoTable(doc, {
        startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
        theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [200, 50, 50] },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.row.index === rows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    });

    // Detalhamento saídas de caixa
    if (Object.keys(grouped.saidasCaixa).length > 0) {
      checkPage(15);
      addSectionTitle('DETALHAMENTO DAS SAÍDAS DE CAIXA');
      Object.entries(grouped.saidasCaixa).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
        checkPage(20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(custo, 14, y);
        y += 5;
        const rows = items.map(r => [r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorBruto)), r.banco]);
        autoTable(doc, {
          startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
          theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [180, 80, 80] },
          columnStyles: { 3: { halign: 'right' } },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      });
    }

    // Detalhamento entradas de caixa
    if (Object.keys(grouped.entradasCaixa).length > 0) {
      checkPage(15);
      addSectionTitle('DETALHAMENTO DAS ENTRADAS DE CAIXA');
      Object.entries(grouped.entradasCaixa).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
        checkPage(20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(custo, 14, y);
        y += 5;
        const rows = items.map(r => [r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorBruto)), r.banco]);
        autoTable(doc, {
          startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
          theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [34, 120, 34] },
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

      {/* SALDO INICIAL */}
      {grouped.saldoInicial.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">SALDO INICIAL</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {grouped.saldoInicial.map(r => (
                <div key={r.id} className="flex justify-between items-center p-2 rounded bg-muted/50">
                  <span className="text-xs font-medium">{r.banco || r.descricao}</span>
                  <span className="text-sm font-bold">{fmt(r.valorBruto)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center p-2 rounded bg-primary/10 col-span-full md:col-span-1">
                <span className="text-xs font-bold">TOTAL</span>
                <span className="text-sm font-bold text-primary">{fmt(totals.totalSaldoInicial)}</span>
              </div>
            </div>
          </CardContent>
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

        {/* Saldo Inicial + Resultado = Disponível */}
        <Card className="border-l-4 border-l-primary bg-muted/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span>Saldo Inicial</span>
              <span className="font-bold">{fmt(totals.totalSaldoInicial)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
            <span>(+) Resultado de Caixa</span>
              <span className="font-bold" style={{ color: totals.resultadoCaixa >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                {totals.resultadoCaixa >= 0 ? '+' : ''}{fmt(totals.resultadoCaixa)}
              </span>
            </div>
            <div className="border-t-2 border-dashed my-1" />
            <div className="flex justify-between items-center text-base font-bold">
              <span>= Disponível antes de movimentações</span>
              <span className="text-primary">{fmt(totals.disponivelAntes)}</span>
            </div>
          </CardContent>
        </Card>

        {/* SAÍDAS DE CAIXA */}
        {Object.keys(grouped.saidasCaixa).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5" style={{ color: 'hsl(0 70% 50%)' }} />
              <h3 className="text-base font-bold">SAÍDAS DE CAIXA</h3>
              <span className="text-xs text-muted-foreground">(não são despesas do mês — distribuições, pagamentos externos, etc.)</span>
            </div>
            {Object.entries(grouped.saidasCaixa)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([custo, items]) => renderDespesaSection(custo, items, 'saida'))}
            <div className="flex justify-end px-4">
              <div className="flex items-center gap-3 p-2 rounded bg-destructive/10">
                <span className="text-sm font-bold">TOTAL SAÍDAS</span>
                <span className="text-sm font-bold" style={{ color: 'hsl(0 70% 50%)' }}>-{fmt(totals.totalSaidasCaixa)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ENTRADAS DE CAIXA */}
        {Object.keys(grouped.entradasCaixa).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5" style={{ color: 'hsl(142 70% 35%)' }} />
              <h3 className="text-base font-bold">ENTRADAS DE CAIXA</h3>
              <span className="text-xs text-muted-foreground">(não são receitas do mês — resgates, repasses de terceiros, etc.)</span>
            </div>
            {Object.entries(grouped.entradasCaixa)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([custo, items]) => renderDespesaSection(custo, items, 'entrada'))}
            <div className="flex justify-end px-4">
              <div className="flex items-center gap-3 p-2 rounded" style={{ backgroundColor: 'hsla(142, 70%, 35%, 0.1)' }}>
                <span className="text-sm font-bold">TOTAL ENTRADAS</span>
                <span className="text-sm font-bold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(totals.totalEntradasCaixa)}</span>
              </div>
            </div>
          </div>
        )}

        {/* RESUMO DO FLUXO */}
        <Card className="border-2 border-primary">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-bold">RESUMO DO FLUXO DE CAIXA</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Saldo Inicial</span>
              <span className="font-semibold">{fmt(totals.totalSaldoInicial)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>(+) Resultado de Caixa</span>
              <span className="font-semibold" style={{ color: totals.resultadoCaixa >= 0 ? 'hsl(142 70% 35%)' : 'hsl(var(--destructive))' }}>
                {totals.resultadoCaixa >= 0 ? '+' : ''}{fmt(totals.resultadoCaixa)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>(-) Saídas de Caixa</span>
              <span className="font-semibold" style={{ color: 'hsl(0 70% 50%)' }}>-{fmt(totals.totalSaidasCaixa)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>(+) Entradas de Caixa</span>
              <span className="font-semibold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(totals.totalEntradasCaixa)}</span>
            </div>
            <div className="border-t-2 border-primary my-2" />
            <div className="flex justify-between text-lg font-bold">
              <span>= SALDO FINAL LIVRE</span>
              <span className={totals.saldoFinalLivre >= 0 ? 'text-primary' : ''} style={totals.saldoFinalLivre < 0 ? { color: 'hsl(var(--destructive))' } : {}}>
                {fmt(totals.saldoFinalLivre)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* SALDO POR BANCO - Simplificado */}
        {fluxoBancos.length > 0 && (
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">SALDO POR BANCO</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Banco</TableHead>
                      <TableHead className="text-xs text-right">Saldo Inicial</TableHead>
                      <TableHead className="text-xs text-right">+ Entradas</TableHead>
                      <TableHead className="text-xs text-right">- Saídas</TableHead>
                      <TableHead className="text-xs text-right font-bold">Saldo Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fluxoBancos.map(b => {
                      const entradas = b.receitas + b.resgates + Math.max(0, b.transferencias);
                      const saidas = b.despesas + b.destinacoes + Math.abs(Math.min(0, b.transferencias));
                      const saldoFinal = b.saldoInicial + entradas - saidas;
                      return (
                        <TableRow key={b.banco}>
                          <TableCell className="text-xs font-medium">{b.banco}</TableCell>
                          <TableCell className="text-xs text-right">{fmt(b.saldoInicial)}</TableCell>
                          <TableCell className="text-xs text-right" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(entradas)}</TableCell>
                          <TableCell className="text-xs text-right" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(saidas)}</TableCell>
                          <TableCell className="text-xs text-right font-bold">{fmt(saldoFinal)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    {(() => {
                      const totEntradas = fluxoBancos.reduce((s, b) => s + b.receitas + b.resgates + Math.max(0, b.transferencias), 0);
                      const totSaidas = fluxoBancos.reduce((s, b) => s + b.despesas + b.destinacoes + Math.abs(Math.min(0, b.transferencias)), 0);
                      const totSaldoFinal = fluxoTotal.saldoInicial + totEntradas - totSaidas;
                      return (
                        <TableRow className="bg-primary/10">
                          <TableCell className="text-xs font-bold">TOTAL</TableCell>
                          <TableCell className="text-xs text-right font-bold">{fmt(fluxoTotal.saldoInicial)}</TableCell>
                          <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(142 70% 35%)' }}>+{fmt(totEntradas)}</TableCell>
                          <TableCell className="text-xs text-right font-bold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(totSaidas)}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-primary">{fmt(totSaldoFinal)}</TableCell>
                        </TableRow>
                      );
                    })()}
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DREFluxoCaixa;
