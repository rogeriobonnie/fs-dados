import { useMemo } from 'react';
import { FinancialRecord } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/utils/financialCalculations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, TrendingUp, DollarSign } from 'lucide-react';

interface MonthlyRevenueProps {
  data: FinancialRecord[];
}

interface MonthlyData {
  month: string;
  monthYear: string;
  received: number;
  pending: number;
  overdue: number;
  total: number;
  paymentsCount: number;
}

export const MonthlyRevenue = ({ data }: MonthlyRevenueProps) => {
  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, MonthlyData>();

    data.forEach(record => {
      // Use payment date for received amounts, due date for others
      const dateToUse = record.status === 'PAGO' && record.paymentDate 
        ? record.paymentDate 
        : record.dueDate;
      
      const date = new Date(dateToUse);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = date.toLocaleDateString('pt-BR', { 
        year: 'numeric', 
        month: 'short' 
      }).replace('.', '');

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          monthYear,
          received: 0,
          pending: 0,
          overdue: 0,
          total: 0,
          paymentsCount: 0
        });
      }

      const monthData = monthMap.get(monthKey)!;
      monthData.total += record.amount;

      switch (record.status) {
        case 'PAGO':
          monthData.received += record.amount;
          monthData.paymentsCount++;
          break;
        case 'A PAGAR':
          monthData.pending += record.amount;
          break;
        case 'VENCIDO':
          monthData.overdue += record.amount;
          break;
      }
    });

    return Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months
  }, [data]);

  const totalReceived = monthlyData.reduce((sum, month) => sum + month.received, 0);
  const totalPending = monthlyData.reduce((sum, month) => sum + month.pending, 0);
  const totalOverdue = monthlyData.reduce((sum, month) => sum + month.overdue, 0);
  const totalPayments = monthlyData.reduce((sum, month) => sum + month.paymentsCount, 0);

  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];
  const monthlyGrowth = previousMonth && previousMonth.received > 0
    ? ((currentMonth?.received || 0) - previousMonth.received) / previousMonth.received * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido (Total)</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalReceived)}</div>
            <p className="text-xs text-muted-foreground">{totalPayments} pagamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente (Total)</CardTitle>
            <Calendar className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-muted-foreground">A receber</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencido (Total)</CardTitle>
            <Calendar className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{formatCurrency(totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">Em atraso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crescimento Mensal</CardTitle>
            <TrendingUp className={`h-4 w-4 ${monthlyGrowth >= 0 ? 'text-success' : 'text-danger'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlyGrowth >= 0 ? 'text-success' : 'text-danger'}`}>
              {monthlyGrowth >= 0 ? '+' : ''}{monthlyGrowth.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">vs mês anterior</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Monthly Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Recebimentos por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="monthYear" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tickFormatter={(value) => formatCurrency(value)} fontSize={12} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Mês: ${label}`}
                />
                <Bar dataKey="received" fill="hsl(var(--success))" name="Recebido" />
                <Bar dataKey="pending" fill="hsl(var(--warning))" name="Pendente" />
                <Bar dataKey="overdue" fill="hsl(var(--danger))" name="Vencido" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Line Chart - Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendência de Recebimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="monthYear" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tickFormatter={(value) => formatCurrency(value)} fontSize={12} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Mês: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="received" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={3}
                  name="Recebido"
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Total Faturado"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Mês</th>
                  <th className="text-right p-2">Recebido</th>
                  <th className="text-right p-2">Pendente</th>
                  <th className="text-right p-2">Vencido</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Qtd Pagtos</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((month) => (
                  <tr key={month.month} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{month.monthYear}</td>
                    <td className="p-2 text-right text-success font-medium">
                      {formatCurrency(month.received)}
                    </td>
                    <td className="p-2 text-right text-warning font-medium">
                      {formatCurrency(month.pending)}
                    </td>
                    <td className="p-2 text-right text-danger font-medium">
                      {formatCurrency(month.overdue)}
                    </td>
                    <td className="p-2 text-right font-semibold">
                      {formatCurrency(month.total)}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">
                      {month.paymentsCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};