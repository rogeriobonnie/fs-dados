import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FinancialRecord, ConsultantCommission } from '@/types/financial';
import { formatCurrency } from '@/utils/financialCalculations';
import { CalendarDays, Users, DollarSign, TrendingUp, Search } from 'lucide-react';

interface MonthlyCommissionReportProps {
  data: FinancialRecord[];
}

export const MonthlyCommissionReport = ({ data }: MonthlyCommissionReportProps) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [appliedMonth, setAppliedMonth] = useState(currentDate.getMonth().toString());
  const [appliedYear, setAppliedYear] = useState(currentDate.getFullYear().toString());
  const [hasSearched, setHasSearched] = useState(false);

  // Generate available months and years from data
  const availableMonths = [
    { value: '0', label: 'Janeiro' },
    { value: '1', label: 'Fevereiro' },
    { value: '2', label: 'Março' },
    { value: '3', label: 'Abril' },
    { value: '4', label: 'Maio' },
    { value: '5', label: 'Junho' },
    { value: '6', label: 'Julho' },
    { value: '7', label: 'Agosto' },
    { value: '8', label: 'Setembro' },
    { value: '9', label: 'Outubro' },
    { value: '10', label: 'Novembro' },
    { value: '11', label: 'Dezembro' },
  ];

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    data.forEach(record => {
      if (record.paymentDate) {
        const year = new Date(record.paymentDate).getFullYear();
        years.add(year);
      }
    });
    return Array.from(years)
      .sort((a, b) => b - a)
      .map(year => ({ value: year.toString(), label: year.toString() }));
  }, [data]);

  const handleSearch = () => {
    setAppliedMonth(selectedMonth);
    setAppliedYear(selectedYear);
    setHasSearched(true);
  };

  // Calculate monthly data
  const monthlyData = useMemo(() => {
    if (!hasSearched) {
      return {
        totalReceived: 0,
        consultantCommissions: [],
        totalCommissions: 0,
        recordsCount: 0,
        records: []
      };
    }

    const month = parseInt(appliedMonth);
    const year = parseInt(appliedYear);

    // Filter paid records for the selected month/year
    const monthlyRecords = data.filter(record => {
      if (record.status !== 'PAGO' || !record.paymentDate) return false;
      
      const paymentDate = new Date(record.paymentDate);
      return paymentDate.getMonth() === month && paymentDate.getFullYear() === year;
    });

    // Calculate total received
    const totalReceived = monthlyRecords.reduce((sum, record) => {
      const finalAmount = record.amount + (record.interest || 0) - (record.fees || 0);
      return sum + finalAmount;
    }, 0);

    // Calculate commissions by consultant
    const consultantMap = new Map<string, { totalReceived: number; commission: number }>();
    
    monthlyRecords.forEach(record => {
      const consultant = record.consultant || 'SEM CONSULTOR';
      const finalAmount = record.amount + (record.interest || 0) - (record.fees || 0);
      const commission = finalAmount * 0.03; // 3%
      
      if (!consultantMap.has(consultant)) {
        consultantMap.set(consultant, { totalReceived: 0, commission: 0 });
      }
      
      const consultantData = consultantMap.get(consultant)!;
      consultantData.totalReceived += finalAmount;
      consultantData.commission += commission;
    });

    const consultantCommissions: ConsultantCommission[] = Array.from(consultantMap.entries())
      .map(([consultant, data]) => ({
        consultant,
        totalReceived: data.totalReceived,
        commission: data.commission
      }))
      .sort((a, b) => b.totalReceived - a.totalReceived);

    const totalCommissions = consultantCommissions.reduce((sum, c) => sum + c.commission, 0);

    return {
      totalReceived,
      consultantCommissions,
      totalCommissions,
      recordsCount: monthlyRecords.length,
      records: monthlyRecords
    };
  }, [data, appliedMonth, appliedYear, hasSearched]);

  return (
    <div className="space-y-6">
      {/* Month/Year Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Seleção de Período
          </CardTitle>
          <CardDescription>
            Escolha o mês e ano para visualizar o relatório de comissões
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {hasSearched && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Recebido</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(monthlyData.totalReceived)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Comissões</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(monthlyData.totalCommissions)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vendas Pagas</p>
                <p className="text-2xl font-bold">
                  {monthlyData.recordsCount}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Detailed Records */}
      {hasSearched && monthlyData.records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recebimentos do Período</CardTitle>
            <CardDescription>
              Todos os pagamentos recebidos em {availableMonths[parseInt(appliedMonth)].label} de {appliedYear}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {monthlyData.records.map((record, index) => {
                const finalAmount = record.amount + (record.interest || 0) - (record.fees || 0);
                return (
                  <div 
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{record.studentName}</p>
                      <p className="text-sm text-muted-foreground">
                        {record.consultant || 'SEM CONSULTOR'} • {record.installment}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(finalAmount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Pago em {new Date(record.paymentDate!).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consultant Commissions Table */}
      {hasSearched && (
        <Card>
        <CardHeader>
          <CardTitle>Comissões por Consultor</CardTitle>
          <CardDescription>
            Detalhamento das comissões de 3% sobre vendas recebidas no período
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.consultantCommissions.length > 0 ? (
            <div className="space-y-4">
              {monthlyData.consultantCommissions.map((commission, index) => (
                <div 
                  key={commission.consultant}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">
                        {commission.consultant || 'SEM CONSULTOR'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Vendas: {formatCurrency(commission.totalReceived)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-success">
                      {formatCurrency(commission.commission)}
                    </p>
                    <p className="text-xs text-muted-foreground">3% comissão</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma venda paga encontrada para este período</p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* No search message */}
      {!hasSearched && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Selecione um período</h3>
            <p className="text-muted-foreground">
              Escolha o mês e ano desejado e clique em "Buscar" para visualizar os recebimentos e comissões.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};