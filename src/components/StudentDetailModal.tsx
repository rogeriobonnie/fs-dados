import { FinancialRecord } from '@/types/financial';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatDateBR } from '@/utils/dateUtils';
import { X, User, Calendar, DollarSign, FileText, Clock, CheckCircle, AlertTriangle, TrendingUp, CreditCard } from 'lucide-react';

interface StudentInfo {
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
  lastPaymentDate?: string;
  daysOverdue: number;
  consultant: string;
  contractDate: string;
  records: FinancialRecord[];
}

interface StudentDetailModalProps {
  student: StudentInfo;
  isOpen: boolean;
  onClose: () => void;
}

export const StudentDetailModal = ({ student, isOpen, onClose }: StudentDetailModalProps) => {
  const getStatusIcon = (status: FinancialRecord['status']) => {
    switch (status) {
      case 'PAGO':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'VENCIDO':
        return <AlertTriangle className="h-4 w-4 text-danger" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getStatusBadge = (status: FinancialRecord['status']) => {
    switch (status) {
      case 'PAGO':
        return <Badge className="bg-success text-success-foreground">Pago</Badge>;
      case 'VENCIDO':
        return <Badge className="bg-danger text-danger-foreground">Vencido</Badge>;
      default:
        return <Badge className="bg-warning text-warning-foreground">Pendente</Badge>;
    }
  };

  const sortedRecords = [...student.records].sort((a, b) => {
    // Sort by due date
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const paidRecords = sortedRecords.filter(r => r.status === 'PAGO');
  const pendingRecords = sortedRecords.filter(r => r.status !== 'PAGO');

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {student.name}
            </DialogTitle>
            <DialogClose asChild>
              <button className="p-2 hover:bg-muted rounded-md">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(student.totalAmount)}</div>
                <p className="text-xs text-muted-foreground">{student.totalInstallments} parcelas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Já Pago</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(student.paidAmount)}</div>
                <p className="text-xs text-muted-foreground">{student.installmentsPaid} parcelas pagas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Aberto</CardTitle>
                <Clock className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {formatCurrency(student.pendingAmount + student.overdueAmount)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {student.totalInstallments - student.installmentsPaid} parcelas restantes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Progress Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progresso do Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso Total</span>
                  <span className="font-semibold">{student.paidPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={student.paidPercentage} className="h-3" />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-success">{student.installmentsPaid}</div>
                  <div className="text-muted-foreground">Pagas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-warning">
                    {sortedRecords.filter(r => r.status === 'A PAGAR').length}
                  </div>
                  <div className="text-muted-foreground">Pendentes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-danger">
                    {sortedRecords.filter(r => r.status === 'VENCIDO').length}
                  </div>
                  <div className="text-muted-foreground">Vencidas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{student.totalInstallments}</div>
                  <div className="text-muted-foreground">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nome:</span>
                    <span className="font-medium">{student.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consultor:</span>
                    <span className="font-medium">{student.consultant}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data do Contrato:</span>
                    <span className="font-medium">
                      {formatDateBR(student.contractDate)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {student.lastPaymentDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Último Pagamento:</span>
                      <span className="font-medium text-success">
                        {formatDateBR(student.lastPaymentDate)}
                      </span>
                    </div>
                  )}
                  {student.nextDueDate && student.status !== 'completed' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Próximo Vencimento:</span>
                      <span className="font-medium text-warning">
                        {formatDateBR(student.nextDueDate)}
                      </span>
                    </div>
                  )}
                  {student.daysOverdue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dias em Atraso:</span>
                      <span className="font-medium text-danger">{student.daysOverdue} dias</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Histórico de Pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Paid Records */}
                {paidRecords.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-success mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Parcelas Pagas ({paidRecords.length})
                    </h4>
                    <div className="space-y-2">
                      {paidRecords.map((record, index) => (
                        <div key={`paid-${index}`} className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-4 w-4 text-success" />
                            <div>
                              <div className="font-medium">{record.installment}</div>
                              <div className="text-sm text-muted-foreground">
                                Venc: {formatDateBR(record.dueDate)}
                                {record.paymentDate && (
                                  <span className="ml-2">
                                    • Pago: {formatDateBR(record.paymentDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-success">{formatCurrency(record.amount)}</div>
                            {record.invoice && (
                              <div className="text-xs text-muted-foreground">NF: {record.invoice}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending/Overdue Records */}
                {pendingRecords.length > 0 && (
                  <div>
                    <Separator className="my-4" />
                    <h4 className="font-semibold text-warning mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Parcelas Pendentes ({pendingRecords.length})
                    </h4>
                    <div className="space-y-2">
                      {pendingRecords.map((record, index) => (
                        <div key={`pending-${index}`} className={`flex items-center justify-between p-3 rounded-lg border ${
                          record.status === 'VENCIDO' 
                            ? 'bg-danger/5 border-danger/20' 
                            : 'bg-warning/5 border-warning/20'
                        }`}>
                          <div className="flex items-center gap-3">
                            {getStatusIcon(record.status)}
                            <div>
                              <div className="font-medium">{record.installment}</div>
                              <div className="text-sm text-muted-foreground">
                                Venc: {formatDateBR(record.dueDate)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${
                              record.status === 'VENCIDO' ? 'text-danger' : 'text-warning'
                            }`}>
                              {formatCurrency(record.amount)}
                            </div>
                            {getStatusBadge(record.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};