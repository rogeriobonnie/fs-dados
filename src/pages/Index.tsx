import { useState, useMemo } from 'react';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import { FinancialFilters, FilterState } from '@/components/FinancialFilters';
import { FinancialTable } from '@/components/FinancialTable';
import { FinancialCharts } from '@/components/FinancialCharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { financialData } from '@/data/financialData';
import { calculateFinancialSummary, calculateConsultantSummaries } from '@/utils/financialCalculations';
import { BarChart3, Table2, PieChart } from 'lucide-react';

const Index = () => {
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    consultant: '',
    studentName: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: ''
  });

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    return financialData.filter(record => {
      if (filters.status && record.status !== filters.status) return false;
      if (filters.consultant && record.consultant !== filters.consultant) return false;
      if (filters.studentName && !record.studentName.toLowerCase().includes(filters.studentName.toLowerCase())) return false;
      if (filters.dateFrom && record.dueDate < filters.dateFrom) return false;
      if (filters.dateTo && record.dueDate > filters.dateTo) return false;
      if (filters.amountMin && record.amount < parseFloat(filters.amountMin)) return false;
      if (filters.amountMax && record.amount > parseFloat(filters.amountMax)) return false;
      return true;
    });
  }, [filters]);

  const summary = useMemo(() => calculateFinancialSummary(filteredData), [filteredData]);
  const consultantSummaries = useMemo(() => calculateConsultantSummaries(filteredData), [filteredData]);
  const uniqueConsultants = useMemo(() => [...new Set(financialData.map(r => r.consultant))], []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Financeiro</h1>
            <p className="text-muted-foreground">
              Controle completo de vendas, recebimentos e inadimplência
            </p>
          </div>

          {/* Dashboard Overview */}
          <FinancialDashboard summary={summary} consultantSummaries={consultantSummaries} />

          {/* Filters */}
          <FinancialFilters
            filters={filters}
            onFiltersChange={setFilters}
            consultants={uniqueConsultants}
          />

          {/* Tabbed Content */}
          <Tabs defaultValue="table" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="table" className="flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                Tabela de Dados
              </TabsTrigger>
              <TabsTrigger value="charts" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Gráficos
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Análises
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="space-y-6">
              <FinancialTable data={filteredData} />
            </TabsContent>

            <TabsContent value="charts" className="space-y-6">
              <FinancialCharts data={filteredData} />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Análises Avançadas</h3>
                <p className="text-muted-foreground">
                  Funcionalidade em desenvolvimento. Em breve: relatórios de tendências, 
                  previsões e análises comparativas.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
