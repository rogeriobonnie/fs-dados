import { useState, useEffect, useMemo } from 'react';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronRight, DollarSign, BarChart3, Minus } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area } from 'recharts';

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

const HistoricoAnual = () => {
  const [data, setData] = useState<Pagina5Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [expandedCusto, setExpandedCusto] = useState<string | null>(null);

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

        // Build cost center breakdown
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

  const chartData = useMemo(() =>
    yearSummaries.map(y => ({
      ano: y.year.toString(),
      Receitas: y.receitas,
      Despesas: y.despesas,
      Resultado: y.resultado,
      'Dist. Lucros': y.distribuicao,
    })), [yearSummaries]);

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

                {/* Progress bar */}
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

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart - Receitas vs Despesas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Receitas vs Despesas
              </CardTitle>
              <CardDescription>Comparativo anual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="ano" />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="Receitas" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesas" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Dist. Lucros" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Line Chart - Evolução do Resultado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolução do Resultado
              </CardTitle>
              <CardDescription>Resultado operacional ao longo dos anos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="ano" />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Area dataKey="Resultado" fill="hsl(221 83% 53% / 0.15)" stroke="hsl(221 83% 53%)" strokeWidth={3} />
                    <Line dataKey="Receitas" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line dataKey="Despesas" stroke="hsl(0 72% 51%)" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comparative Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tabela Comparativa</CardTitle>
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
