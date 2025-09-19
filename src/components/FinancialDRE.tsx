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
    items: Array<{
      description: string;
      amount: number;
      details?: string;
      extraDetails?: string;
    }>;
  };
  expenses: {
    total: number;
    items: Array<{
      description: string;
      amount: number;
      details?: string;
      extraDetails?: string;
    }>;
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
    let filteredData = dreData;

    // Apply month/year filters if selected
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredData = dreData.filter(record => {
        const monthMatches = selectedMonth === 'all' || record.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || record.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }

    // Separate receipts and expenses
    const receipts = filteredData.filter(record => record.type === 'RECEITA');
    const expenses = filteredData.filter(record => record.type === 'DESPESA');

    // Group receipts by description
    const receiptsByDescription = receipts.reduce((acc, record) => {
      if (!acc[record.description]) {
        acc[record.description] = {
          amount: 0,
          details: record.details,
          extraDetails: []
        };
      }
      acc[record.description].amount += record.amount;
      if (record.extraDetail1) acc[record.description].extraDetails.push(record.extraDetail1);
      if (record.extraDetail2) acc[record.description].extraDetails.push(record.extraDetail2);
      return acc;
    }, {} as Record<string, { amount: number; details: string; extraDetails: string[] }>);

    // Group expenses by description
    const expensesByDescription = expenses.reduce((acc, record) => {
      if (!acc[record.description]) {
        acc[record.description] = {
          amount: 0,
          details: record.details,
          extraDetails: []
        };
      }
      acc[record.description].amount += record.amount;
      if (record.extraDetail1) acc[record.description].extraDetails.push(record.extraDetail1);
      if (record.extraDetail2) acc[record.description].extraDetails.push(record.extraDetail2);
      return acc;
    }, {} as Record<string, { amount: number; details: string; extraDetails: string[] }>);

    const receiptsItems = Object.entries(receiptsByDescription).map(([description, data]) => ({
      description,
      amount: data.amount,
      details: data.details,
      extraDetails: data.extraDetails.filter(detail => detail.trim() !== '').join(', ')
    }));

    const expensesItems = Object.entries(expensesByDescription).map(([description, data]) => ({
      description,
      amount: data.amount,
      details: data.details,
      extraDetails: data.extraDetails.filter(detail => detail.trim() !== '').join(', ')
    }));

    const totalReceipts = receiptsItems.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expensesItems.reduce((sum, item) => sum + item.amount, 0);

    return {
      receipts: {
        total: totalReceipts,
        items: receiptsItems
      },
      expenses: {
        total: totalExpenses,
        items: expensesItems
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
            <CardContent className="space-y-3">
              {processedDREData.receipts.items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma receita encontrada no período
                </p>
              ) : (
                processedDREData.receipts.items.map((item, index) => (
                  <Collapsible key={index}>
                    <div className="border rounded-lg p-3 bg-green-50/50 border-green-200">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-left">{item.description}</span>
                            {(item.details || item.extraDetails) && (
                              <Info className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-green-600 font-bold">
                              {formatCurrency(item.amount)}
                            </span>
                            {(item.details || item.extraDetails) && (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      {(item.details || item.extraDetails) && (
                        <CollapsibleContent className="mt-3 pt-3 border-t border-green-200">
                          <div className="flex flex-wrap gap-2">
                            {item.details && item.details.trim() && (
                              <div className="bg-blue-100 border border-blue-200 rounded-md px-3 py-1">
                                <span className="text-blue-800 text-sm font-medium">{item.details}</span>
                              </div>
                            )}
                            {item.extraDetails && item.extraDetails.split(',').map((detail, idx) => {
                              const trimmedDetail = detail.trim();
                              if (!trimmedDetail) return null;
                              
                              // Different colors for different types of details
                              const colorClasses = [
                                "bg-purple-100 border-purple-200 text-purple-800",
                                "bg-orange-100 border-orange-200 text-orange-800", 
                                "bg-cyan-100 border-cyan-200 text-cyan-800",
                                "bg-pink-100 border-pink-200 text-pink-800"
                              ];
                              const colorClass = colorClasses[idx % colorClasses.length];
                              
                              return (
                                <div key={idx} className={`${colorClass} border rounded-md px-3 py-1 animate-fade-in`}>
                                  <span className="text-sm font-medium">{trimmedDetail}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      )}
                    </div>
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
            <CardContent className="space-y-3">
              {processedDREData.expenses.items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma despesa encontrada no período
                </p>
              ) : (
                processedDREData.expenses.items.map((item, index) => (
                  <Collapsible key={index}>
                    <div className="border rounded-lg p-3 bg-red-50/50 border-red-200">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-left">{item.description}</span>
                            {(item.details || item.extraDetails) && (
                              <Info className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-red-600 font-bold">
                              {formatCurrency(item.amount)}
                            </span>
                            {(item.details || item.extraDetails) && (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      {(item.details || item.extraDetails) && (
                        <CollapsibleContent className="mt-3 pt-3 border-t border-red-200">
                          <div className="flex flex-wrap gap-2">
                            {item.details && item.details.trim() && (
                              <div className="bg-blue-100 border border-blue-200 rounded-md px-3 py-1">
                                <span className="text-blue-800 text-sm font-medium">{item.details}</span>
                              </div>
                            )}
                            {item.extraDetails && item.extraDetails.split(',').map((detail, idx) => {
                              const trimmedDetail = detail.trim();
                              if (!trimmedDetail) return null;
                              
                              // Different colors for different types of details
                              const colorClasses = [
                                "bg-purple-100 border-purple-200 text-purple-800",
                                "bg-orange-100 border-orange-200 text-orange-800", 
                                "bg-cyan-100 border-cyan-200 text-cyan-800",
                                "bg-pink-100 border-pink-200 text-pink-800"
                              ];
                              const colorClass = colorClasses[idx % colorClasses.length];
                              
                              return (
                                <div key={idx} className={`${colorClass} border rounded-md px-3 py-1 animate-fade-in hover-scale`}>
                                  <span className="text-sm font-medium">{trimmedDetail}</span>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      )}
                    </div>
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