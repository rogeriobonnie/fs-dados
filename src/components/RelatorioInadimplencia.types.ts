import { FinancialRecord } from '@/types/financial';

export type GroupKey = 'VENCIDO' | 'EM_NEGOCIACAO' | 'DISTRATO' | 'A_PAGAR' | 'PAGO';

export interface StudentAggregate {
  name: string;
  consultant: string;
  contractDate: string;
  totalContracted: number;
  totalReceived: number;
  totalOpen: number;
  installmentsPaid: number;
  totalInstallments: number;
  maxDaysOverdue: number;
  worstStatus: GroupKey;
  hasOverdue: boolean;
  hasNegociacao: boolean;
  hasDistrato: boolean;
  records: FinancialRecord[];
}