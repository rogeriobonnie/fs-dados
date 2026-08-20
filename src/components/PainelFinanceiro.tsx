import { useState, useEffect, useMemo } from 'react';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { Pagina5Record } from '@/types/pagina5';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, BarChart3, Users, BookOpen, Trophy, CalendarDays, CalendarRange } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DREFluxoCaixa from './DREFluxoCaixa';
import ComissoesPainel from './ComissoesPainel';
import CursosTerceiros from './CursosTerceirosPainel';
import RankingProdutos from './RankingProdutos';
import EventosPainel from './EventosPainel';
import SemestralPainel from './SemestralPainel';

const MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const PainelFinanceiro = () => {
  const [data, setData] = useState<Pagina5Record[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('1');
  const [selectedYear, setSelectedYear] = useState('2025');
  const { toast } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const records = await GoogleSheetsService.fetchPagina5Data();
      setData(records);
      toast({ title: 'Dados carregados!', description: `${records.length} registros da Página5` });
    } catch (error) {
      console.error('Error loading Página5 data:', error);
      toast({ title: 'Erro ao carregar', description: 'Falha ao buscar dados da Página5', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Get available years from data
  const availableYears = useMemo(() => {
    const years = [...new Set(data.filter(r => r.year > 0).map(r => r.year))].sort();
    return years.length > 0 ? years : [2025];
  }, [data]);

  // Filter data by selected month/year
  const filteredData = useMemo(() => {
    const m = parseInt(selectedMonth);
    const y = parseInt(selectedYear);
    return data.filter(r => r.month === m && r.year === y);
  }, [data, selectedMonth, selectedYear]);

  // Summary cards
  const summary = useMemo(() => {
    const receitas = filteredData.filter(r => r.custoNum >= 1 && r.custoNum <= 10);
    const despesas = filteredData.filter(r => r.custoNum >= 11 && r.custoNum <= 20);
    const saldoInicial = filteredData.filter(r => r.custoNum === 0);
    
    const totalImpostos = receitas.reduce((s, r) => s + r.vrImposto, 0);
    const totalComVend = receitas.reduce((s, r) => s + (r.vendedor ? r.vrVendedor : 0), 0);
    const totalReceitas = receitas.reduce((s, r) => s + r.valorLiquido, 0) - totalImpostos - totalComVend;
    const totalDespesas = despesas.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
    const totalSaldoInicial = saldoInicial.reduce((s, r) => s + r.valorBruto, 0);
    const resultado = totalReceitas - totalDespesas;

    return { totalReceitas, totalDespesas, totalSaldoInicial, resultado };
  }, [filteredData]);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Mês:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Ano:</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={loadData} disabled={isLoading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </Button>
        <span className="text-xs text-muted-foreground">{filteredData.length} registros</span>
      </div>

      {/* Sub-tabs */}
      <Tabs defaultValue="dre-fluxo" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="semestral" className="flex items-center gap-1">
            <CalendarRange className="h-4 w-4" />
            Semestral
          </TabsTrigger>
          <TabsTrigger value="dre-fluxo" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            DRE + Fluxo
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            Comissões
          </TabsTrigger>
          <TabsTrigger value="cursos-terceiros" className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            Cursos Terceiros
          </TabsTrigger>
          <TabsTrigger value="eventos" className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="ranking" className="flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            Ranking
          </TabsTrigger>
        </TabsList>
        <TabsContent value="semestral">
          <SemestralPainel allData={data} />
        </TabsContent>
        <TabsContent value="dre-fluxo">
          <DREFluxoCaixa data={filteredData} allData={data} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </TabsContent>
        <TabsContent value="comissoes">
          <ComissoesPainel data={filteredData} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </TabsContent>
        <TabsContent value="cursos-terceiros">
          <CursosTerceiros data={filteredData} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </TabsContent>
        <TabsContent value="eventos">
          <EventosPainel data={filteredData} allData={data} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </TabsContent>
        <TabsContent value="ranking">
          <RankingProdutos data={filteredData} allData={data} selectedMonth={selectedMonth} selectedYear={selectedYear} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PainelFinanceiro;
