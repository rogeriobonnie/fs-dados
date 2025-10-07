import { useState, useMemo } from 'react';
import { FinancialRecord } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { StudentDetailModal } from '@/components/StudentDetailModal';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatDateBR } from '@/utils/dateUtils';
import { User, Search, Eye, CheckCircle, Clock, AlertTriangle, TrendingUp, Calendar, Percent, DollarSign } from 'lucide-react';

interface StudentsDirectoryProps {
  data: FinancialRecord[];
}

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
  totalFees: number;
  totalInterest: number;
  records: FinancialRecord[];
}

export const StudentsDirectory = ({ data }: StudentsDirectoryProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'status' | 'dueDate'>('status');

  const currentDate = new Date();
  const saoPauloTime = new Date(currentDate.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));

  const students = useMemo(() => {
    const studentMap = new Map<string, StudentInfo>();

    data.forEach(record => {
      if (!studentMap.has(record.studentName)) {
        studentMap.set(record.studentName, {
          name: record.studentName,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0,
          paidPercentage: 0,
          status: 'current',
          installmentsPaid: 0,
          totalInstallments: 0,
          nextDueDate: undefined,
          lastPaymentDate: undefined,
          daysOverdue: 0,
          consultant: record.consultant || 'Venda Direta',
          contractDate: record.contractDate,
          totalFees: 0,
          totalInterest: 0,
          records: []
        });
      }

      const student = studentMap.get(record.studentName)!;
      student.records.push(record);
      student.totalAmount += record.amount;
      student.totalInstallments++;

      // Aggregate fees and interest
      if (record.fees) {
        student.totalFees += record.fees;
      }
      if (record.interest) {
        student.totalInterest += record.interest;
      }

      if (record.status === 'PAGO') {
        student.paidAmount += record.amount;
        student.installmentsPaid++;
        if (!student.lastPaymentDate || (record.paymentDate && record.paymentDate > student.lastPaymentDate)) {
          student.lastPaymentDate = record.paymentDate;
        }
      } else if (record.status === 'VENCIDO') {
        student.overdueAmount += record.amount;
        const dueDate = new Date(record.dueDate);
        const daysDiff = Math.floor((saoPauloTime.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        student.daysOverdue = Math.max(student.daysOverdue, daysDiff);
      } else {
        student.pendingAmount += record.amount;
      }
    });

    // Calculate derived values and find next due date
    Array.from(studentMap.values()).forEach(student => {
      student.paidPercentage = student.totalAmount > 0 ? (student.paidAmount / student.totalAmount) * 100 : 0;
      
      // Determine status
      if (student.paidPercentage === 100) {
        student.status = 'completed';
      } else if (student.overdueAmount > 0) {
        student.status = 'overdue';
      } else {
        student.status = 'current';
      }

      // Find next due date
      const pendingRecords = student.records.filter(r => r.status !== 'PAGO');
      if (pendingRecords.length > 0) {
        const sortedPending = pendingRecords.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        student.nextDueDate = sortedPending[0].dueDate;
      }
    });

    return Array.from(studentMap.values());
  }, [data, saoPauloTime]);

  const filteredStudents = useMemo(() => {
    let filtered = students.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort students
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'total':
          return b.totalAmount - a.totalAmount;
        case 'status':
          const statusOrder = { 'overdue': 0, 'current': 1, 'completed': 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        case 'dueDate':
          if (!a.nextDueDate && !b.nextDueDate) return 0;
          if (!a.nextDueDate) return 1;
          if (!b.nextDueDate) return -1;
          return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [students, searchTerm, sortBy]);

  const getStatusIcon = (status: StudentInfo['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-danger" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getStatusBadge = (student: StudentInfo) => {
    switch (student.status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground">Concluído</Badge>;
      case 'overdue':
        return <Badge className="bg-danger text-danger-foreground">{student.daysOverdue} dias atraso</Badge>;
      default:
        return <Badge className="bg-warning text-warning-foreground">Em andamento</Badge>;
    }
  };

  const stats = useMemo(() => {
    const completed = students.filter(s => s.status === 'completed').length;
    const overdue = students.filter(s => s.status === 'overdue').length;
    const current = students.filter(s => s.status === 'current').length;
    const totalStudents = students.length;

    return { completed, overdue, current, totalStudents };
  }, [students]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Alunos</CardTitle>
            <User className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalStudents > 0 ? ((stats.completed / stats.totalStudents) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.current}</div>
            <p className="text-xs text-muted-foreground">Pagamentos pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
            <AlertTriangle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Requer atenção urgente</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={sortBy === 'name' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('name')}
          >
            Nome
          </Button>
          <Button
            variant={sortBy === 'total' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('total')}
          >
            Valor Total
          </Button>
          <Button
            variant={sortBy === 'status' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('status')}
          >
            Status
          </Button>
          <Button
            variant={sortBy === 'dueDate' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('dueDate')}
          >
            Próximo Venc.
          </Button>
        </div>
      </div>

      {/* Students Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map((student) => (
          <Card key={student.name} className={`transition-all duration-200 hover:shadow-lg cursor-pointer ${
            student.status === 'overdue' ? 'border-danger/30 bg-danger/5' :
            student.status === 'completed' ? 'border-success/30 bg-success/5' :
            'border-warning/30 bg-warning/5'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getStatusIcon(student.status)}
                  <CardTitle className="text-sm font-semibold line-clamp-2 flex-1">
                    {student.name}
                  </CardTitle>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {getStatusBadge(student)}
                  <div className="flex gap-1">
                    {student.totalFees > 0 && (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                        <Percent className="h-3 w-3 mr-1" />
                        Taxa
                      </Badge>
                    )}
                    {student.totalInterest > 0 && (
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                        <DollarSign className="h-3 w-3 mr-1" />
                        Juros
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Progresso</span>
                  <span>{student.paidPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={student.paidPercentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{student.installmentsPaid}/{student.totalInstallments} parcelas</span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-1 text-sm">
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
                {(student.totalFees > 0 || student.totalInterest > 0) && (
                  <div className="pt-1 border-t border-muted">
                    {student.totalFees > 0 && (
                      <div className="flex justify-between">
                        <span className="text-orange-600 flex items-center">
                          <Percent className="h-3 w-3 mr-1" />
                          Taxas:
                        </span>
                        <span className="text-orange-600 font-medium">-{formatCurrency(student.totalFees)}</span>
                      </div>
                    )}
                    {student.totalInterest > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-600 flex items-center">
                          <DollarSign className="h-3 w-3 mr-1" />
                          Juros:
                        </span>
                        <span className="text-red-600 font-medium">+{formatCurrency(student.totalInterest)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <Button 
                className="w-full" 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedStudent(student)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalhes
              </Button>

              {/* Meta Info */}
              <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <span>Consultor:</span>
                  <span className="font-medium">{student.consultant}</span>
                </div>
                {student.nextDueDate && student.status !== 'completed' && (
                  <div className="flex items-center justify-between">
                    <span>Próximo venc.:</span>
                    <span className="font-medium">
                      {formatDateBR(student.nextDueDate)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {filteredStudents.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum aluno encontrado</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Tente ajustar sua busca.' : 'Nenhum dado disponível.'}
          </p>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};