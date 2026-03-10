import { useState, useMemo } from 'react';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface Props {
  data: Pagina5Record[];
  allData: Pagina5Record[];
  selectedMonth: string;
  selectedYear: string;
}

interface ProdutoRanking {
  nome: string;
  qtdVendas: number;
  valorBruto: number;
  taxas: number;
  impostos: number;
  comissoes: number;
  valorLiquido: number;
  margem: number;
}

type SortKey = keyof Omit<ProdutoRanking, 'nome'>;

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(142 76% 36%)',
  'hsl(38 92% 50%)', 'hsl(280 65% 60%)', 'hsl(200 80% 50%)',
  'hsl(350 80% 55%)', 'hsl(160 60% 45%)', 'hsl(30 80% 55%)', 'hsl(220 70% 55%)',
];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return fmt(v);
};

function calcRanking(records: Pagina5Record[]): ProdutoRanking[] {
  const receitas = records.filter(r => r.custoNum >= 1 && r.custoNum <= 10);
  const grouped = new Map<string, Pagina5Record[]>();
  for (const r of receitas) {
    const key = r.descricao.trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  const result: ProdutoRanking[] = [];
  for (const [nome, items] of grouped) {
    const valorBruto = items.reduce((s, r) => s + r.valorBruto, 0);
    const taxas = items.reduce((s, r) => s + r.taxas, 0);
    const impostos = items.reduce((s, r) => s + r.vrImposto, 0);
    const comissoes = items.reduce((s, r) => s + r.vrVendedor + r.vrMkt, 0);
    const valorLiquido = items.reduce((s, r) => s + r.valorLiquido, 0) - impostos - comissoes;
    const margem = valorBruto !== 0 ? (valorLiquido / valorBruto) * 100 : 0;
    result.push({ nome, qtdVendas: items.length, valorBruto, taxas, impostos, comissoes, valorLiquido, margem });
  }
  return result.sort((a, b) => b.valorBruto - a.valorBruto);
}

interface PeriodKey { label: string; records: Pagina5Record[] }

const RankingProdutos = ({ data, allData, selectedMonth, selectedYear }: Props) => {
  const [selectedMonths, setSelectedMonths] = useState<number[]>([parseInt(selectedMonth)]);
  const [selectedYears, setSelectedYears] = useState<number[]>([parseInt(selectedYear)]);
  const [acumulado, setAcumulado] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('valorBruto');
  const [sortAsc, setSortAsc] = useState(false);

  const availableYears = useMemo(() => {
    const years = [...new Set(allData.filter(r => r.year > 0).map(r => r.year))].sort();
    return years.length > 0 ? years : [parseInt(selectedYear)];
  }, [allData, selectedYear]);

  const toggleMonth = (m: number) => {
    if (acumulado) { setAcumulado(false); setSelectedMonths([m]); return; }
    setSelectedMonths(prev => prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m].sort((a, b) => a - b));
  };
  const toggleYear = (y: number) => {
    setSelectedYears(prev => prev.includes(y) ? (prev.length > 1 ? prev.filter(x => x !== y) : prev) : [...prev, y].sort((a, b) => a - b));
  };
  const toggleAcumulado = () => {
    setAcumulado(!acumulado);
    if (!acumulado) setSelectedMonths([]);
  };

  const isMultiPeriod = selectedYears.length > 1 || (!acumulado && selectedMonths.length > 1);

  // Build period groups for comparison
  const periods = useMemo<PeriodKey[]>(() => {
    if (acumulado) {
      return selectedYears.map(y => ({
        label: `Acumulado ${y}`,
        records: allData.filter(r => r.year === y),
      }));
    }
    const result: PeriodKey[] = [];
    for (const y of selectedYears) {
      for (const m of selectedMonths) {
        result.push({
          label: `${MONTHS[m - 1].substring(0, 3)}/${y}`,
          records: allData.filter(r => r.year === y && r.month === m),
        });
      }
    }
    return result;
  }, [allData, selectedYears, selectedMonths, acumulado]);

  // Combined ranking (all selected data merged)
  const allFilteredRecords = useMemo(() => periods.flatMap(p => p.records), [periods]);
  const ranking = useMemo(() => calcRanking(allFilteredRecords), [allFilteredRecords]);

  // Per-period rankings for comparison
  const periodRankings = useMemo(() => {
    if (!isMultiPeriod) return [];
    return periods.map(p => ({ label: p.label, ranking: calcRanking(p.records) }));
  }, [periods, isMultiPeriod]);

  const sorted = useMemo(() => {
    return [...ranking].sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      return sortAsc ? va - vb : vb - va;
    });
  }, [ranking, sortKey, sortAsc]);

  const top3 = ranking.slice(0, 3);
  const top10Chart = ranking.slice(0, 10);
  const totalBruto = ranking.reduce((s, r) => s + r.valorBruto, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-700'];

  const periodoLabel = acumulado
    ? `Acumulado ${selectedYears.join(', ')}`
    : `${selectedMonths.map(m => MONTHS[m - 1].substring(0, 3)).join(', ')}/${selectedYears.join(', ')}`;

  const pieData = top10Chart.map(r => ({
    name: r.nome.length > 20 ? r.nome.substring(0, 20) + '...' : r.nome,
    value: r.valorBruto,
  }));

  const barData = [...top10Chart].reverse().map(r => ({
    name: r.nome.length > 25 ? r.nome.substring(0, 25) + '...' : r.nome,
    bruto: r.valorBruto,
    liquido: r.valorLiquido,
  }));

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === field ? 'text-primary' : 'text-muted-foreground/50'}`} />
      </div>
    </TableHead>
  );

  // Comparison data: products as rows, periods as column groups
  const comparisonData = useMemo(() => {
    if (!isMultiPeriod || periodRankings.length === 0) return [];
    const allProducts = new Set<string>();
    periodRankings.forEach(pr => pr.ranking.forEach(r => allProducts.add(r.nome)));
    return [...allProducts].map(nome => {
      const byPeriod = periodRankings.map(pr => {
        const found = pr.ranking.find(r => r.nome === nome);
        return found || null;
      });
      const totalBruto = byPeriod.reduce((s, r) => s + (r?.valorBruto ?? 0), 0);
      return { nome, byPeriod, totalBruto };
    }).sort((a, b) => b.totalBruto - a.totalBruto);
  }, [isMultiPeriod, periodRankings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Ranking de Produtos
          </h3>
          <p className="text-sm text-muted-foreground">{periodoLabel} • {ranking.length} produtos</p>
        </div>

        {/* Year buttons - multi-select */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Ano:</span>
          {availableYears.map(y => (
            <Button
              key={y}
              size="sm"
              variant={selectedYears.includes(y) ? 'default' : 'outline'}
              className="h-7 px-3 text-xs"
              onClick={() => toggleYear(y)}
            >
              {y}
            </Button>
          ))}
        </div>

        {/* Month buttons - multi-select */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground mr-1">Período:</span>
          <Button
            size="sm"
            variant={acumulado ? 'default' : 'outline'}
            className="h-7 px-3 text-xs"
            onClick={toggleAcumulado}
          >
            Acumulado
          </Button>
          {MONTHS.map((m, i) => (
            <Button
              key={i}
              size="sm"
              variant={!acumulado && selectedMonths.includes(i + 1) ? 'default' : 'outline'}
              className="h-7 px-2.5 text-xs"
              onClick={() => toggleMonth(i + 1)}
              disabled={acumulado}
            >
              {m.substring(0, 3)}
            </Button>
          ))}
        </div>

        {isMultiPeriod && (
          <Badge variant="secondary" className="text-xs">
            Visão comparativa: {periods.map(p => p.label).join(' vs ')}
          </Badge>
        )}
      </div>

      {/* Top 3 Cards */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((p, i) => (
            <Card key={p.nome} className={`${i === 0 ? 'border-primary/50 shadow-md' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Medal className={`h-5 w-5 ${medalColors[i]}`} />
                    <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                  </div>
                  <Badge variant={p.margem >= 50 ? 'default' : 'secondary'} className="text-xs">
                    {p.margem.toFixed(1)}%
                  </Badge>
                </div>
                <p className="font-semibold text-sm truncate mb-3" title={p.nome}>{p.nome}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Vendas</p>
                    <p className="font-bold">{p.qtdVendas}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Bruto</p>
                    <p className="font-bold">{fmtK(p.valorBruto)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Líquido</p>
                    <p className="font-bold" style={{ color: p.valorLiquido >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
                      {fmtK(p.valorLiquido)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Margem</p>
                    <div className="flex items-center gap-1">
                      {p.margem >= 50 ? <TrendingUp className="h-3 w-3 text-primary" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
                      <p className="font-bold">{p.margem.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Comparison Table - shown when multiple periods selected */}
      {isMultiPeriod && comparisonData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Comparativo por Período</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Produto</TableHead>
                  {periodRankings.map(pr => (
                    <TableHead key={pr.label} colSpan={3} className="text-center border-l">
                      {pr.label}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead />
                  <TableHead />
                  {periodRankings.map(pr => (
                    <>
                      <TableHead key={`${pr.label}-v`} className="text-xs border-l">Vendas</TableHead>
                      <TableHead key={`${pr.label}-b`} className="text-xs">Bruto</TableHead>
                      <TableHead key={`${pr.label}-m`} className="text-xs">Margem</TableHead>
                    </>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonData.slice(0, 20).map((row, i) => (
                  <TableRow key={row.nome}>
                    <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate" title={row.nome}>{row.nome}</TableCell>
                    {row.byPeriod.map((p, pi) => (
                      <>
                        <TableCell key={`${pi}-v`} className="border-l">{p?.qtdVendas ?? '-'}</TableCell>
                        <TableCell key={`${pi}-b`}>{p ? fmtK(p.valorBruto) : '-'}</TableCell>
                        <TableCell key={`${pi}-m`}>
                          {p ? (
                            <Badge variant={p.margem >= 50 ? 'default' : p.margem >= 30 ? 'secondary' : 'destructive'} className="text-xs">
                              {p.margem.toFixed(0)}%
                            </Badge>
                          ) : '-'}
                        </TableCell>
                      </>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {top10Chart.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 10 - Faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => fmtK(v)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="bruto" fill="hsl(var(--primary))" name="Bruto" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="liquido" fill="hsl(var(--accent))" name="Líquido" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Participação no Faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full ranking table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ranking Completo</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Produto</TableHead>
                <SortHeader label="Vendas" field="qtdVendas" />
                <SortHeader label="Bruto" field="valorBruto" />
                <SortHeader label="Taxas" field="taxas" />
                <SortHeader label="Impostos" field="impostos" />
                <SortHeader label="Comissões" field="comissoes" />
                <SortHeader label="Líquido" field="valorLiquido" />
                <SortHeader label="Margem" field="margem" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p, i) => (
                <TableRow key={p.nome}>
                  <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate" title={p.nome}>{p.nome}</TableCell>
                  <TableCell>{p.qtdVendas}</TableCell>
                  <TableCell>{fmt(p.valorBruto)}</TableCell>
                  <TableCell>{fmt(p.taxas)}</TableCell>
                  <TableCell>{fmt(p.impostos)}</TableCell>
                  <TableCell>{fmt(p.comissoes)}</TableCell>
                  <TableCell style={{ color: p.valorLiquido >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
                    {fmt(p.valorLiquido)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.margem >= 50 ? 'default' : p.margem >= 30 ? 'secondary' : 'destructive'} className="text-xs">
                      {p.margem.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {sorted.length > 0 && (
            <div className="flex justify-end mt-3 pt-3 border-t text-sm">
              <span className="text-muted-foreground mr-2">Total Bruto:</span>
              <span className="font-bold">{fmt(totalBruto)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RankingProdutos;
