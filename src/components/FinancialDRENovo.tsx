import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowRightLeft,
  Minus,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DRENovoCursoModal, { DRENovoVenda } from './DRENovoCursoModal';

// Interfaces
interface DRENovoReceita {
  descricao: string;
  valorBruto: number;
  taxa: number;
  valorLiquido: number;
  vendas: DRENovoVenda[];
}

// Transitar foi movido para CursosParceiros.tsx

interface DRENovoSaida {
  codigo: string;
  descricao: string;
  valor: number;
}

interface DRENovoDados {
  mes: string;
  ano: string;
  entradas: DRENovoReceita[];
  saidas: { [codigo: string]: DRENovoSaida[] };
  totais: {
    brutoEntradas: number;
    taxasEntradas: number;
    liquidoEntradas: number;
    totalReceitaLiquida: number;
    totalSaidas: number;
    resultado: number;
  };
}

interface RawDRERecord {
  id: string;
  type: string;
  description: string;
  details: string;
  amount: number;
  month: string;
  year: string;
  date: string;
  extraDetail1: string;
  extraDetail2: string;
  extraDetail3: string;
  originalAmount: number;
  sourceType: string;
}

const monthNames: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
};

const FinancialDRENovo: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [rawData, setRawData] = useState<RawDRERecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    entradas: true,
    saidas: true,
  });
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCurso, setModalCurso] = useState('');
  const [modalVendas, setModalVendas] = useState<DRENovoVenda[]>([]);
  
  const { toast } = useToast();

  // Load data from Google Sheets
  const loadData = async () => {
    setIsLoading(true);
    try {
      const sheetData = await GoogleSheetsService.fetchDREData();
      console.log('DRE Novo - Raw data loaded:', sheetData.length, 'records');
      setRawData(sheetData);
      toast({
        title: "Dados carregados!",
        description: `${sheetData.length} registros carregados da Página2`,
      });
    } catch (error) {
      console.error('Error loading DRE Novo data:', error);
      setRawData([]);
      toast({
        title: "Erro ao carregar dados",
        description: "Falha ao conectar com a Página2 da planilha.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load on mount
  useEffect(() => {
    if (rawData.length === 0) {
      loadData();
    }
  }, []);

  // Available months and years
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    rawData.forEach(record => {
      if (record.month) {
        months.add(record.month.padStart(2, '0'));
      }
    });
    return Array.from(months).sort();
  }, [rawData]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    rawData.forEach(record => {
      if (record.year) {
        years.add(record.year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [rawData]);

  // Process data into DRE structure
  const processedData = useMemo((): DRENovoDados => {
    let filteredData = rawData;

    // Apply filters
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredData = rawData.filter(record => {
        const monthMatches = selectedMonth === 'all' || record.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || record.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }

    console.log('Filtered data:', filteredData.length, 'records');

    // Helper to normalize text
    const normalize = (s?: string) => (s || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Check sourceType (column A)
    const getSourceType = (record: RawDRERecord) => normalize(record.sourceType || '');

    // Separate records by type based on column A codes
    const entradasRecords = filteredData.filter(r => {
      const st = getSourceType(r);
      return st.startsWith('01') && !st.includes('TRANSITAR') && !st.includes('01.02');
    });

    const transitarRecords = filteredData.filter(r => {
      const st = getSourceType(r);
      return st.includes('TRANSITAR') || st.includes('01-TRANSITAR');
    });

    const taxaRecords = filteredData.filter(r => {
      const st = getSourceType(r);
      return st.includes('01.02') || st.includes('TAXA');
    });

    const saidasRecords = filteredData.filter(r => {
      const st = getSourceType(r);
      return st.startsWith('02') || st.includes('SAIDA');
    });

    console.log('Entradas:', entradasRecords.length);
    console.log('Transitar:', transitarRecords.length);
    console.log('Taxas:', taxaRecords.length);
    console.log('Saídas:', saidasRecords.length);

    // Group entradas by description (curso)
    const entradasMap = new Map<string, DRENovoReceita>();
    entradasRecords.forEach(record => {
      const key = record.description || 'Sem descrição';
      const existing = entradasMap.get(key);
      
      if (existing) {
        existing.valorBruto += record.amount;
        existing.vendas.push({
          data: record.date,
          aluno: record.details || record.extraDetail1 || '',
          formaPagamento: record.extraDetail2 || '',
          valor: record.amount,
        });
      } else {
        entradasMap.set(key, {
          descricao: key,
          valorBruto: record.amount,
          taxa: 0,
          valorLiquido: 0,
          vendas: [{
            data: record.date,
            aluno: record.details || record.extraDetail1 || '',
            formaPagamento: record.extraDetail2 || '',
            valor: record.amount,
          }],
        });
      }
    });

    // Calculate taxes for entradas (based on 01.02 records)
    // For now, we'll estimate taxes as a percentage - can be refined later
    const totalBrutoEntradas = Array.from(entradasMap.values()).reduce((s, e) => s + e.valorBruto, 0);
    const totalTaxas = taxaRecords.reduce((s, r) => s + Math.abs(r.amount), 0);
    const taxaPercentual = totalBrutoEntradas > 0 ? totalTaxas / totalBrutoEntradas : 0;

    // Apply proportional taxes to each entrada
    entradasMap.forEach((entrada) => {
      entrada.taxa = entrada.valorBruto * taxaPercentual;
      entrada.valorLiquido = entrada.valorBruto - entrada.taxa;
    });

    const entradas = Array.from(entradasMap.values());

    // Group saídas by código (2.1, 2.2, etc.)
    const saidasByCode: { [codigo: string]: DRENovoSaida[] } = {};
    saidasRecords.forEach(record => {
      // Extract code from sourceType or description
      const st = getSourceType(record);
      let codigo = '02';
      
      // Try to extract sub-code like 2.1, 2.2
      const codeMatch = st.match(/02\.(\d+)/);
      if (codeMatch) {
        codigo = `02.${codeMatch[1]}`;
      } else if (st.includes('PESSOAL') || record.description?.toUpperCase().includes('PESSOAL')) {
        codigo = '02.1';
      } else if (st.includes('OPERACIONAL') || record.description?.toUpperCase().includes('OPERACIONAL')) {
        codigo = '02.2';
      } else if (st.includes('MARKETING') || record.description?.toUpperCase().includes('MARKETING')) {
        codigo = '02.3';
      }

      if (!saidasByCode[codigo]) {
        saidasByCode[codigo] = [];
      }
      
      saidasByCode[codigo].push({
        codigo,
        descricao: record.description || 'Sem descrição',
        valor: Math.abs(record.amount),
      });
    });

    // Calculate totals (sem transitar - agora está na aba Cursos Parceiros)
    const totais = {
      brutoEntradas: entradas.reduce((s, e) => s + e.valorBruto, 0),
      taxasEntradas: entradas.reduce((s, e) => s + e.taxa, 0),
      liquidoEntradas: entradas.reduce((s, e) => s + e.valorLiquido, 0),
      totalReceitaLiquida: 0,
      totalSaidas: 0,
      resultado: 0,
    };

    totais.totalReceitaLiquida = totais.liquidoEntradas;
    totais.totalSaidas = Object.values(saidasByCode).flat().reduce((s, item) => s + item.valor, 0);
    totais.resultado = totais.totalReceitaLiquida - totais.totalSaidas;

    return {
      mes: selectedMonth,
      ano: selectedYear,
      entradas,
      saidas: saidasByCode,
      totais,
    };
  }, [rawData, selectedMonth, selectedYear]);

  const handleSearch = () => {
    setHasSearched(true);
    if (rawData.length === 0) {
      loadData();
    }
  };

  const handleClearFilters = () => {
    setSelectedMonth('all');
    setSelectedYear('all');
    setHasSearched(false);
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const openModal = (cursoNome: string, vendas: DRENovoVenda[]) => {
    setModalCurso(cursoNome);
    setModalVendas(vendas);
    setModalOpen(true);
  };

  const getResultColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const getResultIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4" />;
    if (value < 0) return <TrendingDown className="h-4 w-4" />;
    return <DollarSign className="h-4 w-4" />;
  };

  const codigoNames: Record<string, string> = {
    '02': 'Saídas Gerais',
    '02.1': 'Pessoal',
    '02.2': 'Operacional',
    '02.3': 'Marketing',
    '02.4': 'Administrativo',
    '02.5': 'Outros',
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros DRE Novo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>
                      {monthNames[month] || `Mês ${month}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSearch} className="flex items-center gap-2" disabled={isLoading}>
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isLoading ? 'Carregando...' : 'Consultar'}
              </Button>
              
              {(selectedMonth !== 'all' || selectedYear !== 'all') && (
                <Button variant="outline" onClick={handleClearFilters}>
                  Limpar Filtros
                </Button>
              )}

              {rawData.length > 0 && (
                <Button variant="outline" onClick={loadData} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              )}
            </div>
          </div>

          {(selectedMonth !== 'all' || selectedYear !== 'all') && (
            <div className="mt-4 flex gap-2">
              {selectedMonth !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {monthNames[selectedMonth] || `Mês ${selectedMonth}`}
                </Badge>
              )}
              {selectedYear !== 'all' && (
                <Badge variant="secondary">
                  {selectedYear}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {hasSearched && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Receita Líquida Total</p>
                  <p className="text-2xl font-bold text-green-800">
                    {formatCurrency(processedData.totais.totalReceitaLiquida)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Entradas + Comissão FS
                  </p>
                </div>
                <div className="p-3 bg-green-200 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Entradas Líquidas</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {formatCurrency(processedData.totais.liquidoEntradas)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Cursos FS
                  </p>
                </div>
                <div className="p-3 bg-blue-200 rounded-full">
                  <DollarSign className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 ${processedData.totais.resultado >= 0 ? 'border-green-300 bg-gradient-to-br from-green-50 to-green-100' : 'border-red-300 bg-gradient-to-br from-red-50 to-red-100'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Resultado</p>
                  <p className={`text-2xl font-bold ${getResultColor(processedData.totais.resultado)}`}>
                    {formatCurrency(processedData.totais.resultado)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {processedData.totais.resultado >= 0 ? 'Lucro' : 'Prejuízo'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${processedData.totais.resultado >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
                  {getResultIcon(processedData.totais.resultado)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 01-ENTRADAS Table */}
      {hasSearched && (
        <Card>
          <Collapsible open={openSections.entradas} onOpenChange={() => toggleSection('entradas')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-5 w-5" />
                    01-ENTRADAS (Cursos FS)
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-green-600 font-bold">
                      {formatCurrency(processedData.totais.liquidoEntradas)}
                    </span>
                    {openSections.entradas ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Curso</TableHead>
                        <TableHead className="text-right">Valor Bruto</TableHead>
                        <TableHead className="text-right">Taxas</TableHead>
                        <TableHead className="text-right">Valor Líquido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedData.entradas.map((entrada, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <button
                              onClick={() => openModal(entrada.descricao, entrada.vendas)}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {entrada.descricao}
                            </button>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(entrada.valorBruto)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            -{formatCurrency(entrada.taxa)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-green-600">
                            {formatCurrency(entrada.valorLiquido)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {processedData.entradas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhuma entrada encontrada para o período selecionado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  {/* Subtotal */}
                  {processedData.entradas.length > 0 && (
                    <div className="flex items-center justify-between p-4 bg-green-50 border-t font-semibold">
                      <span>SUBTOTAL ENTRADAS</span>
                      <div className="flex gap-8">
                        <span className="text-right w-32">
                          {formatCurrency(processedData.totais.brutoEntradas)}
                        </span>
                        <span className="text-right w-32 text-red-600">
                          -{formatCurrency(processedData.totais.taxasEntradas)}
                        </span>
                        <span className="text-right w-32 text-green-600">
                          {formatCurrency(processedData.totais.liquidoEntradas)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Transitar foi movido para a aba Cursos Parceiros */}

      {/* 02-SAÍDAS Table */}
      {hasSearched && (
        <Card>
          <Collapsible open={openSections.saidas} onOpenChange={() => toggleSection('saidas')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-600">
                    <TrendingDown className="h-5 w-5" />
                    02-SAÍDAS
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-red-600 font-bold">
                      -{formatCurrency(processedData.totais.totalSaidas)}
                    </span>
                    {openSections.saidas ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {Object.entries(processedData.saidas)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([codigo, items]) => {
                    const subtotal = items.reduce((s, i) => s + i.valor, 0);
                    return (
                      <div key={codigo} className="border rounded-lg overflow-hidden">
                        <div className="bg-red-50 p-3 flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-600" />
                            {codigo} - {codigoNames[codigo] || 'Despesas'}
                          </span>
                          <span className="text-red-600">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                        <div className="divide-y">
                          {items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 hover:bg-muted/30">
                              <span className="text-muted-foreground pl-6 flex items-center gap-2">
                                <Minus className="h-3 w-3" />
                                {item.descricao}
                              </span>
                              <span className="font-mono">
                                {formatCurrency(item.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                {Object.keys(processedData.saidas).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma saída encontrada para o período selecionado.
                  </div>
                )}

                {/* Total Saídas */}
                {Object.keys(processedData.saidas).length > 0 && (
                  <div className="flex items-center justify-between p-4 bg-red-100 rounded-lg font-bold text-lg">
                    <span>TOTAL SAÍDAS</span>
                    <span className="text-red-600">
                      -{formatCurrency(processedData.totais.totalSaidas)}
                    </span>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Resultado Final */}
      {hasSearched && (
        <Card className={`border-2 ${processedData.totais.resultado >= 0 ? 'border-green-400' : 'border-red-400'}`}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-lg">
                <span className="text-muted-foreground">Total Receita Líquida</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(processedData.totais.totalReceitaLiquida)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground pl-4">
                <span>Entradas Líquidas (Cursos FS)</span>
                <span>{formatCurrency(processedData.totais.liquidoEntradas)}</span>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-muted-foreground">Total Saídas</span>
                  <span className="font-semibold text-red-600">
                    -{formatCurrency(processedData.totais.totalSaidas)}
                  </span>
                </div>
              </div>

              <div className={`border-t-4 pt-4 ${processedData.totais.resultado >= 0 ? 'border-green-400' : 'border-red-400'}`}>
                <div className="flex items-center justify-between text-xl">
                  <span className="font-bold flex items-center gap-2">
                    {getResultIcon(processedData.totais.resultado)}
                    RESULTADO
                  </span>
                  <span className={`font-bold text-2xl ${getResultColor(processedData.totais.resultado)}`}>
                    {formatCurrency(processedData.totais.resultado)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground text-right mt-1">
                  {processedData.totais.resultado >= 0 ? 'Lucro Líquido' : 'Prejuízo'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Initial state - before search */}
      {!hasSearched && (
        <Card>
          <CardContent className="p-12 text-center">
            <DollarSign className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">DRE - Nova Estrutura</h3>
            <p className="text-muted-foreground mb-4">
              Selecione o período e clique em "Consultar" para visualizar a DRE com a nova estrutura por códigos.
            </p>
            <ul className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-2">
              <li className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span><strong>01-ENTRADAS:</strong> Cursos FS (Bruto → Taxa → Líquido)</span>
              </li>
              <li className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span><strong>02-SAÍDAS:</strong> Despesas por categoria</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-4 italic">
              * Cursos parceiros (Transitar) estão na aba "Cursos Parceiros"
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <DRENovoCursoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        cursoNome={modalCurso}
        vendas={modalVendas}
      />
    </div>
  );
};

export default FinancialDRENovo;
