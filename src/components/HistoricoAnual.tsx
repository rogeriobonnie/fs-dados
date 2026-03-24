import { useState, useEffect, useMemo } from 'react';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronRight, BarChart3, Minus, DollarSign, Trophy, Users, ShoppingCart, Star } from 'lucide-react';

interface EduzzRecord {
  date: string;
  curso: string;
  aluno: string;
  valor: number;
  valorLiquido: number;
  taxas: number;
  month: number;
  year: number;
}

interface YearSummary {
  year: number;
  receitas: number;
  despesas: number;
  resultado: number;
  aplicacao: number;
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
  const [eduzzData, setEduzzData] = useState<EduzzRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [expandedCusto, setExpandedCusto] = useState<string | null>(null);
  const [selectedDetailYear, setSelectedDetailYear] = useState<number>(2025);
  const [expandedDespRow, setExpandedDespRow] = useState<string | null>(null);
  const [selectedEduzzYear, setSelectedEduzzYear] = useState<number>(2025);
  const [expandedEduzzCurso, setExpandedEduzzCurso] = useState<string | null>(null);
  const [expandedEduzzCursoYear, setExpandedEduzzCursoYear] = useState<string | null>(null);
  const [expandedEduzzCursoMonth, setExpandedEduzzCursoMonth] = useState<string | null>(null);
  const [expandedReceitaCusto, setExpandedReceitaCusto] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [records, eduzz] = await Promise.all([
        GoogleSheetsService.fetchFluxoCaixaHistorico(),
        GoogleSheetsService.fetchPagina6Data(),
      ]);
      setData(records);
      setEduzzData(eduzz.filter(r => r.year <= 2025));
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
          .filter(r => r.custoNum >= 1 && r.custoNum <= 10 && r.custoNum !== 7)
          .reduce((s, r) => s + r.valorLiquido, 0);
        const despesas = records
          .filter(r => r.custoNum >= 11 && r.custoNum <= 20)
          .reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
        const aplicacao = records
          .filter(r => r.custoNum === 7)
          .reduce((s, r) => s + r.valorLiquido, 0);
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

        return { year, receitas, despesas, resultado, aplicacao, distribuicao, margem, records, centroCustoBreakdown };
      });
  }, [data]);

  // Receitas operacionais por centro de custo (2024 e 2025) — exclui 07-Aplicação/Rendimento
  const receitasPorCusto = useMemo(() => {
    const filtered = data.filter(r => (r.year === 2024 || r.year === 2025) && r.custoNum >= 1 && r.custoNum <= 10 && r.custoNum !== 7);
    const map: Record<string, { custo: string; custoNum: number; total2024: number; total2025: number; qtd2024: number; qtd2025: number }> = {};
    filtered.forEach(r => {
      const key = r.custo || `${r.custoNum}-Sem categoria`;
      if (!map[key]) map[key] = { custo: key, custoNum: r.custoNum, total2024: 0, total2025: 0, qtd2024: 0, qtd2025: 0 };
      if (r.year === 2024) { map[key].total2024 += r.valorLiquido; map[key].qtd2024++; }
      else { map[key].total2025 += r.valorLiquido; map[key].qtd2025++; }
    });
    return Object.values(map).sort((a, b) => a.custoNum - b.custoNum);
  }, [data]);

  // Receitas operacionais: detalhe por centro de custo → ano → mês
  const receitasDetalhe = useMemo(() => {
    const filtered = data.filter(r => (r.year === 2024 || r.year === 2025) && r.custoNum >= 1 && r.custoNum <= 10 && r.custoNum !== 7);
    const map: Record<string, Record<number, number[]>> = {};
    filtered.forEach(r => {
      const key = r.custo || `${r.custoNum}-Sem categoria`;
      if (!map[key]) map[key] = { 2024: Array(12).fill(0), 2025: Array(12).fill(0) };
      const mi = (r.month || 1) - 1;
      map[key][r.year][mi] += r.valorLiquido;
    });
    return map;
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

  // Aplicações/Rendimentos (custoNum 7) e Lucros Divididos (custoNum 21) — 2024 vs 2025
  const aplicacoesLucros = useMemo(() => {
    const groups = [
      { label: '07-Aplicação/Rendimento', custoFilter: (n: number) => n === 7 },
      { label: '21-Lucros Divididos', custoFilter: (n: number) => n === 21 },
    ];
    return groups.map(g => {
      const filtered = data.filter(r => (r.year === 2024 || r.year === 2025) && g.custoFilter(r.custoNum));
      const total2024 = filtered.filter(r => r.year === 2024).reduce((s, r) => s + r.valorLiquido, 0);
      const total2025 = filtered.filter(r => r.year === 2025).reduce((s, r) => s + r.valorLiquido, 0);
      const items2024 = filtered.filter(r => r.year === 2024);
      const items2025 = filtered.filter(r => r.year === 2025);
      const variacao = total2024 !== 0 ? ((total2025 - total2024) / Math.abs(total2024)) * 100 : 0;
      return { label: g.label, total2024, total2025, variacao, items2024, items2025 };
    });
  }, [data]);

  // Eduzz: ranking year filter
  const [eduzzRankingYear, setEduzzRankingYear] = useState<'todos' | number>('todos');
  const eduzzRankingYears = useMemo(() => [...new Set(eduzzData.map(r => r.year))].filter(Boolean).sort(), [eduzzData]);

  // Eduzz: ranking de cursos (filtrado por ano)
  const eduzzRanking = useMemo(() => {
    const filtered = eduzzRankingYear === 'todos' ? eduzzData : eduzzData.filter(r => r.year === eduzzRankingYear);
    const map: Record<string, { curso: string; vendas: number; alunos: Set<string>; valor: number; valorLiquido: number; taxas: number; bestMonth: string; bestMonthVal: number; monthMap: Record<string, number> }> = {};
    filtered.forEach(r => {
      if (!map[r.curso]) map[r.curso] = { curso: r.curso, vendas: 0, alunos: new Set(), valor: 0, valorLiquido: 0, taxas: 0, bestMonth: '', bestMonthVal: 0, monthMap: {} };
      const e = map[r.curso];
      e.vendas++;
      if (r.aluno) e.alunos.add(r.aluno);
      e.valor += r.valor;
      e.valorLiquido += r.valorLiquido;
      e.taxas += Math.abs(r.taxas);
      const mk = `${MONTH_NAMES[(r.month || 1) - 1]}/${r.year}`;
      e.monthMap[mk] = (e.monthMap[mk] || 0) + r.valor;
      if (e.monthMap[mk] > e.bestMonthVal) { e.bestMonthVal = e.monthMap[mk]; e.bestMonth = mk; }
    });
    return Object.values(map)
      .map(e => ({ ...e, alunosCount: e.alunos.size }))
      .sort((a, b) => b.valor - a.valor);
  }, [eduzzData, eduzzRankingYear]);

  // Eduzz: matriz de vendas por mês
  const eduzzMatriz = useMemo(() => {
    const filtered = eduzzData.filter(r => r.year === selectedEduzzYear);
    const map: Record<string, { curso: string; months: number[]; items: EduzzRecord[][] }> = {};
    filtered.forEach(r => {
      if (!map[r.curso]) map[r.curso] = { curso: r.curso, months: Array(12).fill(0), items: Array.from({ length: 12 }, () => []) };
      const mi = (r.month || 1) - 1;
      map[r.curso].months[mi]++;
      map[r.curso].items[mi].push(r);
    });
    return Object.values(map).sort((a, b) => b.months.reduce((s, v) => s + v, 0) - a.months.reduce((s, v) => s + v, 0));
  }, [eduzzData, selectedEduzzYear]);

  // Eduzz totals
  const eduzzTotals = useMemo(() => ({
    valor: eduzzData.reduce((s, r) => s + r.valor, 0),
    valorLiquido: eduzzData.reduce((s, r) => s + r.valorLiquido, 0),
    taxas: eduzzData.reduce((s, r) => s + Math.abs(r.taxas), 0),
    alunos: new Set(eduzzData.map(r => r.aluno).filter(Boolean)).size,
    vendas: eduzzData.length,
  }), [eduzzData]);

  // Eduzz: hierarchical data (curso → ano → mês → items)
  const eduzzHierarchy = useMemo(() => {
    const map: Record<string, Record<number, Record<number, EduzzRecord[]>>> = {};
    eduzzData.forEach(r => {
      if (!map[r.curso]) map[r.curso] = {};
      if (!map[r.curso][r.year]) map[r.curso][r.year] = {};
      if (!map[r.curso][r.year][r.month]) map[r.curso][r.year][r.month] = [];
      map[r.curso][r.year][r.month].push(r);
    });
    return map;
  }, [eduzzData]);

  // Eduzz: pivot vendas por ano (for "Vendas Ano/Mês" tab)
  const eduzzVendasPivot = useMemo(() => {
    const years = [...new Set(eduzzData.map(r => r.year))].filter(Boolean).sort();
    const cursoMap: Record<string, Record<number, { vendas: number; valor: number; bestMonth: string; bestMonthVal: number; _monthMap: Record<string, number> }>> = {};
    const totais: Record<number, { vendas: number; valor: number }> = {};
    years.forEach(y => { totais[y] = { vendas: 0, valor: 0 }; });

    eduzzData.forEach(r => {
      if (!cursoMap[r.curso]) cursoMap[r.curso] = {};
      if (!cursoMap[r.curso][r.year]) cursoMap[r.curso][r.year] = { vendas: 0, valor: 0, bestMonth: '', bestMonthVal: 0, _monthMap: {} };
      const e = cursoMap[r.curso][r.year];
      e.vendas++;
      e.valor += r.valor;
      totais[r.year].vendas++;
      totais[r.year].valor += r.valor;
    });

    eduzzData.forEach(r => {
      const e = cursoMap[r.curso]?.[r.year];
      if (!e) return;
      const key = `${r.month}`;
      e._monthMap[key] = (e._monthMap[key] || 0) + r.valor;
      if (e._monthMap[key] > e.bestMonthVal) {
        e.bestMonthVal = e._monthMap[key];
        e.bestMonth = `${MONTH_NAMES[r.month - 1]}/${r.year}`;
      }
    });

    const cursos = Object.entries(cursoMap)
      .map(([curso, yearData]) => ({ curso, yearData }))
      .sort((a, b) => {
        const totalA = Object.values(a.yearData).reduce((s, v) => s + v.valor, 0);
        const totalB = Object.values(b.yearData).reduce((s, v) => s + v.valor, 0);
        return totalB - totalA;
      });

    // Best seller per year
    const bestPerYear: Record<number, { curso: string; month: string; valor: number }> = {};
    years.forEach(y => {
      let best = { curso: '', month: '', valor: 0 };
      Object.entries(cursoMap).forEach(([curso, yd]) => {
        if (yd[y] && yd[y].valor > best.valor) {
          best = { curso, month: yd[y].bestMonth, valor: yd[y].valor };
        }
      });
      bestPerYear[y] = best;
    });

    return { years, cursos, totais, bestPerYear };
  }, [eduzzData]);

  // Eduzz years available
  const eduzzYears = useMemo(() => [...new Set(eduzzData.map(r => r.year))].filter(Boolean).sort(), [eduzzData]);

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

      {/* Receitas Operacionais por Centro de Custo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Receitas Operacionais — Comparativo Anual
          </CardTitle>
          <CardDescription>Exclui aplicações/rendimentos (apresentados em seção própria)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centro de Custo</TableHead>
                <TableHead className="text-right">Qtd 2024</TableHead>
                <TableHead className="text-right">2024</TableHead>
                <TableHead className="text-right">Qtd 2025</TableHead>
                <TableHead className="text-right">2025</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead className="w-[120px]">Proporção</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const maxVal = Math.max(...receitasPorCusto.map(r => Math.max(r.total2024, r.total2025)), 1);
                return receitasPorCusto.map(r => {
                  const variacao = r.total2024 !== 0 ? ((r.total2025 - r.total2024) / Math.abs(r.total2024)) * 100 : 0;
                  const barWidth2024 = (r.total2024 / maxVal) * 100;
                  const barWidth2025 = (r.total2025 / maxVal) * 100;
                  const isExpanded = expandedReceitaCusto === r.custo;
                  const detalhe = receitasDetalhe[r.custo];
                  return (
                    <Collapsible key={r.custo} open={isExpanded} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setExpandedReceitaCusto(isExpanded ? null : r.custo)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1">
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                {r.custo}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">{r.qtd2024}</TableCell>
                            <TableCell className="text-right text-emerald-600 tabular-nums">{fmt(r.total2024)}</TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">{r.qtd2025}</TableCell>
                            <TableCell className="text-right text-emerald-600 tabular-nums">{fmt(r.total2025)}</TableCell>
                            <TableCell className={`text-right font-bold tabular-nums ${variacao >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                              {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <div className="h-1.5 rounded-full bg-emerald-500/30">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${barWidth2024}%` }} />
                                </div>
                                <div className="h-1.5 rounded-full bg-primary/20">
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth2025}%` }} />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="bg-muted/20 px-4 py-3 border-y overflow-x-auto">
                                {detalhe && [2024, 2025].map((year, yi) => {
                                  const months = detalhe[year] || Array(12).fill(0);
                                  const yearTotal = months.reduce((s: number, v: number) => s + v, 0);
                                  return (
                                    <div key={year} className={yi > 0 ? 'mt-2 pt-2 border-t border-border/50' : ''}>
                                      <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(12, 1fr) 70px', gap: '2px' }} className="text-xs">
                                        {yi === 0 && (
                                          <>
                                            <div />
                                            {MONTH_NAMES.map(m => (
                                              <div key={m} className="text-center text-muted-foreground font-medium py-1">{m}</div>
                                            ))}
                                            <div className="text-center text-muted-foreground font-bold py-1">TOTAL</div>
                                          </>
                                        )}
                                        <div className="font-bold text-primary flex items-center">{year}</div>
                                        {months.map((v: number, i: number) => (
                                          <div key={i} className={`text-center tabular-nums py-1.5 px-1 rounded ${v > 0 ? 'bg-emerald-500/10 text-emerald-600 font-medium' : 'text-muted-foreground'}`}>
                                            {v > 0 ? fmtCompact(v) : '-'}
                                          </div>
                                        ))}
                                        <div className="text-center tabular-nums py-1.5 px-1 rounded bg-emerald-500/20 text-emerald-600 font-bold">
                                          {fmtCompact(yearTotal)}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                });
              })()}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right tabular-nums">{receitasPorCusto.reduce((s, r) => s + r.qtd2024, 0)}</TableCell>
                <TableCell className="text-right text-emerald-600 tabular-nums">{fmt(totalRec2024)}</TableCell>
                <TableCell className="text-right tabular-nums">{receitasPorCusto.reduce((s, r) => s + r.qtd2025, 0)}</TableCell>
                <TableCell className="text-right text-emerald-600 tabular-nums">{fmt(totalRec2025)}</TableCell>
                <TableCell className={`text-right ${varRecTotal >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {varRecTotal >= 0 ? '+' : ''}{varRecTotal.toFixed(1)}%
                </TableCell>
                <TableCell />
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

      {/* Aplicações/Rendimentos e Lucros Divididos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Aplicações/Rendimentos e Lucros Divididos — 2024 vs 2025
          </CardTitle>
          <CardDescription>custoNum 07 e 21 — comparativo anual com detalhamento</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">2024</TableHead>
                <TableHead className="text-right">2025</TableHead>
                <TableHead className="text-right">Variação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aplicacoesLucros.map(g => (
                <Collapsible key={g.label} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" />
                            {g.label}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(g.total2024)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(g.total2025)}</TableCell>
                        <TableCell className={`text-right font-bold ${g.variacao >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                          {g.variacao >= 0 ? '+' : ''}{g.variacao.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <tr>
                        <td colSpan={4} className="p-0">
                          <div className="bg-muted/20 px-4 py-3 border-y">
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">2024 ({g.items2024.length} itens)</p>
                                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                  {g.items2024.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs py-0.5 px-2 rounded hover:bg-muted/30">
                                      <div className="flex gap-2 items-center">
                                        <Minus className="h-2 w-2 text-muted-foreground" />
                                        <span className="text-muted-foreground">{item.date}</span>
                                        <span className="truncate max-w-[200px]">{item.descricao}</span>
                                      </div>
                                      <span className="font-medium tabular-nums">{fmt(item.valorLiquido)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">2025 ({g.items2025.length} itens)</p>
                                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                  {g.items2025.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-xs py-0.5 px-2 rounded hover:bg-muted/30">
                                      <div className="flex gap-2 items-center">
                                        <Minus className="h-2 w-2 text-muted-foreground" />
                                        <span className="text-muted-foreground">{item.date}</span>
                                        <span className="truncate max-w-[200px]">{item.descricao}</span>
                                      </div>
                                      <span className="font-medium tabular-nums">{fmt(item.valorLiquido)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
              {(() => {
                const t2024 = aplicacoesLucros.reduce((s, g) => s + g.total2024, 0);
                const t2025 = aplicacoesLucros.reduce((s, g) => s + g.total2025, 0);
                const vt = t2024 !== 0 ? ((t2025 - t2024) / Math.abs(t2024)) * 100 : 0;
                return (
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(t2024)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(t2025)}</TableCell>
                    <TableCell className={`text-right ${vt >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {vt >= 0 ? '+' : ''}{vt.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cursos Eduzz — Análise de Vendas */}
      {eduzzData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Cursos Eduzz — Análise de Vendas
            </CardTitle>
            <CardDescription>Dados consolidados de vendas na plataforma Eduzz</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Total Vendido</p>
                <p className="text-lg font-bold text-foreground">{fmt(eduzzTotals.valor)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Taxas</p>
                <p className="text-lg font-bold text-destructive">{fmt(eduzzTotals.taxas)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Líquido</p>
                <p className="text-lg font-bold text-emerald-600">{fmt(eduzzTotals.valorLiquido)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Vendas</p>
                <p className="text-lg font-bold text-foreground">{eduzzTotals.vendas}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Alunos</p>
                <p className="text-lg font-bold text-foreground">{eduzzTotals.alunos}</p>
              </div>
            </div>

            {/* Internal Tabs */}
            <Tabs defaultValue="ranking">
              <TabsList className="mb-4">
                <TabsTrigger value="ranking"><Trophy className="h-3 w-3 mr-1" /> Ranking</TabsTrigger>
                <TabsTrigger value="vendas"><BarChart3 className="h-3 w-3 mr-1" /> Vendas Ano/Mês</TabsTrigger>
              </TabsList>

              {/* Tab: Ranking with hierarchical drill-down */}
              <TabsContent value="ranking">
                <div className="flex items-center gap-1 mb-3">
                  <span className="text-sm text-muted-foreground mr-2">Ano:</span>
                  <Button
                    variant={eduzzRankingYear === 'todos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setEduzzRankingYear('todos'); setExpandedEduzzCurso(null); }}
                  >
                    Todos
                  </Button>
                  {eduzzRankingYears.map(yr => (
                    <Button
                      key={yr}
                      variant={eduzzRankingYear === yr ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setEduzzRankingYear(yr); setExpandedEduzzCurso(null); }}
                    >
                      {yr}
                    </Button>
                  ))}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Alunos</TableHead>
                      <TableHead className="text-right">Valor Bruto</TableHead>
                      <TableHead className="text-right">Taxas</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead className="text-right">Melhor Mês</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eduzzRanking.map((c, i) => {
                      const isOpen = expandedEduzzCurso === c.curso;
                      const cursoYears = eduzzHierarchy[c.curso] ? Object.keys(eduzzHierarchy[c.curso]).map(Number).sort() : [];

                      return (
                        <Collapsible key={c.curso} open={isOpen} asChild>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                  setExpandedEduzzCurso(isOpen ? null : c.curso);
                                  setExpandedEduzzCursoYear(null);
                                  setExpandedEduzzCursoMonth(null);
                                }}
                              >
                                <TableCell>
                                  {i === 0 ? <Badge className="bg-amber-500 text-white">🥇</Badge> :
                                   i === 1 ? <Badge variant="secondary">🥈</Badge> :
                                   i === 2 ? <Badge variant="outline">🥉</Badge> :
                                   <span className="text-muted-foreground">{i + 1}</span>}
                                </TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-1">
                                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    {c.curso}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{c.vendas}</TableCell>
                                <TableCell className="text-right tabular-nums">{c.alunosCount}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(c.valor)}</TableCell>
                                <TableCell className="text-right text-destructive tabular-nums">{fmt(c.taxas)}</TableCell>
                                <TableCell className="text-right text-emerald-600 font-semibold tabular-nums">{fmt(c.valorLiquido)}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline">{c.bestMonth}</Badge>
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <tr>
                                <td colSpan={8} className="p-0">
                                  <div className="bg-muted/20 px-4 py-3 border-y space-y-1">
                                    {/* Level 1: Years */}
                                    {cursoYears.map(year => {
                                      const yearKey = `${c.curso}-${year}`;
                                      const isYearOpen = expandedEduzzCursoYear === yearKey;
                                      const yearMonths = eduzzHierarchy[c.curso][year];
                                      const yearItems = Object.values(yearMonths).flat();
                                      const yearVendas = yearItems.length;
                                      const yearValor = yearItems.reduce((s, r) => s + r.valor, 0);
                                      const yearTaxas = yearItems.reduce((s, r) => s + Math.abs(r.taxas), 0);
                                      const yearLiquido = yearItems.reduce((s, r) => s + r.valorLiquido, 0);

                                      return (
                                        <div key={year}>
                                          <div
                                            className="flex items-center justify-between py-2 px-3 rounded cursor-pointer hover:bg-muted/40 transition-colors"
                                            onClick={() => {
                                              setExpandedEduzzCursoYear(isYearOpen ? null : yearKey);
                                              setExpandedEduzzCursoMonth(null);
                                            }}
                                          >
                                            <div className="flex items-center gap-2">
                                              {isYearOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                              <span className="font-bold text-primary">{year}</span>
                                              <span className="text-xs text-muted-foreground">({yearVendas} vendas)</span>
                                            </div>
                                            <div className="flex gap-4 text-sm">
                                              <span className="tabular-nums">{fmt(yearValor)}</span>
                                              <span className="text-destructive tabular-nums">-{fmt(yearTaxas)}</span>
                                              <span className="text-emerald-600 font-semibold tabular-nums">{fmt(yearLiquido)}</span>
                                            </div>
                                          </div>

                                          {/* Level 2: Months */}
                                          {isYearOpen && (
                                            <div className="ml-6 mt-1 space-y-1">
                                              {Object.keys(yearMonths).map(Number).sort((a, b) => a - b).map(month => {
                                                const monthKey = `${c.curso}-${year}-${month}`;
                                                const isMonthOpen = expandedEduzzCursoMonth === monthKey;
                                                const monthItems = yearMonths[month];
                                                const mVendas = monthItems.length;
                                                const mValor = monthItems.reduce((s, r) => s + r.valor, 0);
                                                const mTaxas = monthItems.reduce((s, r) => s + Math.abs(r.taxas), 0);
                                                const mLiquido = monthItems.reduce((s, r) => s + r.valorLiquido, 0);

                                                return (
                                                  <div key={month}>
                                                    <div
                                                      className="flex items-center justify-between py-1.5 px-3 rounded cursor-pointer hover:bg-muted/30 transition-colors"
                                                      onClick={() => setExpandedEduzzCursoMonth(isMonthOpen ? null : monthKey)}
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        {isMonthOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                                        <span className="font-medium text-sm">{MONTH_NAMES[month - 1]}</span>
                                                        <Badge variant="outline" className="text-xs">{mVendas} {mVendas === 1 ? 'venda' : 'vendas'}</Badge>
                                                      </div>
                                                      <div className="flex gap-4 text-xs">
                                                        <span className="tabular-nums">{fmt(mValor)}</span>
                                                        <span className="text-destructive tabular-nums">-{fmt(mTaxas)}</span>
                                                        <span className="text-emerald-600 font-medium tabular-nums">{fmt(mLiquido)}</span>
                                                      </div>
                                                    </div>

                                                    {/* Level 3: Individual sales */}
                                                    {isMonthOpen && (
                                                      <div className="ml-6 mt-1 mb-2 space-y-0.5 max-h-48 overflow-y-auto">
                                                        {monthItems
                                                          .sort((a, b) => a.date.localeCompare(b.date))
                                                          .map((item, idx) => (
                                                            <div key={idx} className="flex justify-between text-xs py-0.5 px-2 rounded hover:bg-muted/30">
                                                              <div className="flex gap-3 items-center">
                                                                <Minus className="h-2 w-2 text-muted-foreground" />
                                                                <span className="text-muted-foreground w-20">{item.date}</span>
                                                                <span className="font-medium">{item.aluno}</span>
                                                              </div>
                                                              <div className="flex gap-4 items-center">
                                                                <span className="tabular-nums">{fmt(item.valor)}</span>
                                                                <span className="text-destructive tabular-nums">-{fmt(Math.abs(item.taxas))}</span>
                                                                <span className="text-emerald-600 font-medium tabular-nums">{fmt(item.valorLiquido)}</span>
                                                              </div>
                                                            </div>
                                                          ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
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
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Tab: Vendas Ano/Mês */}
              <TabsContent value="vendas">
                <ScrollArea className="w-full">
                  <div className="min-w-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Curso</TableHead>
                          {eduzzVendasPivot.years.map(yr => (
                            <>
                              <TableHead key={`${yr}-v`} className="text-center">Vendas {yr}</TableHead>
                              <TableHead key={`${yr}-b`} className="text-right">Bruto {yr}</TableHead>
                            </>
                          ))}
                          <TableHead className="text-center font-bold">Total Vendas</TableHead>
                          <TableHead className="text-right font-bold">Total Bruto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eduzzVendasPivot.cursos.map(({ curso, yearData }) => {
                          const totalVendas = Object.values(yearData).reduce((s, v) => s + v.vendas, 0);
                          const totalValor = Object.values(yearData).reduce((s, v) => s + v.valor, 0);
                          return (
                            <TableRow key={curso}>
                              <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">{curso}</TableCell>
                              {eduzzVendasPivot.years.map(yr => (
                                <>
                                  <TableCell key={`${yr}-v`} className="text-center tabular-nums">
                                    {yearData[yr]?.vendas || <span className="text-muted-foreground">-</span>}
                                  </TableCell>
                                  <TableCell key={`${yr}-b`} className="text-right tabular-nums">
                                    {yearData[yr] ? fmt(yearData[yr].valor) : <span className="text-muted-foreground">-</span>}
                                  </TableCell>
                                </>
                              ))}
                              <TableCell className="text-center font-bold tabular-nums">{totalVendas}</TableCell>
                              <TableCell className="text-right font-bold tabular-nums">{fmt(totalValor)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-muted/50 font-bold border-t-2">
                          <TableCell className="sticky left-0 bg-muted/50 z-10">TOTAL</TableCell>
                          {eduzzVendasPivot.years.map(yr => (
                            <>
                              <TableCell key={`${yr}-v`} className="text-center tabular-nums">{eduzzVendasPivot.totais[yr]?.vendas || 0}</TableCell>
                              <TableCell key={`${yr}-b`} className="text-right tabular-nums">{fmt(eduzzVendasPivot.totais[yr]?.valor || 0)}</TableCell>
                            </>
                          ))}
                          <TableCell className="text-center tabular-nums">
                            {Object.values(eduzzVendasPivot.totais).reduce((s, v) => s + v.vendas, 0)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(Object.values(eduzzVendasPivot.totais).reduce((s, v) => s + v.valor, 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>

                {/* Best sellers per year */}
                <div className="mt-4 space-y-2">
                  {eduzzVendasPivot.years.map(yr => {
                    const best = eduzzVendasPivot.bestPerYear[yr];
                    if (!best?.curso) return null;
                    return (
                      <div key={yr} className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold">Mais vendido {yr}:</span>
                        <span>{best.curso}</span>
                        <span className="text-muted-foreground">({best.month} — {fmt(best.valor)})</span>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

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
                          <td colSpan={8} className="p-0">
                            <div className="bg-muted/30 px-6 py-4 space-y-2 border-y">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                Centros de Custo — {y.year}
                              </p>
                              {y.centroCustoBreakdown.filter(cc => cc.custoNum !== 7 && cc.custoNum !== 21).map(cc => {
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
                const totAplic = yearSummaries.reduce((s, y) => s + y.aplicacao, 0);
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
                    <TableCell className="text-right text-primary">{fmt(totAplic)}</TableCell>
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
