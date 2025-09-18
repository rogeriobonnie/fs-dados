import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FinancialRecord } from '@/types/financial';
import { formatCurrency } from '@/utils/financialCalculations';
import { Calendar, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface MonthlyRevenueProps {
  data: FinancialRecord[];
}

interface MonthlyData {
  month: string;
  year: number;
  monthKey: string;
  expectedTotal: number; // Valores com vencimento no mês
  receivedTotal: number; // Valores recebidos no mês
  pendingTotal: number; // Valores pendentes
  overdueTotal: number; // Valores vencidos
  salesCount: number;
  receivedCount: number;
  receivedRate: number; // Taxa de recebimento
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

export const MonthlyRevenue = ({ data }: MonthlyRevenueProps) => {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Generate data for last 6 months, current month, and next 6 months
  const monthlyData = useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const months: MonthlyData[] = [];

    // Generate 13 months: 6 previous + current + 6 future
    for (let i = -6; i <= 6; i++) {
      const date = new Date(currentYear, currentMonth + i, 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      // Filter records for this month
      const monthRecords = data.filter(record => {
        const dueDate = new Date(record.dueDate);
        return dueDate.getMonth() === month && dueDate.getFullYear() === year;
      });

      const receivedRecords = data.filter(record => {
        if (!record.paymentDate) return false;
        const paymentDate = new Date(record.paymentDate);
        return paymentDate.getMonth() === month && paymentDate.getFullYear() === year;
      });

      // Calculate totals
      const expectedTotal = monthRecords.reduce((sum, record) => {
        const finalAmount = record.amount + (record.interest || 0) - (record.fees || 0);
        return sum + finalAmount;
      }, 0);

      const receivedTotal = receivedRecords.reduce((sum, record) => {
        const finalAmount = record.amount + (record.interest || 0) - (record.fees || 0);
        return sum + finalAmount;
      }, 0);

      const pendingTotal = monthRecords
        .filter(record => record.status === 'A PAGAR')
        .reduce((sum, record) => {
          const finalAmount = record.amount + (record.interest || 0) - (record.fees || 0);
          return sum + finalAmount;
        }, 0);

      const overdueTotal = monthRecords
        .filter(record => record.status === 'VENCIDO')
        .reduce((sum, record) => {
          const finalAmount = record.amount + (record.interest || 0) - (record.fees || 0);
          return sum + finalAmount;
        }, 0);

      const receivedRate = expectedTotal > 0 ? (receivedTotal / expectedTotal) * 100 : 0;

      months.push({
        month: monthNames[month],
        year,
        monthKey,
        expectedTotal,
        receivedTotal,
        pendingTotal,
        overdueTotal,
        salesCount: monthRecords.length,
        receivedCount: receivedRecords.length,
        receivedRate,
        isPast: i < 0,
        isCurrent: i === 0,
        isFuture: i > 0
      });
    }

    return months;
  }, [data, monthNames]);

  const getMonthStatus = (monthData: MonthlyData) => {
    if (monthData.isFuture) return { color: 'bg-blue-500', label: 'Futuro' };
    if (monthData.isCurrent) return { color: 'bg-green-500', label: 'Atual' };
    if (monthData.receivedRate >= 90) return { color: 'bg-green-500', label: 'Excelente' };
    if (monthData.receivedRate >= 70) return { color: 'bg-yellow-500', label: 'Bom' };
    if (monthData.receivedRate >= 50) return { color: 'bg-orange-500', label: 'Regular' };
    return { color: 'bg-red-500', label: 'Crítico' };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Visão Mensal de Recebimentos
          </CardTitle>
          <CardDescription>
            Análise comparativa dos últimos 6 meses, mês atual e próximos 6 meses
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Monthly Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {monthlyData.map((monthData) => {
          const status = getMonthStatus(monthData);
          
          return (
            <Card key={monthData.monthKey} className={`relative overflow-hidden ${monthData.isCurrent ? 'ring-2 ring-primary' : ''}`}>
              <div className={`absolute top-0 left-0 right-0 h-1 ${status.color}`} />
              
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {monthData.month} {monthData.year}
                  </CardTitle>
                  <Badge variant={monthData.isCurrent ? "default" : "secondary"} className="text-xs">
                    {monthData.isCurrent ? 'Atual' : status.label}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Expected vs Received */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Esperado</span>
                    <span className="font-medium">{formatCurrency(monthData.expectedTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Recebido</span>
                    <span className="font-bold text-success">{formatCurrency(monthData.receivedTotal)}</span>
                  </div>
                  {monthData.expectedTotal > 0 && (
                    <Progress value={monthData.receivedRate} className="h-2" />
                  )}
                </div>

                {/* Status Indicators */}
                {monthData.isPast || monthData.isCurrent ? (
                  <div className="flex justify-between text-xs">
                    {monthData.pendingTotal > 0 && (
                      <div className="flex items-center gap-1 text-warning">
                        <Clock className="h-3 w-3" />
                        <span>{formatCurrency(monthData.pendingTotal)}</span>
                      </div>
                    )}
                    {monthData.overdueTotal > 0 && (
                      <div className="flex items-center gap-1 text-danger">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{formatCurrency(monthData.overdueTotal)}</span>
                      </div>
                    )}
                    {monthData.receivedCount > 0 && (
                      <div className="flex items-center gap-1 text-success">
                        <CheckCircle className="h-3 w-3" />
                        <span>{monthData.receivedCount} pagos</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center">
                    {monthData.salesCount > 0 ? `${monthData.salesCount} vendas programadas` : 'Sem vendas programadas'}
                  </div>
                )}

                {/* Conversion Rate */}
                {!monthData.isFuture && monthData.expectedTotal > 0 && (
                  <div className="text-center">
                    <span className="text-lg font-bold">
                      {monthData.receivedRate.toFixed(0)}%
                    </span>
                    <p className="text-xs text-muted-foreground">Taxa de recebimento</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Últimos 6 Meses</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(
                    monthlyData
                      .filter(m => m.isPast)
                      .reduce((sum, m) => sum + m.receivedTotal, 0)
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Recebido</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mês Atual</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(
                    monthlyData.find(m => m.isCurrent)?.receivedTotal || 0
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {monthlyData.find(m => m.isCurrent)?.receivedRate.toFixed(0)}% recebido
                </p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Próximos 6 Meses</p>
                <p className="text-2xl font-bold text-warning">
                  {formatCurrency(
                    monthlyData
                      .filter(m => m.isFuture)
                      .reduce((sum, m) => sum + m.expectedTotal, 0)
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Esperado</p>
              </div>
              <TrendingDown className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};