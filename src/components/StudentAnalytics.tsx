import { useState, useMemo } from 'react';
import { FinancialRecord } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatDateShort } from '@/utils/dateUtils';
import { User, CheckCircle, Clock, AlertTriangle, Eye, Search, Filter, Users } from 'lucide-react';

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
  lastPaymentDate?: string;
  daysOverdue: number;
  consultant: string;
  contractDate: string;
}

export const StudentAnalytics = ({ data }: StudentAnalyticsProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showOverdue, setShowOverdue] = useState(true);

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

      // Find last payment date
      const paidRecords = data.records.filter(r => r.status === 'PAGO' && r.paymentDate);
      const lastPaymentDate = paidRecords.length > 0 
        ? paidRecords.sort((a, b) => new Date(b.paymentDate!).getTime() - new Date(a.paymentDate!).getTime())[0].paymentDate
        : undefined;

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
        lastPaymentDate,
        daysOverdue,
        consultant: data.records[0]?.consultant || 'Venda Direta',
        contractDate: data.records[0]?.contractDate || ''
      };
    }).sort((a, b) => {
      // Sort by status (overdue first, then current, then completed)
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      // If both are overdue, sort by days overdue (descending - maior para menor)
      if (a.status === 'overdue' && b.status === 'overdue') {
        return b.daysOverdue - a.daysOverdue;
      }
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      return b.totalAmount - a.totalAmount; // Then by total amount desc
    });
  }, [data, saoPauloTime]);

  const filteredStudents = useMemo(() => {
    return studentSummaries.filter(student => {
      // Filter by search term
      if (searchTerm && !student.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filter by status visibility
      if (student.status === 'completed' && !showCompleted) return false;
      if (student.status === 'current' && !showCurrent) return false;
      if (student.status === 'overdue' && !showOverdue) return false;
      
      return true;
    });
  }, [studentSummaries, searchTerm, showCompleted, showCurrent, showOverdue]);

  const stats = useMemo(() => {
    const completed = studentSummaries.filter(s => s.status === 'completed').length;
    const overdue = studentSummaries.filter(s => s.status === 'overdue').length;
    const current = studentSummaries.filter(s => s.status === 'current').length;
    const total = studentSummaries.length;

    return { completed, overdue, current, total };
  }, [studentSummaries]);

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alunos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">100% pagos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.current}</div>
            <p className="text-xs text-muted-foreground">Pagando</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
            <AlertTriangle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Atrasados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Visualização
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showOverdue ? "destructive" : "outline"}
                size="sm"
                onClick={() => setShowOverdue(!showOverdue)}
                className="flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Em Atraso ({stats.overdue})
              </Button>
              <Button
                variant={showCurrent ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowCurrent(!showCurrent)}
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Em Andamento ({stats.current})
              </Button>
              <Button
                variant={showCompleted ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Concluídos ({stats.completed})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Mostrando {filteredStudents.length} de {stats.total} alunos
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Alunos</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum aluno encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Tente ajustar sua busca ou filtros.' : 'Nenhum aluno atende aos filtros selecionados.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => (
                <div 
                  key={student.name} 
                  className={`p-4 rounded-lg border transition-all hover:shadow-md ${
                    student.status === 'overdue' ? 'border-danger/30 bg-danger/5' :
                    student.status === 'completed' ? 'border-success/30 bg-success/5' :
                    'border-warning/30 bg-warning/5'
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* Student Info */}
                    <div className="lg:col-span-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {student.status === 'completed' && <CheckCircle className="h-4 w-4 text-success" />}
                          {student.status === 'overdue' && <AlertTriangle className="h-4 w-4 text-danger" />}
                          {student.status === 'current' && <Clock className="h-4 w-4 text-warning" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm line-clamp-1">{student.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {student.consultant || 'Venda Direta'}
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          {student.status === 'completed' && (
                            <Badge className="bg-success text-success-foreground text-xs">Concluído</Badge>
                          )}
                          {student.status === 'overdue' && (
                            <Badge className="bg-danger text-danger-foreground text-xs">
                              {student.daysOverdue}d atraso
                            </Badge>
                          )}
                          {student.status === 'current' && (
                            <Badge className="bg-warning text-warning-foreground text-xs">Andamento</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="lg:col-span-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Progresso</span>
                          <span className="font-semibold">{student.paidPercentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={student.paidPercentage} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {student.installmentsPaid}/{student.totalInstallments} parcelas
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="lg:col-span-4">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-semibold">{formatCurrency(student.totalAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-success">Pago:</span>
                            <span className="text-success font-medium">{formatCurrency(student.paidAmount)}</span>
                          </div>
                        </div>
                        <div className="space-y-1">
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
                          {student.nextDueDate && student.status !== 'completed' && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Próximo:</span>
                              <span className="font-medium text-xs">
                                {formatDateShort(student.nextDueDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="lg:col-span-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="w-full"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};