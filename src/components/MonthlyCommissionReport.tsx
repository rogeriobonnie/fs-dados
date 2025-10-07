import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FinancialRecord, ConsultantCommission } from '@/types/financial';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatDateBR } from '@/utils/dateUtils';
import { CalendarDays, Users, DollarSign, TrendingUp, Search } from 'lucide-react';

interface MonthlyCommissionReportProps {
  data: FinancialRecord[];
}

export const MonthlyCommissionReport = ({ data }: MonthlyCommissionReportProps) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedConsultant, setSelectedConsultant] = useState('all');
  const [appliedMonth, setAppliedMonth] = useState(currentDate.getMonth().toString());
  const [appliedYear, setAppliedYear] = useState(currentDate.getFullYear().toString());
  const [appliedConsultant, setAppliedConsultant] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);

  // Generate available months and years from data
  // Generate available consultants from data
  const availableConsultants = useMemo(() => {
    const consultants = [...new Set(data.map(record => record.consultant || 'SEM CONSULTOR'))];
    return consultants.sort().map(consultant => ({
      value: consultant === 'SEM CONSULTOR' ? '' : consultant,
      label: consultant === 'SEM CONSULTOR' ? 'Vendas Diretas' : consultant
    }));
  }, [data]);

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
    setAppliedConsultant(selectedConsultant);
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
      const isCorrectMonth = paymentDate.getMonth() === month && paymentDate.getFullYear() === year;
      
      // Apply consultant filter
      if (appliedConsultant !== 'all') {
        const recordConsultant = record.consultant || '';
        return isCorrectMonth && recordConsultant === appliedConsultant;
      }
      
      return isCorrectMonth;
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
  }, [data, appliedMonth, appliedYear, appliedConsultant, hasSearched]);

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
                <SelectContent className="bg-background border shadow-lg z-50">
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
                <SelectContent className="bg-background border shadow-lg z-50">
                  {availableYears.map(year => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Vendedor</label>
              <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {availableConsultants.map(consultant => (
                    <SelectItem key={consultant.value} value={consultant.value}>
                      {consultant.label}
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

      {/* Results Table */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>
              Recebimentos e Comissões - {availableMonths[parseInt(appliedMonth)].label} {appliedYear}
              {appliedConsultant !== 'all' && (
                <Badge variant="secondary" className="ml-2">
                  {availableConsultants.find(c => c.value === appliedConsultant)?.label || 'Vendas Diretas'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Total recebido: {formatCurrency(monthlyData.totalReceived)} • Total comissões: {formatCurrency(monthlyData.totalCommissions)}
              {appliedConsultant !== 'all' && ' • Filtrado por vendedor'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.records.length > 0 ? (
              <div className="space-y-3">
                {monthlyData.records.map((record) => {
                  const finalAmount = record.amount + (record.interest || 0) - (record.fees || 0);
                  const commission = finalAmount * 0.03;
                  
                  return (
                    <div 
                      key={record.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-4">
                          <p className="font-semibold text-base">{record.studentName}</p>
                          <span className="text-sm text-muted-foreground">•</span>
                          <p className="text-sm font-medium text-primary">
                            {record.consultant || 'SEM CONSULTOR'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{record.installment}</span>
                          <span>•</span>
                          <span>Pago em {formatDateBR(record.paymentDate!)}</span>
                          {(record.fees || record.interest) && (
                            <>
                              <span>•</span>
                              <span>
                                {record.interest && `+${formatCurrency(record.interest)} juros`}
                                {record.interest && record.fees && ' '}
                                {record.fees && `-${formatCurrency(record.fees)} taxas`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-lg font-bold text-success">
                          {formatCurrency(finalAmount)}
                        </p>
                        <p className="text-sm font-medium text-primary">
                          Comissão: {formatCurrency(commission)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                
                {/* Summary Footer */}
                <div className="mt-6 pt-4 border-t bg-muted/30 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {monthlyData.records.length} pagamentos • {monthlyData.consultantCommissions.length} consultores
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-success">
                        Total: {formatCurrency(monthlyData.totalReceived)}
                      </p>
                      <p className="text-sm font-bold text-primary">
                        Total Comissões: {formatCurrency(monthlyData.totalCommissions)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Nenhum pagamento encontrado</h3>
                <p>Não há vendas pagas para o período selecionado.</p>
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