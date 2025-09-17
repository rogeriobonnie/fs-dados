import { FinancialRecord } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface FinancialChartsProps {
  data: FinancialRecord[];
}

export const FinancialCharts = ({ data }: FinancialChartsProps) => {
  // Status distribution for pie chart
  const statusData = [
    {
      name: 'Pago',
      value: data.filter(r => r.status === 'PAGO').reduce((sum, r) => sum + r.amount, 0),
      count: data.filter(r => r.status === 'PAGO').length,
      color: 'hsl(var(--success))'
    },
    {
      name: 'A Pagar',
      value: data.filter(r => r.status === 'A PAGAR').reduce((sum, r) => sum + r.amount, 0),
      count: data.filter(r => r.status === 'A PAGAR').length,
      color: 'hsl(var(--warning))'
    },
    {
      name: 'Vencido',
      value: data.filter(r => r.status === 'VENCIDO').reduce((sum, r) => sum + r.amount, 0),
      count: data.filter(r => r.status === 'VENCIDO').length,
      color: 'hsl(var(--danger))'
    }
  ].filter(item => item.value > 0);

  // Monthly revenue data
  const monthlyData = data.reduce((acc, record) => {
    const date = new Date(record.dueDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: monthKey,
        pago: 0,
        pendente: 0,
        vencido: 0
      };
    }
    
    switch (record.status) {
      case 'PAGO':
        acc[monthKey].pago += record.amount;
        break;
      case 'A PAGAR':
        acc[monthKey].pendente += record.amount;
        break;
      case 'VENCIDO':
        acc[monthKey].vencido += record.amount;
        break;
    }
    
    return acc;
  }, {} as Record<string, any>);

  const monthlyChartData = Object.values(monthlyData).slice(-6); // Last 6 months

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                dataKey="value"
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolução Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tickFormatter={(value) => {
                  const [year, month] = value.split('-');
                  return `${month}/${year.slice(-2)}`;
                }}
              />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="pago" fill="hsl(var(--success))" name="Pago" />
              <Bar dataKey="pendente" fill="hsl(var(--warning))" name="Pendente" />
              <Bar dataKey="vencido" fill="hsl(var(--danger))" name="Vencido" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};