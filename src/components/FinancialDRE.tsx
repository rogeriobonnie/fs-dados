import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FinancialRecord } from '@/types/financial';
import { formatCurrency } from '@/utils/financialCalculations';
import { TrendingUp, TrendingDown, DollarSign, Search, Filter } from 'lucide-react';

interface FinancialDREProps {
  data: FinancialRecord[];
}

interface DREData {
  receipts: {
    total: number;
    items: Array<{
      description: string;
      amount: number;
      count: number;
    }>;
  };
  expenses: {
    total: number;
    items: Array<{
      description: string;
      amount: number;
      count: number;
    }>;
  };
  netResult: number;
}

const FinancialDRE = ({ data }: FinancialDREProps) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);

  // Get available months and years from data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    data.forEach(record => {
      if (record.paymentDate) {
        const date = new Date(record.paymentDate);
        months.add(String(date.getMonth() + 1).padStart(2, '0'));
      }
    });
    return Array.from(months).sort();
  }, [data]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    data.forEach(record => {
      if (record.paymentDate) {
        const date = new Date(record.paymentDate);
        years.add(String(date.getFullYear()));
      }
    });
    return Array.from(years).sort().reverse();
  }, [data]);

  const monthNames = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  };

  // Filter and process DRE data
  const dreData = useMemo((): DREData => {
    let filteredData = data;

    // Apply month/year filters if selected
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredData = data.filter(record => {
        if (!record.paymentDate) return false;
        
        const paymentDate = new Date(record.paymentDate);
        const recordMonth = String(paymentDate.getMonth() + 1).padStart(2, '0');
        const recordYear = String(paymentDate.getFullYear());

        const monthMatches = selectedMonth === 'all' || recordMonth === selectedMonth;
        const yearMatches = selectedYear === 'all' || recordYear === selectedYear;

        return monthMatches && yearMatches;
      });
    }

    // Calculate receipts (only paid amounts)
    const paidRecords = filteredData.filter(record => record.status === 'PAGO');
    const totalReceipts = paidRecords.reduce((sum, record) => sum + record.amount, 0);
    
    // Group receipts by payment method
    const receiptsByMethod = paidRecords.reduce((acc, record) => {
      let method = 'Outros';
      if (record.installment?.includes('CARTÃO')) method = 'Cartão de Crédito';
      else if (record.installment?.includes('PIX') || record.contractObservation?.toLowerCase().includes('pix')) method = 'PIX';
      else if (record.installment?.includes('BOLETO') || record.contractObservation?.toLowerCase().includes('boleto')) method = 'Boleto';
      else if (record.installment?.includes('A VISTA')) method = 'À Vista';
      else if (record.installment?.match(/\d+ DE \d+/)) method = 'Parcelado';

      if (!acc[method]) {
        acc[method] = { amount: 0, count: 0 };
      }
      acc[method].amount += record.amount;
      acc[method].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; count: number }>);

    const receiptsItems = Object.entries(receiptsByMethod).map(([description, data]) => ({
      description,
      amount: data.amount,
      count: data.count
    }));

    // Calculate expenses (fees from all records)
    const totalFees = filteredData.reduce((sum, record) => sum + (record.fees || 0), 0);
    const totalInterest = filteredData.reduce((sum, record) => sum + (record.interest || 0), 0);
    
    const expensesItems = [];
    if (totalFees > 0) {
      const feeCount = filteredData.filter(r => r.fees && r.fees > 0).length;
      expensesItems.push({
        description: 'Taxas de Processamento',
        amount: totalFees,
        count: feeCount
      });
    }
    if (totalInterest > 0) {
      const interestCount = filteredData.filter(r => r.interest && r.interest > 0).length;
      expensesItems.push({
        description: 'Juros',
        amount: totalInterest,
        count: interestCount
      });
    }

    const totalExpenses = totalFees + totalInterest;

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
  }, [data, selectedMonth, selectedYear]);

  const handleSearch = () => {
    setHasSearched(true);
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
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>
                      {monthNames[month as keyof typeof monthNames]}
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
                <SelectContent>
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
              <Button onClick={handleSearch} className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Consultar
              </Button>
              
              {(selectedMonth !== 'all' || selectedYear !== 'all') && (
                <Button variant="outline" onClick={handleClearFilters}>
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>

          {(selectedMonth !== 'all' || selectedYear !== 'all') && (
            <div className="mt-4 flex gap-2">
              {selectedMonth !== 'all' && (
                <Badge variant="secondary">
                  {monthNames[selectedMonth as keyof typeof monthNames]}
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
                  {formatCurrency(dreData.receipts.total)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dreData.receipts.items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma receita encontrada no período
                </p>
              ) : (
                dreData.receipts.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{item.description}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({item.count} transações)
                      </span>
                    </div>
                    <span className="text-green-600 font-medium">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
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
                  {formatCurrency(dreData.expenses.total)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dreData.expenses.items.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma despesa encontrada no período
                </p>
              ) : (
                dreData.expenses.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{item.description}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({item.count} ocorrências)
                      </span>
                    </div>
                    <span className="text-red-600 font-medium">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
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
              <div className={`flex items-center gap-2 ${getResultColor(dreData.netResult)}`}>
                {getResultIcon(dreData.netResult)}
                Resultado Líquido do Período
              </div>
              <span className={`text-2xl font-bold ${getResultColor(dreData.netResult)}`}>
                {formatCurrency(dreData.netResult)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total de Receitas:</span>
                <span className="text-green-600 font-medium">
                  {formatCurrency(dreData.receipts.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total de Despesas:</span>
                <span className="text-red-600 font-medium">
                  ({formatCurrency(dreData.expenses.total)})
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Resultado:</span>
                <span className={getResultColor(dreData.netResult)}>
                  {formatCurrency(dreData.netResult)}
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