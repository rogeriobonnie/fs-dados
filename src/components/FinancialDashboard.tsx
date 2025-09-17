import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FinancialSummary, ConsultantSummary } from '@/types/financial';
import { formatCurrency } from '@/utils/financialCalculations';
import { TrendingUp, TrendingDown, Users, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';

interface FinancialDashboardProps {
  summary: FinancialSummary;
  consultantSummaries: ConsultantSummary[];
}

export const FinancialDashboard = ({ summary, consultantSummaries }: FinancialDashboardProps) => {
  return (
    <div className="space-y-6">
      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Total de vendas realizadas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valores Recebidos</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(summary.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">
              {summary.paidPercentage.toFixed(1)}% do total
            </p>
            <Progress value={summary.paidPercentage} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valores Pendentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{formatCurrency(summary.totalPending)}</div>
            <p className="text-xs text-muted-foreground">A receber futuramente</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-danger/10 to-danger/5 border-danger/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valores Vencidos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{formatCurrency(summary.totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">
              {summary.overduePercentage.toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Total de Alunos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.totalStudents}</div>
            <p className="text-sm text-muted-foreground">Alunos únicos cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance dos Consultores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {consultantSummaries.slice(0, 3).map((consultant, index) => (
              <div key={consultant.name} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {consultant.name === 'SEM CONSULTOR' ? 'Vendas Diretas' : consultant.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {consultant.studentsCount} alunos
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatCurrency(consultant.totalSales)}</p>
                  <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                    {index === 0 ? "Top" : `#${index + 1}`}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};