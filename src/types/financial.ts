export interface FinancialRecord {
  id: string;
  consultant: string;
  contractDate: string;
  studentName: string;
  installment: string;
  dueDate: string;
  amount: number;
  paymentDate?: string;
  status: 'PAGO' | 'A PAGAR' | 'VENCIDO';
  invoice?: string;
  contract?: string;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  totalStudents: number;
  paidPercentage: number;
  overduePercentage: number;
}

export interface ConsultantSummary {
  name: string;
  totalSales: number;
  totalReceived: number;
  pendingAmount: number;
  studentsCount: number;
}