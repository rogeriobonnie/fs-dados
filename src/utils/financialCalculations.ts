import { FinancialRecord, FinancialSummary, ConsultantSummary } from '../types/financial';

export const calculateFinancialSummary = (data: FinancialRecord[]): FinancialSummary => {
  const totalRevenue = data.reduce((sum, record) => sum + record.amount, 0);
  const totalPaid = data
    .filter(record => record.status === 'PAGO')
    .reduce((sum, record) => sum + record.amount, 0);
  const totalPending = data
    .filter(record => record.status === 'A PAGAR')
    .reduce((sum, record) => sum + record.amount, 0);
  const totalOverdue = data
    .filter(record => record.status === 'VENCIDO')
    .reduce((sum, record) => sum + record.amount, 0);
  
  const uniqueStudents = new Set(data.map(record => record.studentName));
  const totalStudents = uniqueStudents.size;
  
  const paidPercentage = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;
  const overduePercentage = totalRevenue > 0 ? (totalOverdue / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalPaid,
    totalPending,
    totalOverdue,
    totalStudents,
    paidPercentage,
    overduePercentage
  };
};

export const calculateConsultantSummaries = (data: FinancialRecord[]): ConsultantSummary[] => {
  const consultantMap = new Map<string, {
    totalSales: number;
    totalReceived: number;
    pendingAmount: number;
    students: Set<string>;
  }>();

  data.forEach(record => {
    const consultant = record.consultant || 'SEM CONSULTOR';
    
    if (!consultantMap.has(consultant)) {
      consultantMap.set(consultant, {
        totalSales: 0,
        totalReceived: 0,
        pendingAmount: 0,
        students: new Set()
      });
    }

    const consultantData = consultantMap.get(consultant)!;
    consultantData.totalSales += record.amount;
    consultantData.students.add(record.studentName);

    if (record.status === 'PAGO') {
      consultantData.totalReceived += record.amount;
    } else {
      consultantData.pendingAmount += record.amount;
    }
  });

  return Array.from(consultantMap.entries()).map(([name, data]) => ({
    name,
    totalSales: data.totalSales,
    totalReceived: data.totalReceived,
    pendingAmount: data.pendingAmount,
    studentsCount: data.students.size
  }));
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};