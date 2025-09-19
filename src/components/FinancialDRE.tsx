import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FinancialRecord } from '@/types/financial';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { TrendingUp, TrendingDown, DollarSign, Search, Filter, RefreshCw, ChevronDown, ChevronUp, Calendar, Info, BarChart3, PieChart, Users, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface FinancialDREProps {
  data: FinancialRecord[];
}

interface DRERecord {
  id: string;
  type: 'RECEITA' | 'DESPESA';
  description: string;
  details: string;
  amount: number;
  month: string;
  year: string;
  date: string;
  extraDetail1: string;
  extraDetail2: string;
  originalAmount: number;
  sourceType?: string; // valor original da coluna A (ex.: 02-SAÍDAS)
}

interface DREData {
  receipts: {
    total: number;
    items: { [key: string]: DRERecord[] };
  };
  expenses: {
    total: number;
    items: { [key: string]: DRERecord[] };
  };
  distributions: {
    total: number;
    items: { [key: string]: DRERecord[] };
  };
  investments: {
    total: number;
    items: { [key: string]: DRERecord[] };
  };
  netResult: number;
  operationalResult: number;
}

const FinancialDRE = ({ data }: FinancialDREProps) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [dreData, setDreData] = useState<DRERecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load DRE data from Google Sheets
  const loadDREData = async () => {
    setIsLoading(true);
    try {
      const sheetData = await GoogleSheetsService.fetchDREData();
      console.log('DRE data loaded:', sheetData);
      setDreData(sheetData);
      toast({
        title: "Dados DRE carregados!",
        description: `${sheetData.length} registros carregados da Página2`,
      });
    } catch (error) {
      console.error('Error loading DRE data:', error);
      setDreData([]); // Set empty array on error
      toast({
        title: "Erro ao carregar DRE",
        description: "Falha ao conectar com a Página2 da planilha.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load DRE data when component mounts
  useEffect(() => {
    if (dreData.length === 0) {
      loadDREData();
    }
  }, []);

  // Get available months and years from DRE data
  const availableMonths = useMemo(() => {
    console.log('Calculating available months from:', dreData);
    const months = new Set<string>();
    dreData.forEach(record => {
      if (record.month) {
        // Ensure month is in MM format
        const month = record.month.padStart(2, '0');
        months.add(month);
      }
    });
    const monthsArray = Array.from(months).sort();
    console.log('Available months:', monthsArray);
    return monthsArray;
  }, [dreData]);

  const availableYears = useMemo(() => {
    console.log('Calculating available years from:', dreData);
    const years = new Set<string>();
    dreData.forEach(record => {
      if (record.year) {
        years.add(record.year);
      }
    });
    const yearsArray = Array.from(years).sort().reverse();
    console.log('Available years:', yearsArray);
    return yearsArray;
  }, [dreData]);

  const monthNames: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  };

  // Filter and process DRE data
  const processedDREData = useMemo((): DREData => {
    console.log('Processing DRE data - Total records:', dreData.length);
    
    // Log records that contain specific names
    const namedRecords = dreData.filter(record => {
      const searchText = `${record.description} ${record.details} ${record.extraDetail1} ${record.extraDetail2}`.toUpperCase();
      return searchText.includes('MARIA') || searchText.includes('EDLAMAR') || searchText.includes('PRISCILA') || searchText.includes('CLUBE');
    });
    console.log('Records with names (Maria, Edlamar, Priscila, Clube):', namedRecords);

    let filteredData = dreData;

    // Apply month/year filters if selected
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      const beforeFilter = filteredData.length;
      filteredData = dreData.filter(record => {
        const monthMatches = selectedMonth === 'all' || record.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || record.year === selectedYear;
        return monthMatches && yearMatches;
      });
      console.log(`Filter applied: ${beforeFilter} -> ${filteredData.length} records`);
      
      // Log filtered named records
      const filteredNamedRecords = filteredData.filter(record => {
        const searchText = `${record.description} ${record.details} ${record.extraDetail1} ${record.extraDetail2}`.toUpperCase();
        return searchText.includes('MARIA') || searchText.includes('EDLAMAR') || searchText.includes('PRISCILA') || searchText.includes('CLUBE');
      });
      console.log('Named records after filter:', filteredNamedRecords);
    }

    // Group records by description for all categories
    const groupByDescription = (records: DRERecord[]) => {
      const groups: { [key: string]: DRERecord[] } = {};
      
      records.forEach(record => {
        const key = record.description;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(record);
      });
      
      return groups;
    };

    // Separate into different categories based on description / column A markers
    const receipts = filteredData.filter(record => record.type === 'RECEITA');

    const normalize = (s?: string) => (s || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

const inAnyField = (record: DRERecord, predicate: (t: string) => boolean) => {
  const fields = [
    record.description,
    record.details,
    record.extraDetail1,
    record.extraDetail2,
    record.sourceType // inclui coluna A original
  ];
  return fields.some(f => predicate(normalize(f || '')));
};

    const isOperationalExpense = (record: DRERecord) => {
      if (record.type !== 'DESPESA') return false;
      return inAnyField(record, (t) => /^02[\s\.-]/.test(t) || t.includes('02-SAIDAS'));
    };

    const isDistribution = (record: DRERecord) => {
      if (record.type !== 'DESPESA') return false;
      return inAnyField(record, (t) => /^03[\s\.-]/.test(t) || t.includes('03-DIST') || t.includes('LUCRO'));
    };

    const isInvestment = (record: DRERecord) => {
      if (record.type !== 'DESPESA') return false;
      return inAnyField(record, (t) => /^04[\s\.-]/.test(t) || t.includes('04-INVEST') || t.includes('INVEST') || t.includes('APLICACAO') || t.includes('XP INVEST'));
    };

    // Debug logs
    const allExpenses = filteredData.filter(record => record.type === 'DESPESA');
    console.log('All DESPESA records found:', allExpenses.length);
    console.log('DESPESA sample descriptions:', allExpenses.slice(0, 10).map(r => r.description));

    const operationalExpenses = filteredData.filter(isOperationalExpense);
    const distributions = filteredData.filter(isDistribution);
    const investments = filteredData.filter(isInvestment);

    console.log('Operational expenses found:', operationalExpenses.length);
    console.log('Distributions found:', distributions.length);
    console.log('Investments found:', investments.length);

    // Group them by description
    const groupedReceipts = groupByDescription(receipts);
    const groupedExpenses = groupByDescription(operationalExpenses);
    const groupedDistributions = groupByDescription(distributions);
    const groupedInvestments = groupByDescription(investments);

    console.log('Grouped receipts:', Object.keys(groupedReceipts).length, 'groups');
    console.log('Grouped operational expenses:', Object.keys(groupedExpenses).length, 'groups');
    console.log('Grouped distributions:', Object.keys(groupedDistributions).length, 'groups');
    console.log('Grouped investments:', Object.keys(groupedInvestments).length, 'groups');

    const totalReceipts = receipts.reduce((sum, record) => sum + record.amount, 0);
    const totalExpenses = operationalExpenses.reduce((sum, record) => sum + record.amount, 0);
    const totalDistributions = distributions.reduce((sum, record) => sum + record.amount, 0);
    const totalInvestments = investments.reduce((sum, record) => sum + record.amount, 0);

    const operationalResult = totalReceipts - totalExpenses;
    const netResult = operationalResult - totalDistributions - totalInvestments;

    return {
      receipts: {
        total: totalReceipts,
        items: groupedReceipts
      },
      expenses: {
        total: totalExpenses,
        items: groupedExpenses
      },
      distributions: {
        total: totalDistributions,
        items: groupedDistributions
      },
      investments: {
        total: totalInvestments,
        items: groupedInvestments
      },
      operationalResult,
      netResult
    };
  }, [dreData, selectedMonth, selectedYear]);

  const handleSearch = () => {
    setHasSearched(true);
    if (dreData.length === 0) {
      loadDREData();
    }
  };

  const handleClearFilters = () => {
    setSelectedMonth('all');
    setSelectedYear('all');
    setHasSearched(false);
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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros DRE
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

              {dreData.length > 0 && (
                <Button variant="outline" onClick={loadDREData} disabled={isLoading}>
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
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Total Receitas</p>
                  <p className="text-2xl font-bold text-green-800">
                    {formatCurrency(processedDREData.receipts.total)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {Object.keys(processedDREData.receipts.items).length} categoria{Object.keys(processedDREData.receipts.items).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-3 bg-green-200 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Despesas (02-saidas)</p>
                  <p className="text-2xl font-bold text-red-800">
                    {formatCurrency(processedDREData.expenses.total)}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {Object.keys(processedDREData.expenses.items).length} categoria{Object.keys(processedDREData.expenses.items).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-3 bg-red-200 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 ${processedDREData.netResult >= 0 ? 'border-green-300 bg-gradient-to-br from-green-50 to-green-100' : 'border-red-300 bg-gradient-to-br from-red-50 to-red-100'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Resultado Líquido</p>
                  <p className={`text-2xl font-bold ${getResultColor(processedDREData.netResult)}`}>
                    {formatCurrency(processedDREData.netResult)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {processedDREData.netResult >= 0 ? 'Lucro' : 'Prejuízo'} final
                  </p>
                </div>
                <div className={`p-3 rounded-full ${processedDREData.netResult >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
                  {getResultIcon(processedDREData.netResult)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DRE Results - Detailed View */}
      {hasSearched && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {/* Receitas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                  Receitas
                </div>
                <span className="text-green-600 font-bold">
                  {formatCurrency(processedDREData.receipts.total)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
              {Object.keys(processedDREData.receipts.items).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma receita encontrada no período
                </p>
              ) : (
                Object.entries(processedDREData.receipts.items)
                  .sort(([, recordsA], [, recordsB]) => {
                    const totalA = recordsA.reduce((sum, record) => sum + record.amount, 0);
                    const totalB = recordsB.reduce((sum, record) => sum + record.amount, 0);
                    return totalB - totalA; // Maior para menor
                  })
                  .map(([description, records]) => (
                  <Collapsible key={description} className="border rounded-lg bg-green-50/50 border-green-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-green-50/70 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-full">
                          {description.toLowerCase().includes('clube') || description.toLowerCase().includes('curso') ? (
                            <Users className="h-4 w-4 text-green-700" />
                          ) : description.toLowerCase().includes('banco') || description.toLowerCase().includes('pix') ? (
                            <Building2 className="h-4 w-4 text-green-700" />
                          ) : (
                            <BarChart3 className="h-4 w-4 text-green-700" />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-green-800 text-base">{description}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                              {records.length} registro{records.length > 1 ? 's' : ''}
                            </Badge>
                            <span className="text-xs text-green-600">
                              Clique para expandir
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-green-700 font-bold text-lg">
                            {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0))}
                          </span>
                          <div className="text-xs text-green-600">
                            Média: {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0) / records.length)}
                          </div>
                        </div>
                        <ChevronDown className="h-5 w-5 text-green-600 transform transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4 animate-accordion-down">
                      <div className="border-t border-green-200 pt-3 space-y-2">
                        {records.map((record, idx) => (
                          <div key={record.id} className="border rounded-lg p-3 bg-white/80 border-green-200 hover:bg-white transition-colors shadow-sm">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {record.date || `${record.month}/${record.year}`}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {record.details && record.details.trim() && (
                                    <span className="bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-700 font-medium">
                                      <Users className="h-3 w-3 inline mr-1" />
                                      {record.details}
                                    </span>
                                  )}
                                  {record.extraDetail1 && record.extraDetail1.trim() && (
                                    <span className="bg-purple-50 border border-purple-200 rounded-full px-3 py-1 text-xs text-purple-700 font-medium">
                                      <Building2 className="h-3 w-3 inline mr-1" />
                                      {record.extraDetail1}
                                    </span>
                                  )}
                                  {record.extraDetail2 && record.extraDetail2.trim() && (
                                    <span className="bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-xs text-orange-700 font-medium">
                                      <Info className="h-3 w-3 inline mr-1" />
                                      {record.extraDetail2}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-green-700 font-bold text-base">
                                  {formatCurrency(record.amount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </CardContent>
          </Card>

          {/* Despesas Operacionais (02-saidas) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-5 w-5" />
                  Despesas (02-saidas)
                </div>
                <span className="text-red-600 font-bold">
                  {formatCurrency(processedDREData.expenses.total)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
              {Object.keys(processedDREData.expenses.items).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma despesa operacional encontrada no período
                </p>
              ) : (
                Object.entries(processedDREData.expenses.items)
                  .sort(([, recordsA], [, recordsB]) => {
                    const totalA = recordsA.reduce((sum, record) => sum + record.amount, 0);
                    const totalB = recordsB.reduce((sum, record) => sum + record.amount, 0);
                    return totalB - totalA; // Maior para menor
                  })
                  .map(([description, records]) => (
                  <Collapsible key={description} className="border rounded-lg bg-red-50/50 border-red-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-red-50/70 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-full">
                          {description.toLowerCase().includes('salario') || description.toLowerCase().includes('pagamento') ? (
                            <Users className="h-4 w-4 text-red-700" />
                          ) : description.toLowerCase().includes('banco') || description.toLowerCase().includes('taxa') ? (
                            <Building2 className="h-4 w-4 text-red-700" />
                          ) : (
                            <PieChart className="h-4 w-4 text-red-700" />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-red-800 text-base">{description}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 border-red-200">
                              {records.length} registro{records.length > 1 ? 's' : ''}
                            </Badge>
                            <span className="text-xs text-red-600">
                              Clique para expandir
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-red-700 font-bold text-lg">
                            {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0))}
                          </span>
                          <div className="text-xs text-red-600">
                            Média: {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0) / records.length)}
                          </div>
                        </div>
                        <ChevronDown className="h-5 w-5 text-red-600 transform transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4 animate-accordion-down">
                      <div className="border-t border-red-200 pt-3 space-y-2">
                        {records.map((record, idx) => (
                          <div key={record.id} className="border rounded-lg p-3 bg-white/80 border-red-200 hover:bg-white transition-colors shadow-sm">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {record.date || `${record.month}/${record.year}`}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {record.details && record.details.trim() && (
                                    <span className="bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-700 font-medium">
                                      <Users className="h-3 w-3 inline mr-1" />
                                      {record.details}
                                    </span>
                                  )}
                                  {record.extraDetail1 && record.extraDetail1.trim() && (
                                    <span className="bg-purple-50 border border-purple-200 rounded-full px-3 py-1 text-xs text-purple-700 font-medium">
                                      <Building2 className="h-3 w-3 inline mr-1" />
                                      {record.extraDetail1}
                                    </span>
                                  )}
                                  {record.extraDetail2 && record.extraDetail2.trim() && (
                                    <span className="bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-xs text-orange-700 font-medium">
                                      <Info className="h-3 w-3 inline mr-1" />
                                      {record.extraDetail2}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-red-700 font-bold text-base">
                                  {formatCurrency(record.amount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Distribuições e Investimentos */}
      {hasSearched && (processedDREData.distributions.total > 0 || processedDREData.investments.total > 0) && (
        <div className="grid gap-6 md:grid-cols-2 mt-6">
          {/* Distribuição de Lucros (03-dist.lucros) */}
          {processedDREData.distributions.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-600">
                    <Users className="h-5 w-5" />
                    Distribuição de Lucros (03-*)
                  </div>
                  <span className="text-purple-600 font-bold">
                    {formatCurrency(processedDREData.distributions.total)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
                {Object.entries(processedDREData.distributions.items)
                  .sort(([, recordsA], [, recordsB]) => {
                    const totalA = recordsA.reduce((sum, record) => sum + record.amount, 0);
                    const totalB = recordsB.reduce((sum, record) => sum + record.amount, 0);
                    return totalB - totalA;
                  })
                  .map(([description, records]) => (
                  <Collapsible key={description} className="border rounded-lg bg-purple-50/50 border-purple-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-purple-50/70 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-full">
                          <Users className="h-4 w-4 text-purple-700" />
                        </div>
                        <div>
                          <span className="font-semibold text-purple-800 text-base">{description}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                              {records.length} registro{records.length > 1 ? 's' : ''}
                            </Badge>
                            <span className="text-xs text-purple-600">
                              Clique para expandir
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-purple-700 font-bold text-lg">
                            {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0))}
                          </span>
                          <div className="text-xs text-purple-600">
                            Média: {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0) / records.length)}
                          </div>
                        </div>
                        <ChevronDown className="h-5 w-5 text-purple-600 transform transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4 animate-accordion-down">
                      <div className="border-t border-purple-200 pt-3 space-y-2">
                        {records.map((record, idx) => (
                          <div key={record.id} className="border rounded-lg p-3 bg-white/80 border-purple-200 hover:bg-white transition-colors shadow-sm">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {record.date || `${record.month}/${record.year}`}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {record.details && record.details.trim() && (
                                    <span className="bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-700 font-medium">
                                      <Users className="h-3 w-3 inline mr-1" />
                                      {record.details}
                                    </span>
                                  )}
                                  {record.extraDetail1 && record.extraDetail1.trim() && (
                                    <span className="bg-purple-50 border border-purple-200 rounded-full px-3 py-1 text-xs text-purple-700 font-medium">
                                      <Building2 className="h-3 w-3 inline mr-1" />
                                      {record.extraDetail1}
                                    </span>
                                  )}
                                  {record.extraDetail2 && record.extraDetail2.trim() && (
                                    <span className="bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-xs text-orange-700 font-medium">
                                      <Info className="h-3 w-3 inline mr-1" />
                                      {record.extraDetail2}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-purple-700 font-bold text-base">
                                  {formatCurrency(record.amount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Investimentos (04-investimentos) */}
          {processedDREData.investments.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Building2 className="h-5 w-5" />
                    Investimentos (04-*)
                  </div>
                  <span className="text-blue-600 font-bold">
                    {formatCurrency(processedDREData.investments.total)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
                {Object.entries(processedDREData.investments.items)
                  .sort(([, recordsA], [, recordsB]) => {
                    const totalA = recordsA.reduce((sum, record) => sum + record.amount, 0);
                    const totalB = recordsB.reduce((sum, record) => sum + record.amount, 0);
                    return totalB - totalA;
                  })
                  .map(([description, records]) => (
                  <Collapsible key={description} className="border rounded-lg bg-blue-50/50 border-blue-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-blue-50/70 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-full">
                          <Building2 className="h-4 w-4 text-blue-700" />
                        </div>
                        <div>
                          <span className="font-semibold text-blue-800 text-base">{description}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                              {records.length} registro{records.length > 1 ? 's' : ''}
                            </Badge>
                            <span className="text-xs text-blue-600">
                              Clique para expandir
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-blue-700 font-bold text-lg">
                            {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0))}
                          </span>
                          <div className="text-xs text-blue-600">
                            Média: {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0) / records.length)}
                          </div>
                        </div>
                        <ChevronDown className="h-5 w-5 text-blue-600 transform transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4 animate-accordion-down">
                      <div className="border-t border-blue-200 pt-3 space-y-2">
                        {records.map((record, idx) => (
                          <div key={record.id} className="border rounded-lg p-3 bg-white/80 border-blue-200 hover:bg-white transition-colors shadow-sm">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {record.date || `${record.month}/${record.year}`}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {record.details && record.details.trim() && (
                                    <span className="bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-700 font-medium">
                                      <Users className="h-3 w-3 inline mr-1" />
                                      {record.details}
                                    </span>
                                  )}
                                  {record.extraDetail1 && record.extraDetail1.trim() && (
                                    <span className="bg-purple-50 border border-purple-200 rounded-full px-3 py-1 text-xs text-purple-700 font-medium">
                                      <Building2 className="h-3 w-3 inline mr-1" />
                                      {record.extraDetail1}
                                    </span>
                                  )}
                                  {record.extraDetail2 && record.extraDetail2.trim() && (
                                    <span className="bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-xs text-orange-700 font-medium">
                                      <Info className="h-3 w-3 inline mr-1" />
                                      {record.extraDetail2}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-blue-700 font-bold text-base">
                                  {formatCurrency(record.amount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Resultado Líquido */}
      {hasSearched && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${getResultColor(processedDREData.netResult)}`}>
                {getResultIcon(processedDREData.netResult)}
                Demonstração do Resultado Consolidado
              </div>
              <span className={`text-2xl font-bold ${getResultColor(processedDREData.netResult)}`}>
                {formatCurrency(processedDREData.netResult)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Total de Receitas:</span>
                <span className="text-green-600 font-medium">
                  {formatCurrency(processedDREData.receipts.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>(-) Despesas Operacionais (02-saidas):</span>
                <span className="text-red-600 font-medium">
                  ({formatCurrency(processedDREData.expenses.total)})
                </span>
              </div>
              
              {(processedDREData.distributions.total > 0 || processedDREData.investments.total > 0) && (
                <>
                  <Separator className="my-3" />
                  {processedDREData.distributions.total > 0 && (
                    <div className="flex justify-between">
                      <span>(-) Distribuição de Lucros (03-*):</span>
                      <span className="text-purple-600 font-medium">
                        ({formatCurrency(processedDREData.distributions.total)})
                      </span>
                    </div>
                  )}
                  {processedDREData.investments.total > 0 && (
                    <div className="flex justify-between">
                      <span>(-) Investimentos (04-*):</span>
                      <span className="text-blue-600 font-medium">
                        ({formatCurrency(processedDREData.investments.total)})
                      </span>
                    </div>
                  )}
                </>
              )}
              
              <Separator />
              <div className="flex justify-between font-bold text-xl">
                <span>= Resultado Líquido Final:</span>
                <span className={getResultColor(processedDREData.netResult)}>
                  {formatCurrency(processedDREData.netResult)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="text-center py-12">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">DRE - Demonstração do Resultado</h3>
            <p className="text-muted-foreground mb-4">
              Selecione os filtros desejados e clique em "Consultar" para visualizar o relatório
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinancialDRE;