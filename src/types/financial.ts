export interface FinancialRecord {
  id: string;
  consultant: string;
  contractDate: string;
  studentName: string;
  specialCondition?: string; // Condição especial (bolsa/desconto)
  paymentMethod?: string; // Forma de pagamento
  installment: string;
  dueDate: string;
  amount: number;
  fees?: number; // Taxas que descontam
  interest?: number; // Juros que aumentam
  paymentDate?: string;
  status: 'PAGO' | 'A PAGAR' | 'VENCIDO';
  invoice?: string;
  contractObservation?: string; // Observação do contrato
  scholarshipStudent?: boolean; // Derivado da condição especial
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