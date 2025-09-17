import { useState, useMemo, useEffect } from 'react';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import { FinancialFilters, FilterState } from '@/components/FinancialFilters';
import { FinancialTable } from '@/components/FinancialTable';
import { FinancialCharts } from '@/components/FinancialCharts';
import { QuickFilters } from '@/components/QuickFilters';
import { StudentAnalytics } from '@/components/StudentAnalytics';
import { MonthlyRevenue } from '@/components/MonthlyRevenue';
import { ImplementationGuide } from '@/components/ImplementationGuide';
import { GoogleSheetsConfig } from '@/components/GoogleSheetsConfig';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { financialData } from '@/data/financialData';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { calculateFinancialSummary, calculateConsultantSummaries } from '@/utils/financialCalculations';
import { FinancialRecord } from '@/types/financial';
import { BarChart3, Table2, PieChart, Settings, RefreshCw, Users, TrendingUp } from 'lucide-react';

const Index = () => {
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    consultant: 'all',
    studentName: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: ''
  });

  const [data, setData] = useState<FinancialRecord[]>(financialData);
  const [isConnectedToSheets, setIsConnectedToSheets] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await GoogleSheetsService.testConnection();
      setIsConnectedToSheets(connected);
      if (connected) {
        loadDataFromSheets();
      }
    };
    checkConnection();
  }, []);

  const loadDataFromSheets = async () => {
    setIsLoading(true);
    try {
      const sheetData = await GoogleSheetsService.fetchSheetData();
      setData(sheetData);
      toast({
        title: "Dados atualizados!",
        description: `${sheetData.length} registros carregados da planilha`,
      });
    } catch (error) {
      console.error('Error loading data from sheets:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Falha ao conectar com a planilha. Usando dados locais.",
        variant: "destructive",
      });
      setData(financialData); // Fallback to local data
    } finally {
      setIsLoading(false);
    }
  };

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    return data.filter(record => {
      if (filters.status && filters.status !== 'all' && record.status !== filters.status) return false;
      if (filters.consultant && filters.consultant !== 'all') {
        const consultantValue = filters.consultant === 'direct' ? '' : filters.consultant;
        if (record.consultant !== consultantValue) return false;
      }
      if (filters.studentName && !record.studentName.toLowerCase().includes(filters.studentName.toLowerCase())) return false;
      if (filters.dateFrom && record.dueDate < filters.dateFrom) return false;
      if (filters.dateTo && record.dueDate > filters.dateTo) return false;
      if (filters.amountMin && record.amount < parseFloat(filters.amountMin)) return false;
      if (filters.amountMax && record.amount > parseFloat(filters.amountMax)) return false;
      return true;
    });
  }, [data, filters]);

  const summary = useMemo(() => calculateFinancialSummary(filteredData), [filteredData]);
  const consultantSummaries = useMemo(() => calculateConsultantSummaries(filteredData), [filteredData]);
  const uniqueConsultants = useMemo(() => [...new Set(data.map(r => r.consultant))], [data]);

  const handleConnectionChange = (connected: boolean) => {
    setIsConnectedToSheets(connected);
    if (connected) {
      loadDataFromSheets();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Dashboard Financeiro</h1>
              <p className="text-muted-foreground">
                Controle completo de vendas, recebimentos e inadimplência
                {isConnectedToSheets && (
                  <span className="ml-2 text-success">• Conectado ao Google Sheets</span>
                )}
              </p>
            </div>
            
            {isConnectedToSheets && (
              <Button 
                onClick={loadDataFromSheets} 
                disabled={isLoading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Atualizando...' : 'Atualizar Dados'}
              </Button>
            )}
          </div>

          {/* Dashboard Overview */}
          <FinancialDashboard summary={summary} consultantSummaries={consultantSummaries} />

          {/* Quick Filters */}
          <QuickFilters
            filters={filters}
            onFiltersChange={setFilters}
            totalRecords={filteredData.length}
          />

          {/* Advanced Filters */}
          <FinancialFilters
            filters={filters}
            onFiltersChange={setFilters}
            consultants={uniqueConsultants}
          />

          {/* Tabbed Content */}
          <Tabs defaultValue="table" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="table" className="flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                Tabela
              </TabsTrigger>
              <TabsTrigger value="charts" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Gráficos
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Por Aluno
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Mensal
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Análises
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Config
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="space-y-6">
              <FinancialTable data={filteredData} />
            </TabsContent>

            <TabsContent value="charts" className="space-y-6">
              <FinancialCharts data={filteredData} />
            </TabsContent>

            <TabsContent value="students" className="space-y-6">
              <StudentAnalytics data={filteredData} />
            </TabsContent>

            <TabsContent value="monthly" className="space-y-6">
              <MonthlyRevenue data={filteredData} />
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

            <TabsContent value="config" className="space-y-6">
              <GoogleSheetsConfig onConnectionChange={handleConnectionChange} />
              <ImplementationGuide />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
