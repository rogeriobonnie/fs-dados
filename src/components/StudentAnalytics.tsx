import { useMemo } from 'react';
import { FinancialRecord } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/utils/financialCalculations';
import { User, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface StudentAnalyticsProps {
  data: FinancialRecord[];
}

interface StudentSummary {
  name: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  paidPercentage: number;
  status: 'completed' | 'current' | 'overdue';
  installmentsPaid: number;
  totalInstallments: number;
  nextDueDate?: string;
  daysOverdue: number;
}

export const StudentAnalytics = ({ data }: StudentAnalyticsProps) => {
  const currentDate = new Date();
  const saoPauloTime = new Date(currentDate.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));

  const studentSummaries = useMemo(() => {
    const studentMap = new Map<string, {
      records: FinancialRecord[];
      totalAmount: number;
      paidAmount: number;
      pendingAmount: number;
      overdueAmount: number;
    }>();

    // Group by student
    data.forEach(record => {
      if (!studentMap.has(record.studentName)) {
        studentMap.set(record.studentName, {
          records: [],
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0
        });
      }

      const student = studentMap.get(record.studentName)!;
      student.records.push(record);
      student.totalAmount += record.amount;

      if (record.status === 'PAGO') {
        student.paidAmount += record.amount;
      } else if (record.status === 'VENCIDO') {
        student.overdueAmount += record.amount;
      } else {
        student.pendingAmount += record.amount;
      }
    });

    // Convert to StudentSummary array
    return Array.from(studentMap.entries()).map(([name, data]): StudentSummary => {
      const paidPercentage = data.totalAmount > 0 ? (data.paidAmount / data.totalAmount) * 100 : 0;
      
      // Calculate installments
      const installmentsPaid = data.records.filter(r => r.status === 'PAGO').length;
      const totalInstallments = data.records.length;
      
      // Find next due date and calculate days overdue
      const pendingRecords = data.records.filter(r => r.status !== 'PAGO');
      const nextDueDate = pendingRecords.length > 0 
        ? pendingRecords.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0].dueDate
        : undefined;
      
      // Calculate maximum days overdue
      const overdueRecords = data.records.filter(r => r.status === 'VENCIDO');
      const daysOverdue = overdueRecords.length > 0 
        ? Math.max(...overdueRecords.map(r => {
            const dueDate = new Date(r.dueDate);
            return Math.floor((saoPauloTime.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          }))
        : 0;

      // Determine status
      let status: 'completed' | 'current' | 'overdue' = 'current';
      if (paidPercentage === 100) {
        status = 'completed';
      } else if (data.overdueAmount > 0) {
        status = 'overdue';
      }

      return {
        name,
        totalAmount: data.totalAmount,
        paidAmount: data.paidAmount,
        pendingAmount: data.pendingAmount,
        overdueAmount: data.overdueAmount,
        paidPercentage,
        status,
        installmentsPaid,
        totalInstallments,
        nextDueDate,
        daysOverdue
      };
    }).sort((a, b) => {
      // Sort by status (overdue first, then current, then completed)
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      return b.totalAmount - a.totalAmount; // Then by total amount desc
    });
  }, [data, saoPauloTime]);

  const getStatusBadge = (student: StudentSummary) => {
    switch (student.status) {
      case 'completed':
        return (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle className="h-3 w-3 mr-1" />
            Concluído
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-danger text-danger-foreground">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {student.daysOverdue} dias atraso
          </Badge>
        );
      default:
        return (
          <Badge className="bg-warning text-warning-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Em andamento
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {studentSummaries.map((student) => (
          <Card key={student.name} className={`transition-all duration-200 hover:shadow-lg ${
            student.status === 'overdue' ? 'border-danger/30 bg-danger/5' :
            student.status === 'completed' ? 'border-success/30 bg-success/5' :
            'border-warning/30 bg-warning/5'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold line-clamp-2">
                    {student.name}
                  </CardTitle>
                </div>
                {getStatusBadge(student)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Progresso</span>
                  <span>{student.paidPercentage.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={student.paidPercentage} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{student.installmentsPaid}/{student.totalInstallments} parcelas</span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">{formatCurrency(student.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-success">Pago:</span>
                  <span className="text-success font-medium">{formatCurrency(student.paidAmount)}</span>
                </div>
                {student.pendingAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-warning">Pendente:</span>
                    <span className="text-warning font-medium">{formatCurrency(student.pendingAmount)}</span>
                  </div>
                )}
                {student.overdueAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-danger">Vencido:</span>
                    <span className="text-danger font-medium">{formatCurrency(student.overdueAmount)}</span>
                  </div>
                )}
              </div>

              {/* Next Due Date */}
              {student.nextDueDate && student.status !== 'completed' && (
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <span>Próximo venc.: </span>
                  <span className="font-medium">
                    {new Date(student.nextDueDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};