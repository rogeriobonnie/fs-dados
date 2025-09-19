import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FinancialRecord } from '@/types/financial';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { TrendingUp, TrendingDown, DollarSign, Search, Filter, RefreshCw, ChevronDown, ChevronUp, Calendar, Info } from 'lucide-react';
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
  netResult: number;
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

    // Group records by description for both receipts and expenses
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

    // Separate receipts and expenses
    const receipts = filteredData.filter(record => record.type === 'RECEITA');
    const expenses = filteredData.filter(record => record.type === 'DESPESA');

    // Group them by description
    const groupedReceipts = groupByDescription(receipts);
    const groupedExpenses = groupByDescription(expenses);

    console.log('Grouped receipts:', Object.keys(groupedReceipts).length, 'groups');
    console.log('Grouped expenses:', Object.keys(groupedExpenses).length, 'groups');

    const totalReceipts = receipts.reduce((sum, record) => sum + record.amount, 0);
    const totalExpenses = expenses.reduce((sum, record) => sum + record.amount, 0);

    return {
      receipts: {
        total: totalReceipts,
        items: groupedReceipts
      },
      expenses: {
        total: totalExpenses,
        items: groupedExpenses
      },
      netResult: totalReceipts - totalExpenses
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

      {/* DRE Results */}
      {hasSearched && (
        <div className="grid gap-6 md:grid-cols-2">
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
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {Object.keys(processedDREData.receipts.items).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma receita encontrada no período
                </p>
              ) : (
                Object.entries(processedDREData.receipts.items).map(([description, records]) => (
                  <Collapsible key={description} className="border rounded-md bg-green-50/30 border-green-200">
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-3 hover:bg-green-50/50">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-800">{description}</span>
                        <Badge variant="secondary" className="text-xs">
                          {records.length} registro{records.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-bold">
                          {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0))}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 pt-0 space-y-2">
                      {records.map((record) => (
                        <div key={record.id} className="border rounded-md p-2 bg-white/50 border-green-300 text-sm ml-4">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-1">
                                {record.details && record.details.trim() && (
                                  <span className="bg-blue-100 border border-blue-200 rounded px-2 py-0.5 text-xs text-blue-800">
                                    {record.details}
                                  </span>
                                )}
                                {record.extraDetail1 && record.extraDetail1.trim() && (
                                  <span className="bg-purple-100 border border-purple-200 rounded px-2 py-0.5 text-xs text-purple-800">
                                    {record.extraDetail1}
                                  </span>
                                )}
                                {record.extraDetail2 && record.extraDetail2.trim() && (
                                  <span className="bg-orange-100 border border-orange-200 rounded px-2 py-0.5 text-xs text-orange-800">
                                    {record.extraDetail2}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-green-600 font-bold text-sm whitespace-nowrap">
                              {formatCurrency(record.amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </CardContent>
          </Card>

          {/* Despesas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-5 w-5" />
                  Despesas
                </div>
                <span className="text-red-600 font-bold">
                  {formatCurrency(processedDREData.expenses.total)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {Object.keys(processedDREData.expenses.items).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma despesa encontrada no período
                </p>
              ) : (
                Object.entries(processedDREData.expenses.items).map(([description, records]) => (
                  <Collapsible key={description} className="border rounded-md bg-red-50/30 border-red-200">
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-3 hover:bg-red-50/50">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-red-800">{description}</span>
                        <Badge variant="secondary" className="text-xs">
                          {records.length} registro{records.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 font-bold">
                          {formatCurrency(records.reduce((sum, record) => sum + record.amount, 0))}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 pt-0 space-y-2">
                      {records.map((record) => (
                        <div key={record.id} className="border rounded-md p-2 bg-white/50 border-red-300 text-sm ml-4">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-1">
                                {record.details && record.details.trim() && (
                                  <span className="bg-blue-100 border border-blue-200 rounded px-2 py-0.5 text-xs text-blue-800">
                                    {record.details}
                                  </span>
                                )}
                                {record.extraDetail1 && record.extraDetail1.trim() && (
                                  <span className="bg-purple-100 border border-purple-200 rounded px-2 py-0.5 text-xs text-purple-800">
                                    {record.extraDetail1}
                                  </span>
                                )}
                                {record.extraDetail2 && record.extraDetail2.trim() && (
                                  <span className="bg-orange-100 border border-orange-200 rounded px-2 py-0.5 text-xs text-orange-800">
                                    {record.extraDetail2}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-red-600 font-bold text-sm whitespace-nowrap">
                              {formatCurrency(record.amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resultado Líquido */}
      {hasSearched && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${getResultColor(processedDREData.netResult)}`}>
                {getResultIcon(processedDREData.netResult)}
                Resultado Líquido do Período
              </div>
              <span className={`text-2xl font-bold ${getResultColor(processedDREData.netResult)}`}>
                {formatCurrency(processedDREData.netResult)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total de Receitas:</span>
                <span className="text-green-600 font-medium">
                  {formatCurrency(processedDREData.receipts.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total de Despesas:</span>
                <span className="text-red-600 font-medium">
                  ({formatCurrency(processedDREData.expenses.total)})
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Resultado:</span>
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