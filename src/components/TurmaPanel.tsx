import { useState, useMemo } from 'react';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import { FinancialFilters, FilterState } from '@/components/FinancialFilters';
import { FinancialTable } from '@/components/FinancialTable';
import { StudentsDirectory } from '@/components/StudentsDirectory';
import { QuickFilters } from '@/components/QuickFilters';
import { MonthlyRevenue } from '@/components/MonthlyRevenue';
import DistratosNegociacao from '@/components/DistratosNegociacao';
import RelatorioInadimplencia from '@/components/RelatorioInadimplencia';
import ResumoGerencialTurma from '@/components/ResumoGerencialTurma';
import VisaoGeralTurma from '@/components/VisaoGeralTurma';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateFinancialSummary, calculateConsultantSummaries } from '@/utils/financialCalculations';
import { FinancialRecord } from '@/types/financial';
import { Table2, Users, TrendingUp, BarChart3, UserX, AlertTriangle } from 'lucide-react';

interface TurmaPanelProps {
  data: FinancialRecord[];
  showVisaoGeral?: boolean;
}

const initialFilters: FilterState = {
  status: 'all',
  consultant: 'all',
  studentName: '',
  monthFrom: 'all',
  yearFrom: 'all',
  monthTo: 'all',
  yearTo: 'all',
  amountMin: '',
  amountMax: '',
};

const TurmaPanel = ({ data, showVisaoGeral = false }: TurmaPanelProps) => {
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const filteredData = useMemo(() => {
    return data.filter(record => {
      if (filters.status && filters.status !== 'all' && record.status !== filters.status) return false;

      if (filters.consultant && filters.consultant !== 'all') {
        const consultantValue = filters.consultant === 'direct' ? '' : filters.consultant;
        if (record.consultant !== consultantValue) return false;
      }

      if (filters.studentName && !record.studentName.toLowerCase().includes(filters.studentName.toLowerCase())) return false;

      const dueDate = new Date(record.dueDate);

      if (filters.monthFrom && filters.monthFrom !== 'all' && filters.yearFrom && filters.yearFrom !== 'all') {
        const fromDate = new Date(parseInt(filters.yearFrom), parseInt(filters.monthFrom) - 1, 1);
        if (dueDate < fromDate) return false;
      }

      if (filters.monthTo && filters.monthTo !== 'all' && filters.yearTo && filters.yearTo !== 'all') {
        const toDate = new Date(parseInt(filters.yearTo), parseInt(filters.monthTo), 0);
        if (dueDate > toDate) return false;
      }

      if (filters.amountMin && record.amount < parseFloat(filters.amountMin)) return false;
      if (filters.amountMax && record.amount > parseFloat(filters.amountMax)) return false;

      return true;
    });
  }, [data, filters]);

  const mainFilteredData = useMemo(
    () => filteredData.filter(r => !r.isDistrato && r.status !== 'EM NEGOCIACAO'),
    [filteredData],
  );

  const summary = useMemo(() => calculateFinancialSummary(mainFilteredData), [mainFilteredData]);
  const consultantSummaries = useMemo(() => calculateConsultantSummaries(mainFilteredData), [mainFilteredData]);
  const uniqueConsultants = useMemo(() => [...new Set(data.map(r => r.consultant))], [data]);

  const defaultTab = showVisaoGeral ? 'visao-geral' : 'resumo';

  return (
    <div className="space-y-6">
      <FinancialDashboard summary={summary} consultantSummaries={consultantSummaries} />

      <QuickFilters
        filters={filters}
        onFiltersChange={setFilters}
        totalRecords={filteredData.length}
      />

      <FinancialFilters
        filters={filters}
        onFiltersChange={setFilters}
        consultants={uniqueConsultants}
      />

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className={`grid w-full ${showVisaoGeral ? 'grid-cols-7' : 'grid-cols-6'} text-xs`}>
          {showVisaoGeral && (
            <TabsTrigger value="visao-geral" className="flex items-center gap-1 px-2">
              <TrendingUp className="h-3 w-3" />
              Visão Geral
            </TabsTrigger>
          )}
          <TabsTrigger value="resumo" className="flex items-center gap-1 px-2">
            <BarChart3 className="h-3 w-3" />
            Resumo Gerencial
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-1 px-2">
            <Users className="h-3 w-3" />
            Alunos
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center gap-1 px-2">
            <TrendingUp className="h-3 w-3" />
            Mensal
          </TabsTrigger>
          <TabsTrigger value="table" className="flex items-center gap-1 px-2">
            <Table2 className="h-3 w-3" />
            Tabela
          </TabsTrigger>
          <TabsTrigger value="inadimplencia" className="flex items-center gap-1 px-2">
            <AlertTriangle className="h-3 w-3" />
            Inadimplência
          </TabsTrigger>
          <TabsTrigger value="distratos" className="flex items-center gap-1 px-2">
            <UserX className="h-3 w-3" />
            Distratos
          </TabsTrigger>
        </TabsList>

        {showVisaoGeral && (
          <TabsContent value="visao-geral" className="space-y-6">
            <VisaoGeralTurma data={filteredData} />
          </TabsContent>
        )}

        <TabsContent value="resumo" className="space-y-6">
          <ResumoGerencialTurma data={filteredData} />
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <StudentsDirectory data={mainFilteredData} />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <MonthlyRevenue data={mainFilteredData} />
        </TabsContent>

        <TabsContent value="table" className="space-y-6">
          <FinancialTable data={mainFilteredData} />
        </TabsContent>

        <TabsContent value="inadimplencia" className="space-y-6">
          <RelatorioInadimplencia data={filteredData} />
        </TabsContent>

        <TabsContent value="distratos" className="space-y-6">
          <DistratosNegociacao data={filteredData} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TurmaPanel;
