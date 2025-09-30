import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { TrendingUp, Search, Filter, RefreshCw, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LanceADoisRecord {
  id: string;
  description: string;
  details: string;
  amount: number;
  month: string;
  year: string;
  date: string;
  extraDetail1: string;
  extraDetail2: string;
}

const LanceADois = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [lanceData, setLanceData] = useState<LanceADoisRecord[]>([]);
  const [taxData, setTaxData] = useState<{ taxPercentage: number; month: string; year: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openCategories, setOpenCategories] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  // Load Lance a Dois data from Google Sheets
  const loadLanceADoisData = async () => {
    setIsLoading(true);
    try {
      const [sheetData, taxInfo] = await Promise.all([
        GoogleSheetsService.fetchLanceADoisData(),
        GoogleSheetsService.fetchLanceADoisTaxData()
      ]);
      
      console.log('Lance a Dois data loaded:', sheetData);
      console.log('Tax data loaded:', taxInfo);
      
      setLanceData(sheetData);
      setTaxData(taxInfo);
      
      toast({
        title: "Dados Lance a Dois carregados!",
        description: `${sheetData.length} registros encontrados`,
      });
    } catch (error) {
      console.error('Error loading Lance a Dois data:', error);
      setLanceData([]);
      setTaxData(null);
      toast({
        title: "Erro ao carregar dados",
        description: "Falha ao conectar com a Página2 da planilha.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load data when component mounts
  useEffect(() => {
    if (lanceData.length === 0) {
      loadLanceADoisData();
    }
  }, []);

  // Get available months and years
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    lanceData.forEach(record => {
      if (record.month) {
        const month = record.month.padStart(2, '0');
        months.add(month);
      }
    });
    return Array.from(months).sort();
  }, [lanceData]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    lanceData.forEach(record => {
      if (record.year) {
        years.add(record.year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [lanceData]);

  const monthNames: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  };

  // Filter and process data
  const processedData = useMemo(() => {
    let filteredData = lanceData;

    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredData = lanceData.filter(record => {
        const monthMatches = selectedMonth === 'all' || record.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || record.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }

    // Group by description
    const grouped: { [key: string]: LanceADoisRecord[] } = {};
    filteredData.forEach(record => {
      const key = record.description || 'Sem descrição';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(record);
    });

    // Sort groups by total amount (descending)
    const sortedGrouped = Object.entries(grouped)
      .map(([category, records]) => ({
        category,
        records,
        total: records.reduce((sum, r) => sum + r.amount, 0)
      }))
      .sort((a, b) => b.total - a.total)
      .reduce((acc, item) => {
        acc[item.category] = item.records;
        return acc;
      }, {} as { [key: string]: LanceADoisRecord[] });

    const total = filteredData.reduce((sum, record) => sum + record.amount, 0);

    // Calculate taxes based on filtered data
    let taxAmount = 0;
    let taxPercentage = 12.89269; // Default tax percentage
    
    if (taxData && taxData.taxPercentage > 0) {
      taxPercentage = taxData.taxPercentage;
    }
    
    // If filters are applied, apply tax only if the tax month/year matches the filter
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      if (taxData) {
        const taxMonthMatches = selectedMonth === 'all' || taxData.month === selectedMonth;
        const taxYearMatches = selectedYear === 'all' || taxData.year === selectedYear;
        
        if (taxMonthMatches && taxYearMatches) {
          taxAmount = total * (taxPercentage / 100);
        }
      } else {
        // No tax data from sheet, apply default percentage
        taxAmount = total * (taxPercentage / 100);
      }
    } else {
      // No filters, apply tax to total
      taxAmount = total * (taxPercentage / 100);
    }

    const revenueAfterTax = total - taxAmount;
    
    // Calculate Lance a Dois commission (10% of revenue after tax)
    const lanceADoisCommission = revenueAfterTax * 0.10;
    
    // Final net revenue after tax and commission
    const netTotal = revenueAfterTax - lanceADoisCommission;

    return { 
      grouped: sortedGrouped, 
      total, 
      taxAmount, 
      taxPercentage, 
      revenueAfterTax,
      lanceADoisCommission,
      netTotal, 
      count: filteredData.length 
    };
  }, [lanceData, selectedMonth, selectedYear, taxData]);

  // Initialize open state for all categories (all closed by default)
  useEffect(() => {
    const initialState: { [key: string]: boolean } = {};
    Object.keys(processedData.grouped).forEach(key => {
      initialState[key] = false; // All closed by default
    });
    setOpenCategories(initialState);
  }, [processedData.grouped]);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSearch = () => {
    setHasSearched(true);
    if (lanceData.length === 0) {
      loadLanceADoisData();
    }
  };

  const handleClearFilters = () => {
    setSelectedMonth('all');
    setSelectedYear('all');
    setHasSearched(false);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Lance a Dois
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

              {lanceData.length > 0 && (
                <Button variant="outline" onClick={loadLanceADoisData} disabled={isLoading}>
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

      {/* Summary Card */}
      {hasSearched && (
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Receitas Brutas Lance a Dois</p>
                  <p className="text-3xl font-bold text-green-800 mt-2">
                    {formatCurrency(processedData.total)}
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    {processedData.count} registro{processedData.count !== 1 ? 's' : ''} • {Object.keys(processedData.grouped).length} categoria{Object.keys(processedData.grouped).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-4 bg-green-200 rounded-full">
                  <TrendingUp className="h-8 w-8 text-green-700" />
                </div>
              </div>

              {processedData.taxAmount > 0 && (
                <>
                  <div className="border-t border-green-300 pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-red-700">
                        Impostos ({processedData.taxPercentage.toFixed(2)}%)
                      </p>
                      <p className="text-lg font-semibold text-red-700">
                        - {formatCurrency(processedData.taxAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t-2 border-green-400 pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-green-700">Receitas Líquidas</p>
                      <p className="text-xl font-bold text-green-800">
                        {formatCurrency(processedData.revenueAfterTax)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-green-300 pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-orange-700">
                        Comissão Lance a Dois (10%)
                      </p>
                      <p className="text-lg font-semibold text-orange-700">
                        - {formatCurrency(processedData.lanceADoisCommission)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t-2 border-green-500 pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-green-800">Receita Final</p>
                      <p className="text-2xl font-bold text-green-900">
                        {formatCurrency(processedData.netTotal)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed View */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-5 w-5" />
                Receitas Lance a Dois
              </div>
              <span className="text-green-600 font-bold">
                {formatCurrency(processedData.total)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(processedData.grouped).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum registro encontrado para o período selecionado
              </p>
            ) : (
              Object.entries(processedData.grouped).map(([category, records]) => {
                const categoryTotal = records.reduce((sum, r) => sum + r.amount, 0);
                const isOpen = openCategories[category] ?? true;

                return (
                  <Collapsible key={category} open={isOpen} onOpenChange={() => toggleCategory(category)}>
                    <div className="border border-green-200 rounded-lg bg-green-50/50 overflow-hidden">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4 hover:bg-green-100/50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-green-600" />
                            )}
                            <div className="text-left">
                              <p className="font-semibold text-green-900">{category}</p>
                              <p className="text-xs text-green-600">{records.length} registro{records.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-700">
                              {formatCurrency(categoryTotal)}
                            </p>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t border-green-200 bg-background">
                          {records.map((record, idx) => (
                            <div
                              key={record.id}
                              className={`p-4 flex items-center justify-between hover:bg-green-50/50 transition-colors ${
                                idx !== records.length - 1 ? 'border-b border-green-100' : ''
                              }`}
                            >
                              <div className="space-y-1 flex-1">
                                <p className="font-medium text-sm">{record.details || 'Sem detalhes'}</p>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  {record.date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {record.date}
                                    </span>
                                  )}
                                  {record.extraDetail1 && (
                                    <Badge variant="outline" className="text-xs">
                                      {record.extraDetail1}
                                    </Badge>
                                  )}
                                  {record.extraDetail2 && record.extraDetail2 !== 'LANCE A DOIS' && (
                                    <Badge variant="secondary" className="text-xs">
                                      {record.extraDetail2}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-base font-semibold text-green-700">
                                  {formatCurrency(record.amount)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LanceADois;
