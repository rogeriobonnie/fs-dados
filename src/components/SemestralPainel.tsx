import { useMemo, useState } from 'react';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Wallet, TrendingUp, TrendingDown, Landmark, FileText, CalendarRange } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  allData: Pagina5Record[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const NON_BANKS = ['PROVISAO', 'PAGO', 'INVEST', 'L2', ''];

const calcSaldoFinalPorBanco = (monthData: Pagina5Record[]): Record<string, number> => {
  const bancos: Record<string, number> = {};
  monthData.forEach(r => {
    const banco = (r.banco || '').toUpperCase();
    if (NON_BANKS.includes(banco)) return;
    if (!bancos[r.banco]) bancos[r.banco] = 0;
    bancos[r.banco] += r.custoNum === 0 ? r.valorBruto : r.valorLiquido;
  });
  return bancos;
};

const calcSaldoInicialTransportado = (
  allData: Pagina5Record[],
  month: number,
  year: number,
  depth = 0,
): Record<string, number> | null => {
  if (depth > 12) return null;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevData = allData.filter(r => r.month === prevMonth && r.year === prevYear);
  if (prevData.length === 0) return null;

  const prevSaldoInicial = prevData.filter(r => r.custoNum === 0);
  if (prevSaldoInicial.length === 0) {
    const inherited = calcSaldoInicialTransportado(allData, prevMonth, prevYear, depth + 1);
    if (inherited) {
      const synthetic = Object.entries(inherited).map(([banco, valor]) => ({
        id: `sy-${banco}`, date: '', descricao: 'Saldo Transportado', detalhamento: '',
        custo: '00-Saldo Inicial', custoNum: 0, valorBruto: valor, taxas: 0, acrescimos: 0,
        valorLiquido: valor, banco, impAliq: 0, vrImposto: 0, vendedor: '', vrVendedor: 0,
        mkt: '', vrMkt: 0, month: prevMonth, year: prevYear, evento: '',
      } as Pagina5Record));
      return calcSaldoFinalPorBanco([...prevData, ...synthetic]);
    }
  }
  return calcSaldoFinalPorBanco(prevData);
};

const sumLiq = (items: Pagina5Record[]) => items.reduce((s, r) => s + r.valorLiquido, 0);
const sumAbs = (items: Pagina5Record[]) => items.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);

const SemestralPainel = ({ allData }: Props) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpenSections(p => ({ ...p, [k]: !p[k] }));

  // ── Semestres disponíveis ──
  const semesters = useMemo(() => {
    const set = new Set<string>();
    allData.forEach(r => {
      if (r.year > 0 && r.month >= 1 && r.month <= 12) set.add(`${r.year}-${r.month <= 6 ? 1 : 2}`);
    });
    set.add('2026-1');
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allData]);

  const [selected, setSelected] = useState('2026-1');
  const sem = semesters.includes(selected) ? selected : (semesters[0] || '2026-1');
  const [yearStr, semStr] = sem.split('-');
  const year = parseInt(yearStr);
  const semNum = parseInt(semStr);
  const months = semNum === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  const firstMonth = months[0];

  const semData = useMemo(
    () => allData.filter(r => r.year === year && months.includes(r.month)),
    [allData, year, semNum],
  );

  // ── Saldo inicial do semestre ──
  const saldoInicialBancos = useMemo(() => {
    const manual = allData.filter(r => r.year === year && r.month === firstMonth && r.custoNum === 0);
    if (manual.length > 0) {
      const map: Record<string, number> = {};
      manual.forEach(r => {
        if (NON_BANKS.includes((r.banco || '').toUpperCase())) return;
        map[r.banco] = (map[r.banco] || 0) + r.valorBruto;
      });
      return map;
    }
    return calcSaldoInicialTransportado(allData, firstMonth, year) || {};
  }, [allData, year, firstMonth]);

  const saldoInicialTotal = useMemo(
    () => Object.values(saldoInicialBancos).reduce((s, v) => s + v, 0),
    [saldoInicialBancos],
  );

  // ── Agrupamentos ──
  const grouped = useMemo(() => {
    const receitas: Record<string, Pagina5Record[]> = {};
    const outrasEntradas: Record<string, Pagina5Record[]> = {};
    const despesas: Record<string, Pagina5Record[]> = {};
    const destinacoes: Record<string, Pagina5Record[]> = {};
    const provisoes: Record<string, Pagina5Record[]> = {};
    const outrasSaidas: Record<string, Pagina5Record[]> = {};

    const push = (obj: Record<string, Pagina5Record[]>, key: string, r: Pagina5Record) => {
      if (!obj[key]) obj[key] = [];
      obj[key].push(r);
    };

    semData.forEach(r => {
      const cn = r.custoNum;
      if (cn === 0 || cn === 99) return;
      if (cn >= 1 && cn <= 10) push(receitas, r.custo, r);
      else if (cn === 96 || cn === 97 || cn === 98) push(outrasEntradas, r.custo, r);
      else if (cn >= 11 && cn <= 20) {
        if ((r.banco || '').toUpperCase() === 'PAGO') return;
        push(despesas, cn === 15 ? '15-CURSOS' : r.custo, r);
      } else if (cn >= 21 && cn <= 30) push(destinacoes, r.custo, r);
      else if (cn === 31 && (r.banco || '').toUpperCase() === 'PROVISAO') push(provisoes, r.custo, r);
      else push(outrasSaidas, r.custo || 'Outros', r);
    });

    return { receitas, outrasEntradas, despesas, destinacoes, provisoes, outrasSaidas };
  }, [semData]);

  const totalReceitas = useMemo(() => sumLiq(Object.values(grouped.receitas).flat()), [grouped]);
  const totalOutrasEntradas = useMemo(() => sumLiq(Object.values(grouped.outrasEntradas).flat()), [grouped]);
  const totalEntradas = totalReceitas + totalOutrasEntradas;

  const totalDespesas = useMemo(() => sumAbs(Object.values(grouped.despesas).flat()), [grouped]);
  const totalDestinacoes = useMemo(() => sumAbs(Object.values(grouped.destinacoes).flat()), [grouped]);
  const totalOutrasSaidas = useMemo(() => sumAbs(Object.values(grouped.outrasSaidas).flat()), [grouped]);
  const totalProvisoes = useMemo(() => sumAbs(Object.values(grouped.provisoes).flat()), [grouped]);
  const totalSaidas = totalDespesas + totalDestinacoes + totalOutrasSaidas;

  const resultado = totalEntradas - totalSaidas;
  const saldoFinal = saldoInicialTotal + resultado;

  // ── Mês a mês ──
  const mensal = useMemo(() => {
    let acumulado = saldoInicialTotal;
    return months.map(m => {
      const md = semData.filter(r => r.month === m);
      let entradas = 0;
      let saidas = 0;
      md.forEach(r => {
        const cn = r.custoNum;
        if (cn === 0 || cn === 99) return;
        if ((cn >= 1 && cn <= 10) || cn === 96 || cn === 97 || cn === 98) entradas += r.valorLiquido;
        else if (cn >= 11 && cn <= 20) {
          if ((r.banco || '').toUpperCase() !== 'PAGO') saidas += Math.abs(r.valorLiquido);
        } else if (cn === 31 && (r.banco || '').toUpperCase() === 'PROVISAO') return;
        else saidas += Math.abs(r.valorLiquido);
      });
      const res = entradas - saidas;
      acumulado += res;
      return { month: m, entradas, saidas, resultado: res, acumulado };
    });
  }, [semData, months, saldoInicialTotal]);

  // ── Bancos ──
  const bancos = useMemo(() => {
    const map: Record<string, { banco: string; saldoInicial: number; entradas: number; saidas: number }> = {};
    const ensure = (banco: string) => {
      const up = (banco || '').toUpperCase();
      if (NON_BANKS.includes(up)) return null;
      if (!map[banco]) map[banco] = { banco, saldoInicial: 0, entradas: 0, saidas: 0 };
      return map[banco];
    };
    Object.entries(saldoInicialBancos).forEach(([banco, valor]) => {
      const b = ensure(banco);
      if (b) b.saldoInicial += valor;
    });
    semData.forEach(r => {
      if (r.custoNum === 0) return;
      const b = ensure(r.banco);
      if (!b) return;
      if (r.valorLiquido >= 0) b.entradas += r.valorLiquido;
      else b.saidas += Math.abs(r.valorLiquido);
    });
    return Object.values(map)
      .map(b => ({ ...b, saldoFinal: b.saldoInicial + b.entradas - b.saidas }))
      .sort((a, b) => a.banco.localeCompare(b.banco));
  }, [semData, saldoInicialBancos]);

  const bancosTotal = bancos.reduce(
    (acc, b) => ({
      saldoInicial: acc.saldoInicial + b.saldoInicial,
      entradas: acc.entradas + b.entradas,
      saidas: acc.saidas + b.saidas,
      saldoFinal: acc.saldoFinal + b.saldoFinal,
    }),
    { saldoInicial: 0, entradas: 0, saidas: 0, saldoFinal: 0 },
  );

  // ── UI helpers ──
  const renderGroupTable = (
    title: string,
    groups: Record<string, Pagina5Record[]>,
    tone: 'green' | 'red',
    prefix: string,
  ) => {
    const entries = Object.entries(groups).sort(
      (a, b) => sumAbs(b[1]) - sumAbs(a[1]),
    );
    if (entries.length === 0) return null;
    const total = entries.reduce((s, [, items]) => s + sumAbs(items), 0);
    const color = tone === 'green' ? 'text-emerald-600' : 'text-red-600';

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-semibold">{title}</span>
          <span className={`text-sm font-bold ${color}`}>{fmt(total)}</span>
        </div>
        <div className="rounded-md border divide-y">
          {entries.map(([key, items]) => {
            const open = !!openSections[prefix + key];
            const subs = Array.from(new Set(items.map(i => i.custo))).sort();
            return (
              <Collapsible key={key} open={open} onOpenChange={() => toggle(prefix + key)}>
                <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50">
                  <span className="flex items-center gap-2 text-sm">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {key}
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </span>
                  <span className={`text-sm font-medium ${color}`}>{fmt(sumAbs(items))}</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="bg-muted/30 px-3 pb-3">
                  {subs.length > 1 && (
                    <div className="mb-2 flex flex-wrap gap-2 pt-2">
                      {subs.map(s => (
                        <span key={s} className="rounded bg-background px-2 py-1 text-xs">
                          {s}: <strong>{fmt(sumAbs(items.filter(i => i.custo === s)))}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="py-1 text-xs">Data</TableHead>
                        <TableHead className="py-1 text-xs">Descrição</TableHead>
                        <TableHead className="py-1 text-xs">Detalhamento</TableHead>
                        <TableHead className="py-1 text-xs">Banco</TableHead>
                        <TableHead className="py-1 text-right text-xs">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items
                        .slice()
                        .sort((a, b) => a.month - b.month)
                        .map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="py-1 text-xs">{r.date}</TableCell>
                            <TableCell className="py-1 text-xs">{r.descricao}</TableCell>
                            <TableCell className="py-1 text-xs">{r.detalhamento}</TableCell>
                            <TableCell className="py-1 text-xs">{r.banco}</TableCell>
                            <TableCell className="py-1 text-right text-xs">{fmt(Math.abs(r.valorLiquido))}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    );
  };

  // ── PDF ──
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 0, W, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text(`Resultado Semestral ${year}/${semNum}`, 14, 11);
    doc.setFontSize(9);
    doc.text(`${MONTH_SHORT[months[0] - 1]} a ${MONTH_SHORT[months[5] - 1]} de ${year}`, 14, 18);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 30,
      head: [['Indicador', 'Valor']],
      body: [
        ['Saldo Inicial do Semestre', fmt(saldoInicialTotal)],
        ['(+) Total de Entradas', fmt(totalEntradas)],
        ['(-) Total de Saídas', fmt(totalSaidas)],
        ['(=) Resultado do Semestre', fmt(resultado)],
        ['(=) Saldo Final', fmt(saldoFinal)],
        ['Provisões (não afetam caixa)', fmt(totalProvisoes)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [14, 165, 233], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    const monthRows = mensal.map(m => [
      MONTH_SHORT[m.month - 1],
      fmt(m.entradas),
      fmt(m.saidas),
      fmt(m.resultado),
      fmt(m.acumulado),
    ]);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Mês', 'Entradas', 'Saídas', 'Resultado', 'Saldo Acum.']],
      body: monthRows,
      foot: [['Total', fmt(totalEntradas), fmt(totalSaidas), fmt(resultado), fmt(saldoFinal)]],
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
      footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    const sectionTable = (
      title: string,
      groups: Record<string, Pagina5Record[]>,
      fill: [number, number, number],
    ) => {
      const entries = Object.entries(groups).sort((a, b) => sumAbs(b[1]) - sumAbs(a[1]));
      if (entries.length === 0) return;
      const body: any[] = [];
      const subtotalIdx = new Set<number>();
      entries.forEach(([key, items]) => {
        items
          .slice()
          .sort((a, b) => a.month - b.month)
          .forEach(r => body.push([key, r.date, r.descricao, r.banco, fmt(Math.abs(r.valorLiquido))]));
        subtotalIdx.add(body.length);
        body.push([`Subtotal — ${key} (${items.length})`, '', '', '', fmt(sumAbs(items))]);
      });
      const total = entries.reduce((s, [, items]) => s + sumAbs(items), 0);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [[title, 'Data', 'Descrição', 'Banco', 'Valor']],
        body,
        foot: [['TOTAL', '', '', '', fmt(total)]],
        theme: 'grid',
        headStyles: { fillColor: fill, fontSize: 8 },
        footStyles: { fillColor: fill, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 0: { cellWidth: 42 }, 4: { halign: 'right', cellWidth: 26 } },
        margin: { left: 14, right: 14 },
        showHead: 'everyPage',
        didParseCell: d => {
          if (d.section === 'body' && subtotalIdx.has(d.row.index)) {
            d.cell.styles.fillColor = [243, 244, 246];
            d.cell.styles.fontStyle = 'bold';
          }
        },
      });
    };

    sectionTable('Entradas — Receitas', grouped.receitas, [16, 122, 87]);
    sectionTable('Entradas — Outras', grouped.outrasEntradas, [16, 122, 87]);
    sectionTable('Saídas — Despesas', grouped.despesas, [185, 28, 28]);
    sectionTable('Saídas — Destinações', grouped.destinacoes, [185, 28, 28]);
    sectionTable('Saídas — Outros', grouped.outrasSaidas, [185, 28, 28]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Banco', 'Saldo Inicial', 'Entradas', 'Saídas', 'Saldo Final']],
      body: bancos.map(b => [b.banco, fmt(b.saldoInicial), fmt(b.entradas), fmt(b.saidas), fmt(b.saldoFinal)]),
      foot: [['TOTAL', fmt(bancosTotal.saldoInicial), fmt(bancosTotal.entradas), fmt(bancosTotal.saidas), fmt(bancosTotal.saldoFinal)]],
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
      footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    doc.save(`resultado-semestral-${year}-${semNum}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sky-500 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <CalendarRange className="h-5 w-5" />
          <h2 className="text-lg font-bold">Resultado Semestral</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sem} onValueChange={setSelected}>
            <SelectTrigger className="w-[130px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semesters.map(s => (
                <SelectItem key={s} value={s}>{s.replace('-', '/')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" size="sm" onClick={exportPDF}>
            <FileText className="mr-1 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Saldo Inicial', value: saldoInicialTotal, icon: Wallet, color: 'text-sky-600' },
          { label: 'Entradas', value: totalEntradas, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Saídas', value: totalSaidas, icon: TrendingDown, color: 'text-red-600' },
          { label: 'Resultado', value: resultado, icon: TrendingUp, color: resultado >= 0 ? 'text-emerald-600' : 'text-red-600' },
          { label: 'Saldo Final', value: saldoFinal, icon: Landmark, color: 'text-sky-600' },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className={`mt-1 text-lg font-bold ${c.color}`}>{fmt(c.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mês a mês */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução mês a mês</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Saldo Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mensal.map(m => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium">{MONTH_SHORT[m.month - 1]}</TableCell>
                  <TableCell className="text-right text-emerald-600">{fmt(m.entradas)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmt(m.saidas)}</TableCell>
                  <TableCell className={`text-right font-medium ${m.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(m.resultado)}</TableCell>
                  <TableCell className="text-right">{fmt(m.acumulado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold text-emerald-600">{fmt(totalEntradas)}</TableCell>
                <TableCell className="text-right font-bold text-red-600">{fmt(totalSaidas)}</TableCell>
                <TableCell className={`text-right font-bold ${resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(resultado)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(saldoFinal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Fluxo de caixa */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /> Entradas</span>
              <span className="text-emerald-600">{fmt(totalEntradas)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderGroupTable('Receitas (1-10)', grouped.receitas, 'green', 'rec-')}
            {renderGroupTable('Outras entradas (96/97/98)', grouped.outrasEntradas, 'green', 'oe-')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-600" /> Saídas</span>
              <span className="text-red-600">{fmt(totalSaidas)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderGroupTable('Despesas (11-20)', grouped.despesas, 'red', 'des-')}
            {renderGroupTable('Destinações (21-30)', grouped.destinacoes, 'red', 'dest-')}
            {renderGroupTable('Outras saídas (32/33/50/51/52)', grouped.outrasSaidas, 'red', 'os-')}
            {renderGroupTable('Provisões (31) — não afetam o caixa', grouped.provisoes, 'red', 'prov-')}
          </CardContent>
        </Card>
      </div>

      {/* Bancos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4" /> Saldos por banco</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead className="text-right">Saldo Inicial</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bancos.map(b => (
                <TableRow key={b.banco}>
                  <TableCell className="font-medium">{b.banco}</TableCell>
                  <TableCell className="text-right">{fmt(b.saldoInicial)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{fmt(b.entradas)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmt(b.saidas)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(b.saldoFinal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">TOTAL</TableCell>
                <TableCell className="text-right font-bold">{fmt(bancosTotal.saldoInicial)}</TableCell>
                <TableCell className="text-right font-bold text-emerald-600">{fmt(bancosTotal.entradas)}</TableCell>
                <TableCell className="text-right font-bold text-red-600">{fmt(bancosTotal.saidas)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(bancosTotal.saldoFinal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SemestralPainel;
