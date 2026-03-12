import { useState, useEffect, useMemo } from 'react';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronRight, BarChart3, Minus } from 'lucide-react';

interface YearSummary {
  year: number;
  receitas: number;
  despesas: number;
  resultado: number;
  distribuicao: number;
  margem: number;
  records: Pagina5Record[];
  centroCustoBreakdown: { custo: string; custoNum: number; total: number; items: Pagina5Record[] }[];
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtCompact = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
};

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const HistoricoAnual = () => {
  const [data, setData] = useState<Pagina5Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [expandedCusto, setExpandedCusto] = useState<string | null>(null);
  const [selectedDetailYear, setSelectedDetailYear] = useState<number>(2025);
  const [expandedDespRow, setExpandedDespRow] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await GoogleSheetsService.fetchFluxoCaixaHistorico();
      setData(records);
    } catch (err) {
      setError('Erro ao carregar dados históricos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const yearSummaries: YearSummary[] = useMemo(() => {
    const byYear: Record<number, Pagina5Record[]> = {};
    data.forEach(r => {
      if (!r.year) return;
      if (!byYear[r.year]) byYear[r.year] = [];
      byYear[r.year].push(r);
    });

    return Object.keys(byYear)
      .map(Number)
      .sort((a, b) => a - b)
      .map(year => {
        const records = byYear[year];
        const receitas = records
          .filter(r => r.custoNum >= 1 && r.custoNum <= 10)
          .reduce((s, r) => s + r.valorLiquido, 0);
        const despesas = records
          .filter(r => r.custoNum >= 11 && r.custoNum <= 20)
          .reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
        const distribuicao = records
          .filter(r => r.custoNum === 21)
          .reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
        const resultado = receitas - despesas;
        const margem = receitas > 0 ? (resultado / receitas) * 100 : 0;

        const custoMap: Record<string, { custo: string; custoNum: number; total: number; items: Pagina5Record[] }> = {};
        records.forEach(r => {
          const key = r.custo || `${r.custoNum}-Sem categoria`;
          if (!custoMap[key]) custoMap[key] = { custo: key, custoNum: r.custoNum, total: 0, items: [] };
          custoMap[key].total += r.valorLiquido;
          custoMap[key].items.push(r);
        });
        const centroCustoBreakdown = Object.values(custoMap).sort((a, b) => a.custoNum - b.custoNum);

        return { year, receitas, despesas, resultado, distribuicao, margem, records, centroCustoBreakdown };
      });
  }, [data]);

  // Receitas consolidadas por centro de custo (2024 e 2025)
  const receitasPorCusto = useMemo(() => {
    const filtered = data.filter(r => (r.year === 2024 || r.year === 2025) && r.custoNum >= 1 && r.custoNum <= 10);
    const map: Record<string, { custo: string; custoNum: number; total2024: number; total2025: number }> = {};
    filtered.forEach(r => {
      const key = r.custo || `${r.custoNum}-Sem categoria`;
      if (!map[key]) map[key] = { custo: key, custoNum: r.custoNum, total2024: 0, total2025: 0 };
      if (r.year === 2024) map[key].total2024 += r.valorLiquido;
      else map[key].total2025 += r.valorLiquido;
    });
    return Object.values(map).sort((a, b) => a.custoNum - b.custoNum);
  }, [data]);

  // Despesas matriz: centro de custo × mês
  const despesasMatriz = useMemo(() => {
    const filtered = data.filter(r => r.year === selectedDetailYear && r.custoNum >= 11 && r.custoNum <= 20);
    const map: Record<string, { custo: string; custoNum: number; months: number[]; items: Pagina5Record[][] }> = {};
    filtered.forEach(r => {
      const key = r.custo || `${r.custoNum}-Sem categoria`;
      if (!map[key]) map[key] = { custo: key, custoNum: r.custoNum, months: Array(12).fill(0), items: Array.from({ length: 12 }, () => []) };
      const mi = (r.month || 1) - 1;
      map[key].months[mi] += Math.abs(r.valorLiquido);
      map[key].items[mi].push(r);
    });
    return Object.values(map).sort((a, b) => a.custoNum - b.custoNum);
  }, [data, selectedDetailYear]);

  const despMonthTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    despesasMatriz.forEach(row => {
      row.months.forEach((v, i) => { totals[i] += v; });
    });
    return totals;
  }, [despesasMatriz]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive font-medium">{error}</p>
          <Button onClick={loadData} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalRec2024 = receitasPorCusto.reduce((s, r) => s + r.total2024, 0);
  const totalRec2025 = receitasPorCusto.reduce((s, r) => s + r.total2025, 0);
  const varRecTotal = totalRec2024 !== 0 ? ((totalRec2025 - totalRec2024) / Math.abs(totalRec2024)) * 100 : 0;
  const totalDespGeral = despMonthTotals.reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Histórico Financeiro
          </h2>
          <p className="text-muted-foreground mt-1">Evolução anual da empresa desde 2022</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* Year Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {yearSummaries.map(y => {
          const isSelected = selectedYear === y.year;
          const recVsDesp = y.receitas > 0 ? Math.min((y.despesas / y.receitas) * 100, 100) : 0;
          const isPositive = y.resultado >= 0;

          return (
            <Card
              key={y.year}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
                isSelected ? 'ring-2 ring-primary shadow-lg' : ''
              }`}
              onClick={() => setSelectedYear(isSelected ? null : y.year)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-black text-primary">{y.year}</CardTitle>
                  {isPositive ? (
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receitas</span>
                    <span className="font-semibold text-emerald-600">R$ {fmtCompact(y.receitas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Despesas</span>
                    <span className="font-semibold text-destructive">R$ {fmtCompact(y.despesas)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="font-medium">Resultado</span>
                    <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-destructive'}`}>
                      {isPositive ? '+' : ''}R$ {fmtCompact(y.resultado)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Dist. Lucros</span>
                    <span className="text-xs font-medium">R$ {fmtCompact(y.distribuicao)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Desp/Rec</span>
                    <span>{recVsDesp.toFixed(0)}%</span>
                  </div>
                  <Progress value={recVsDesp} className="h-2" />
                </div>

                <div className={`text-center text-xs font-bold py-1 rounded ${
                  y.margem >= 30 ? 'bg-emerald-100 text-emerald-700' :
                  y.margem >= 10 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  Margem: {y.margem.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Receitas Consolidadas por Centro de Custo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Receitas por Centro de Custo — 2024 vs 2025
          </CardTitle>
          <CardDescription>Consolidado sem detalhamento</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centro de Custo</TableHead>
                <TableHead className="text-right">2024</TableHead>
                <TableHead className="text-right">2025</TableHead>
                <TableHead className="text-right">Variação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receitasPorCusto.map(r => {
                const variacao = r.total2024 !== 0 ? ((r.total2025 - r.total2024) / Math.abs(r.total2024)) * 100 : 0;
                return (
                  <TableRow key={r.custo}>
                    <TableCell className="font-medium">{r.custo}</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmt(r.total2024)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmt(r.total2025)}</TableCell>
                    <TableCell className={`text-right font-bold ${variacao >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right text-emerald-600">{fmt(totalRec2024)}</TableCell>
                <TableCell className="text-right text-emerald-600">{fmt(totalRec2025)}</TableCell>
                <TableCell className={`text-right ${varRecTotal >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {varRecTotal >= 0 ? '+' : ''}{varRecTotal.toFixed(1)}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Despesas Matriz: Centro de Custo × Mês */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                Despesas por Centro de Custo — Mensal
              </CardTitle>
              <CardDescription>Clique em uma linha para ver o detalhamento</CardDescription>
            </div>
            <div className="flex gap-1">
              {[2024, 2025].map(yr => (
                <Button
                  key={yr}
                  variant={selectedDetailYear === yr ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setSelectedDetailYear(yr); setExpandedDespRow(null); }}
                >
                  {yr}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Centro de Custo</TableHead>
                    {MONTH_NAMES.map(m => (
                      <TableHead key={m} className="text-right min-w-[80px]">{m}</TableHead>
                    ))}
                    <TableHead className="text-right min-w-[100px] font-bold">TOTAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesasMatriz.map(row => {
                    const rowTotal = row.months.reduce((s, v) => s + v, 0);
                    const isExpanded = expandedDespRow === row.custo;
                    return (
                      <Collapsible key={row.custo} open={isExpanded} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setExpandedDespRow(isExpanded ? null : row.custo)}
                            >
                              <TableCell className="sticky left-0 bg-background z-10 font-medium">
                                <div className="flex items-center gap-1">
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  {row.custo}
                                </div>
                              </TableCell>
                              {row.months.map((v, i) => (
                                <TableCell key={i} className="text-right text-sm tabular-nums">
                                  {v > 0 ? fmt(v) : <span className="text-muted-foreground">-</span>}
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-bold text-destructive tabular-nums">
                                {fmt(rowTotal)}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <tr>
                              <td colSpan={14} className="p-0">
                                <div className="bg-muted/20 px-4 py-3 border-y">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    Detalhamento — {row.custo} — {selectedDetailYear}
                                  </p>
                                  <div className="space-y-0.5 max-h-64 overflow-y-auto">
                                    {row.items.map((monthItems, mi) =>
                                      monthItems.map((item, idx) => (
                                        <div key={`${mi}-${idx}`} className="flex justify-between text-xs py-0.5 px-2 rounded hover:bg-muted/30">
                                          <div className="flex gap-3 items-center">
                                            <Minus className="h-2 w-2 text-muted-foreground" />
                                            <span className="text-muted-foreground w-8">{MONTH_NAMES[mi]}</span>
                                            <span className="text-muted-foreground">{item.date}</span>
                                            <span className="truncate max-w-[250px]">{item.descricao}</span>
                                            {item.detalhamento && (
                                              <span className="text-muted-foreground truncate max-w-[150px]">· {item.detalhamento}</span>
                                            )}
                                          </div>
                                          <span className="font-medium text-destructive whitespace-nowrap">
                                            {fmt(Math.abs(item.valorLiquido))}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell className="sticky left-0 bg-muted/50 z-10">TOTAL</TableCell>
                    {despMonthTotals.map((v, i) => (
                      <TableCell key={i} className="text-right text-destructive tabular-nums">
                        {v > 0 ? fmt(v) : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-destructive tabular-nums">
                      {fmt(totalDespGeral)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Comparative Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tabela Comparativa Anual</CardTitle>
          <CardDescription>Clique em um ano para ver o detalhamento por centro de custo</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">Receitas</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Dist. Lucros</TableHead>
                <TableHead className="text-right">Margem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearSummaries.map(y => {
                const isExpanded = selectedYear === y.year;
                return (
                  <Collapsible key={y.year} open={isExpanded} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedYear(isExpanded ? null : y.year)}
                        >
                          <TableCell>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="font-bold text-primary">{y.year}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">{fmt(y.receitas)}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">{fmt(y.despesas)}</TableCell>
                          <TableCell className={`text-right font-bold ${y.resultado >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                            {y.resultado >= 0 ? '+' : ''}{fmt(y.resultado)}
                          </TableCell>
                          <TableCell className="text-right">{fmt(y.distribuicao)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              y.margem >= 30 ? 'bg-emerald-100 text-emerald-700' :
                              y.margem >= 10 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {y.margem.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={7} className="p-0">
                            <div className="bg-muted/30 px-6 py-4 space-y-2 border-y">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                Centros de Custo — {y.year}
                              </p>
                              {y.centroCustoBreakdown.map(cc => {
                                const ccKey = `${y.year}-${cc.custo}`;
                                const isCcExpanded = expandedCusto === ccKey;
                                return (
                                  <Collapsible key={cc.custo} open={isCcExpanded}>
                                    <CollapsibleTrigger
                                      className="w-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedCusto(isCcExpanded ? null : ccKey);
                                      }}
                                    >
                                      <div className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                          {isCcExpanded ? (
                                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                          )}
                                          <span className="text-sm font-medium">{cc.custo || 'Sem categoria'}</span>
                                          <span className="text-xs text-muted-foreground">({cc.items.length} itens)</span>
                                        </div>
                                        <span className={`text-sm font-bold ${cc.total >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                          {fmt(cc.total)}
                                        </span>
                                      </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <div className="ml-8 mt-1 mb-2 space-y-0.5">
                                        {cc.items.slice(0, 50).map((item, idx) => (
                                          <div key={idx} className="flex justify-between text-xs py-0.5 px-2 rounded hover:bg-muted/30">
                                            <div className="flex gap-3 items-center">
                                              <Minus className="h-2 w-2 text-muted-foreground" />
                                              <span className="text-muted-foreground">{item.date}</span>
                                              <span className="truncate max-w-[200px]">{item.descricao}</span>
                                              {item.detalhamento && (
                                                <span className="text-muted-foreground truncate max-w-[150px]">· {item.detalhamento}</span>
                                              )}
                                            </div>
                                            <span className={`font-medium ${item.valorLiquido >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                              {fmt(item.valorLiquido)}
                                            </span>
                                          </div>
                                        ))}
                                        {cc.items.length > 50 && (
                                          <p className="text-xs text-muted-foreground ml-5">
                                            ... e mais {cc.items.length - 50} itens
                                          </p>
                                        )}
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}

              {/* Totals row */}
              {yearSummaries.length > 0 && (() => {
                const totRec = yearSummaries.reduce((s, y) => s + y.receitas, 0);
                const totDesp = yearSummaries.reduce((s, y) => s + y.despesas, 0);
                const totRes = totRec - totDesp;
                const totDist = yearSummaries.reduce((s, y) => s + y.distribuicao, 0);
                const totMarg = totRec > 0 ? (totRes / totRec) * 100 : 0;
                return (
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell></TableCell>
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmt(totRec)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(totDesp)}</TableCell>
                    <TableCell className={`text-right ${totRes >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {totRes >= 0 ? '+' : ''}{fmt(totRes)}
                    </TableCell>
                    <TableCell className="text-right">{fmt(totDist)}</TableCell>
                    <TableCell className="text-right">{totMarg.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoricoAnual;
