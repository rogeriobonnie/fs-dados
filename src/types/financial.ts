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
  scholarshipStudent?: boolean; // Bolsa de estudo
  fees?: number; // Taxas que descontam
  interest?: number; // Juros que aumentam
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
  commission: number; // 3% do total recebido
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalReceived: number;
  consultantCommissions: ConsultantCommission[];
}

export interface ConsultantCommission {
  consultant: string;
  totalReceived: number;
  commission: number;
}