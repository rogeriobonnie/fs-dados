import { useMemo, useState } from 'react';
import { Pagina5Record, FluxoCaixaBanco } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Landmark, FileText } from 'lucide-react';
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
    const saldoInicial = data.filter(r => r.custo.toUpperCase().includes('0-SALDO'));
    const receitas: Record<string, Pagina5Record[]> = {};
    const despesas: Record<string, Pagina5Record[]> = {};
    const destinacoes: Record<string, Pagina5Record[]> = {};
    const resgates = data.filter(r => r.custo.toUpperCase().includes('98-RESGATE'));
    const transferencias = data.filter(r => r.custo.toUpperCase().includes('99-TRANSFER'));

    data.forEach(r => {
      if (r.custoNum >= 1 && r.custoNum <= 10) {
        if (!receitas[r.custo]) receitas[r.custo] = [];
        receitas[r.custo].push(r);
      } else if (r.custoNum >= 11 && r.custoNum <= 20) {
        if (!despesas[r.custo]) despesas[r.custo] = [];
        despesas[r.custo].push(r);
      } else if ((r.custoNum >= 21 && r.custoNum <= 30) || r.custoNum === 97) {
        if (!destinacoes[r.custo]) destinacoes[r.custo] = [];
        destinacoes[r.custo].push(r);
      }
    });

    return { saldoInicial, receitas, despesas, destinacoes, resgates, transferencias };
  }, [data]);

  const totals = useMemo(() => {
    const totalSaldoInicial = grouped.saldoInicial.reduce((s, r) => s + r.valorBruto, 0);
    
    let totalReceitas = 0;
    Object.values(grouped.receitas).forEach(items => {
      items.forEach(r => { totalReceitas += r.valorLiquido; });
    });

    let totalDespesas = 0;
    Object.values(grouped.despesas).forEach(items => {
      items.forEach(r => { totalDespesas += Math.abs(r.valorLiquido); });
    });

    let totalDestinacoes = 0;
    Object.values(grouped.destinacoes).forEach(items => {
      items.forEach(r => { totalDestinacoes += Math.abs(r.valorBruto); });
    });

    const totalResgates = grouped.resgates.reduce((s, r) => s + r.valorBruto, 0);
    const resultado = totalReceitas - totalDespesas;

    return { totalSaldoInicial, totalReceitas, totalDespesas, totalDestinacoes, totalResgates, resultado };
  }, [grouped]);

  const fluxoBancos = useMemo(() => {
    const bancos = new Map<string, FluxoCaixaBanco>();
    const ensureBanco = (b: string) => {
      if (!b || b === 'PROVISAO') return;
      if (!bancos.has(b)) {
        bancos.set(b, { banco: b, saldoInicial: 0, receitas: 0, despesas: 0, destinacoes: 0, resgates: 0, transferencias: 0, saldoFinal: 0 });
      }
    };

    grouped.saldoInicial.forEach(r => {
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.saldoInicial += r.valorBruto;
    });

    Object.values(grouped.receitas).flat().forEach(r => {
      if (r.banco === 'PROVISAO') return;
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.receitas += r.valorLiquido;
    });

    Object.values(grouped.despesas).flat().forEach(r => {
      if (r.banco === 'PROVISAO') return;
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.despesas += Math.abs(r.valorLiquido);
    });

    Object.values(grouped.destinacoes).flat().forEach(r => {
      if (r.banco === 'PROVISAO') return;
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.destinacoes += Math.abs(r.valorBruto);
    });

    grouped.resgates.forEach(r => {
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.resgates += r.valorBruto;
    });

    grouped.transferencias.forEach(r => {
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.transferencias += r.valorBruto;
    });

    bancos.forEach(b => {
      b.saldoFinal = b.saldoInicial + b.receitas - b.despesas - b.destinacoes + b.resgates + b.transferencias;
    });

    return Array.from(bancos.values()).sort((a, b) => a.banco.localeCompare(b.banco));
  }, [grouped]);

  const fluxoTotal = useMemo(() => {
    return fluxoBancos.reduce(
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
  }, [fluxoBancos]);

  const groupByCourse = (items: Pagina5Record[]) => {
    const map = new Map<string, Pagina5Record[]>();
    items.forEach(r => {
      const key = r.descricao || 'Sem descrição';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  };

  const computeCostCenterSummary = (items: Pagina5Record[]) => {
    const totalBruto = items.reduce((s, r) => s + r.valorBruto, 0);
    const totalTaxas = items.reduce((s, r) => s + r.taxas, 0);
    const totalAcrescimos = items.reduce((s, r) => s + r.acrescimos, 0);
    const totalLiquido = items.reduce((s, r) => s + r.valorLiquido, 0);
    const totalImposto = items.reduce((s, r) => s + r.vrImposto, 0);
    const totalVendedor = items.reduce((s, r) => s + r.vrVendedor, 0);
    const totalMkt = items.reduce((s, r) => s + r.vrMkt, 0);
    const resultadoLiquido = totalLiquido - totalImposto - totalVendedor - totalMkt;
    return { totalBruto, totalTaxas, totalAcrescimos, totalLiquido, totalImposto, totalVendedor, totalMkt, resultadoLiquido };
  };

  const renderCostCenterSection = (custo: string, items: Pagina5Record[], type: 'receita' | 'despesa' | 'destinacao') => {
    const isOpen = openSections[custo] ?? false;
    const isCurso = type === 'receita';
    const total = items.reduce((s, r) => s + (type === 'receita' ? r.valorLiquido : Math.abs(r.valorBruto)), 0);
    const provisionItems = items.filter(r => r.banco === 'PROVISAO');

    return (
      <Card key={custo} className="border-l-4" style={{ borderLeftColor: type === 'receita' ? 'hsl(var(--success))' : type === 'despesa' ? 'hsl(var(--destructive))' : 'hsl(var(--warning))' }}>
        <Collapsible open={isOpen} onOpenChange={() => toggleSection(custo)}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-sm font-semibold">{custo}</CardTitle>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  {provisionItems.length > 0 && (
                    <Badge variant="outline" className="text-xs border-warning text-warning">
                      {provisionItems.length} provisão
                    </Badge>
                  )}
                </div>
                <span className="font-bold text-sm">{fmt(total)}</span>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4">
              {isCurso ? renderCourseBreakdown(items) : renderItemList(items)}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  const renderCourseBreakdown = (items: Pagina5Record[]) => {
    const courses = groupByCourse(items);
    const summary = computeCostCenterSummary(items);

    return (
      <div className="space-y-3">
        {/* Resumo do Centro de Custo */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <p className="text-xs font-bold text-muted-foreground mb-2">RESUMO DO CENTRO DE CUSTO</p>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between"><span>Valor Bruto Total</span><span className="font-semibold">{fmt(summary.totalBruto)}</span></div>
            <div className="flex justify-between"><span>(-) Taxas de Plataforma</span><span className="font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(summary.totalTaxas)}</span></div>
            <div className="flex justify-between"><span>(+) Acréscimos</span><span className="font-semibold" style={{ color: 'hsl(var(--success))' }}>{fmt(summary.totalAcrescimos)}</span></div>
            <div className="border-t my-1" />
            <div className="flex justify-between font-bold"><span>= Valor Líquido</span><span>{fmt(summary.totalLiquido)}</span></div>
            <div className="flex justify-between"><span>(-) Impostos</span><span className="font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(summary.totalImposto)}</span></div>
            <div className="flex justify-between"><span>(-) Comissões Vendedores</span><span className="font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(summary.totalVendedor)}</span></div>
            <div className="flex justify-between"><span>(-) Comissões MKT</span><span className="font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(summary.totalMkt)}</span></div>
            <div className="border-t my-1" />
            <div className="flex justify-between font-bold text-sm"><span>= Resultado Líquido</span><span className="text-primary">{fmt(summary.resultadoLiquido)}</span></div>
          </div>
        </div>

        {/* Cursos individuais */}
        {Array.from(courses.entries()).map(([nome, vendas]) => {
          const isOpen = openCourses[nome] ?? false;
          const totalLiquido = vendas.reduce((s, r) => s + r.valorLiquido, 0);

          return (
            <Collapsible key={nome} open={isOpen} onOpenChange={() => toggleCourse(nome)}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="text-sm font-medium">{nome}</span>
                    <Badge variant="outline" className="text-xs">{vendas.length} vendas</Badge>
                  </div>
                  <span className="text-sm font-semibold">{fmt(totalLiquido)}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-6 space-y-1 text-xs">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1">Data</TableHead>
                        <TableHead className="text-xs py-1">Aluno</TableHead>
                        <TableHead className="text-xs py-1 text-right">Bruto</TableHead>
                        <TableHead className="text-xs py-1 text-right">Taxas</TableHead>
                        <TableHead className="text-xs py-1 text-right">Líquido</TableHead>
                        <TableHead className="text-xs py-1 text-right">Imposto</TableHead>
                        <TableHead className="text-xs py-1">Vendedor</TableHead>
                        <TableHead className="text-xs py-1 text-right">Com.Vend</TableHead>
                        <TableHead className="text-xs py-1">Banco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendas.map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs py-1">{v.date}</TableCell>
                          <TableCell className="text-xs py-1">{v.detalhamento}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{fmt(v.valorBruto)}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{v.taxas > 0 ? `-${fmt(v.taxas)}` : '-'}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{fmt(v.valorLiquido)}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{v.vrImposto > 0 ? `-${fmt(v.vrImposto)}` : '-'}</TableCell>
                          <TableCell className="text-xs py-1">{v.vendedor}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{v.vrVendedor > 0 ? fmt(v.vrVendedor) : '-'}</TableCell>
                          <TableCell className="text-xs py-1">
                            {v.banco === 'PROVISAO' ? (
                              <Badge variant="outline" className="text-xs border-warning text-warning">PROVISÃO</Badge>
                            ) : v.banco}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };

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
              {r.banco === 'PROVISAO' ? (
                <Badge variant="outline" className="text-xs border-warning text-warning">PROVISÃO</Badge>
              ) : r.banco}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  // PDF Generation
  const generatePDF = () => {
    const monthName = selectedMonth ? MONTH_NAMES[parseInt(selectedMonth) - 1] : '';
    const year = selectedYear || '';
    const doc = new jsPDF();
    let y = 15;

    const addTitle = (text: string) => {
      if (y > 260) { doc.addPage(); y = 15; }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(text, 14, y);
      y += 8;
    };

    const addSubtitle = (text: string) => {
      if (y > 265) { doc.addPage(); y = 15; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(text, 14, y);
      y += 6;
    };

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`DRE e Fluxo de Caixa - ${monthName} ${year}`, 14, y);
    y += 10;

    // Saldo Inicial
    addTitle('SALDO INICIAL');
    const saldoRows = grouped.saldoInicial.map(r => [r.banco || r.descricao, fmt(r.valorBruto)]);
    saldoRows.push(['TOTAL', fmt(totals.totalSaldoInicial)]);
    autoTable(doc, {
      startY: y, head: [['Banco', 'Valor']], body: saldoRows,
      theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [66, 66, 66] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Receitas
    addTitle('RECEITAS');
    Object.entries(grouped.receitas).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
      addSubtitle(custo);
      const summary = computeCostCenterSummary(items);
      const summaryRows = [
        ['Valor Bruto Total', fmt(summary.totalBruto)],
        ['(-) Taxas', `-${fmt(summary.totalTaxas)}`],
        ['(+) Acréscimos', fmt(summary.totalAcrescimos)],
        ['= Valor Líquido', fmt(summary.totalLiquido)],
        ['(-) Impostos', `-${fmt(summary.totalImposto)}`],
        ['(-) Comissões Vendedores', `-${fmt(summary.totalVendedor)}`],
        ['(-) Comissões MKT', `-${fmt(summary.totalMkt)}`],
        ['= Resultado Líquido', fmt(summary.resultadoLiquido)],
      ];
      autoTable(doc, {
        startY: y, body: summaryRows, theme: 'plain', styles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: 'normal' }, 1: { halign: 'right', fontStyle: 'bold' } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      const detailRows = items.map(r => [r.date, r.descricao, r.detalhamento, fmt(r.valorBruto), fmt(r.valorLiquido), r.banco]);
      autoTable(doc, {
        startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Bruto', 'Líquido', 'Banco']], body: detailRows,
        theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [34, 139, 34] },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    });
    addSubtitle(`TOTAL RECEITAS: ${fmt(totals.totalReceitas)}`);
    y += 4;

    // Despesas
    addTitle('DESPESAS');
    Object.entries(grouped.despesas).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
      addSubtitle(custo);
      const total = items.reduce((s, r) => s + Math.abs(r.valorBruto), 0);
      const rows = items.map(r => [r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorBruto)), r.banco]);
      autoTable(doc, {
        startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
        theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [200, 50, 50] },
      });
      y = (doc as any).lastAutoTable.finalY + 2;
      addSubtitle(`Total ${custo}: ${fmt(total)}`);
      y += 2;
    });
    addSubtitle(`TOTAL DESPESAS: ${fmt(totals.totalDespesas)}`);
    y += 6;

    // Resultado
    addTitle(`RESULTADO DRE: ${fmt(totals.resultado)}`);
    y += 6;

    // Destinações
    if (Object.keys(grouped.destinacoes).length > 0) {
      addTitle('DESTINAÇÕES E UTILIZAÇÕES');
      Object.entries(grouped.destinacoes).sort(([a], [b]) => a.localeCompare(b)).forEach(([custo, items]) => {
        addSubtitle(custo);
        const rows = items.map(r => [r.date, r.descricao, r.detalhamento, fmt(Math.abs(r.valorBruto)), r.banco]);
        autoTable(doc, {
          startY: y, head: [['Data', 'Descrição', 'Detalhe', 'Valor', 'Banco']], body: rows,
          theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [180, 130, 30] },
        });
        y = (doc as any).lastAutoTable.finalY + 4;
      });
    }

    // Resgates
    if (grouped.resgates.length > 0) {
      addTitle('RESGATES');
      const rows = grouped.resgates.map(r => [r.date, r.descricao, fmt(r.valorBruto), r.banco]);
      autoTable(doc, {
        startY: y, head: [['Data', 'Descrição', 'Valor', 'Banco']], body: rows,
        theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [66, 66, 66] },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // Saldo Final
    addTitle('SALDO FINAL');
    const finalRows = fluxoBancos.map(b => [b.banco, fmt(b.saldoFinal)]);
    finalRows.push(['TOTAL', fmt(fluxoTotal.saldoFinal)]);
    autoTable(doc, {
      startY: y, head: [['Banco', 'Saldo Final']], body: finalRows,
      theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [66, 66, 66] },
    });

    doc.save(`DRE_FluxoCaixa_${monthName}_${year}.pdf`);
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Nenhum dado encontrado para o período selecionado. Verifique a conexão com a planilha.
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

      {/* RECEITAS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" style={{ color: 'hsl(var(--success))' }} />
          <h3 className="text-lg font-bold">RECEITAS</h3>
          <span className="font-bold" style={{ color: 'hsl(var(--success))' }}>{fmt(totals.totalReceitas)}</span>
        </div>
        {Object.entries(grouped.receitas)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([custo, items]) => renderCostCenterSection(custo, items, 'receita'))}
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
          .map(([custo, items]) => renderCostCenterSection(custo, items, 'despesa'))}
      </div>

      {/* RESULTADO DRE */}
      <Card className={`border-2 ${totals.resultado >= 0 ? 'border-primary' : 'border-destructive'}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <span className="font-bold text-lg">RESULTADO (Receitas - Despesas)</span>
          <span className={`text-xl font-bold ${totals.resultado >= 0 ? 'text-primary' : ''}`} style={totals.resultado < 0 ? { color: 'hsl(var(--destructive))' } : {}}>
            {fmt(totals.resultado)}
          </span>
        </CardContent>
      </Card>

      {/* DESTINAÇÕES */}
      {Object.keys(grouped.destinacoes).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" style={{ color: 'hsl(var(--warning))' }} />
            <h3 className="text-lg font-bold">DESTINAÇÕES E UTILIZAÇÕES</h3>
            <span className="font-bold" style={{ color: 'hsl(var(--warning))' }}>{fmt(totals.totalDestinacoes)}</span>
          </div>
          {Object.entries(grouped.destinacoes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([custo, items]) => renderCostCenterSection(custo, items, 'destinacao'))}
        </div>
      )}

      {/* RESGATES */}
      {grouped.resgates.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <Collapsible open={openSections['98-RESGATE']} onOpenChange={() => toggleSection('98-RESGATE')}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {openSections['98-RESGATE'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <CardTitle className="text-sm font-semibold">98-RESGATE</CardTitle>
                    <Badge variant="secondary" className="text-xs">{grouped.resgates.length}</Badge>
                  </div>
                  <span className="font-bold text-sm">{fmt(totals.totalResgates)}</span>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 px-4 pb-4">
                {renderItemList(grouped.resgates)}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* SALDO FINAL (simplificado) */}
      {fluxoBancos.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">SALDO FINAL</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {fluxoBancos.map(b => (
                <div key={b.banco} className="flex justify-between items-center p-2 rounded bg-muted/50">
                  <span className="text-xs font-medium">{b.banco}</span>
                  <span className="text-sm font-bold">{fmt(b.saldoFinal)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center p-2 rounded bg-primary/10 col-span-full md:col-span-1">
                <span className="text-xs font-bold">TOTAL</span>
                <span className="text-sm font-bold text-primary">{fmt(fluxoTotal.saldoFinal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DREFluxoCaixa;
