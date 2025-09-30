import { useState, useMemo, useEffect } from 'react';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import { FinancialFilters, FilterState } from '@/components/FinancialFilters';
import { FinancialTable } from '@/components/FinancialTable';
import { StudentsDirectory } from '@/components/StudentsDirectory';
import { QuickFilters } from '@/components/QuickFilters';
import { MonthlyRevenue } from '@/components/MonthlyRevenue';
import { MonthlyCommissionReport } from '@/components/MonthlyCommissionReport';
import FinancialDRE from '@/components/FinancialDRE';
import CashFlow from '@/components/CashFlow';
import Comissoes from '@/components/Comissoes';
import { PinAuth } from '@/components/PinAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { financialData } from '@/data/financialData';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { calculateFinancialSummary, calculateConsultantSummaries } from '@/utils/financialCalculations';
import { FinancialRecord } from '@/types/financial';
import { Table2, Users, TrendingUp, RefreshCw, LogOut, DollarSign, BarChart3 } from 'lucide-react';

const Index = () => {
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    consultant: 'all',
    studentName: '',
    monthFrom: 'all',
    yearFrom: 'all',
    monthTo: 'all',
    yearTo: 'all',
    amountMin: '',
    amountMax: ''
  });

  const [data, setData] = useState<FinancialRecord[]>(financialData);
  const [isConnectedToSheets, setIsConnectedToSheets] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  // Check authentication on mount
  useEffect(() => {
    const isAuth = localStorage.getItem('financial_dashboard_auth') === 'true';
    setIsAuthenticated(isAuth);
  }, []);

  // Check connection on mount (only if authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const checkConnection = async () => {
      const connected = await GoogleSheetsService.testConnection();
      setIsConnectedToSheets(connected);
      if (connected) {
        loadDataFromSheets();
      }
    };
    checkConnection();
  }, [isAuthenticated]);

  // Handle authentication change
  const handleAuthenticated = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };

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
      // Status filter
      if (filters.status && filters.status !== 'all' && record.status !== filters.status) return false;
      
      // Consultant filter
      if (filters.consultant && filters.consultant !== 'all') {
        const consultantValue = filters.consultant === 'direct' ? '' : filters.consultant;
        if (record.consultant !== consultantValue) return false;
      }
      
      // Student name filter
      if (filters.studentName && !record.studentName.toLowerCase().includes(filters.studentName.toLowerCase())) return false;
      
      // Date range filter
      const dueDate = new Date(record.dueDate);
      const dueMonth = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dueYear = dueDate.getFullYear().toString();
      
      // From date filter
      if (filters.monthFrom && filters.monthFrom !== 'all' && filters.yearFrom && filters.yearFrom !== 'all') {
        const fromDate = new Date(parseInt(filters.yearFrom), parseInt(filters.monthFrom) - 1, 1);
        if (dueDate < fromDate) return false;
      }
      
      // To date filter
      if (filters.monthTo && filters.monthTo !== 'all' && filters.yearTo && filters.yearTo !== 'all') {
        const toDate = new Date(parseInt(filters.yearTo), parseInt(filters.monthTo), 0); // Last day of month
        if (dueDate > toDate) return false;
      }
      
      // Amount filters
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

  const handleLogout = () => {
    localStorage.removeItem('financial_dashboard_auth');
    setIsAuthenticated(false);
    toast({
      title: "Logout realizado",
      description: "Acesso ao dashboard bloqueado",
    });
  };

  // Show authentication screen if not authenticated
  if (!isAuthenticated) {
    return (
      <PinAuth 
        onAuthenticated={handleAuthenticated} 
        isAuthenticated={isAuthenticated} 
      />
    );
  }

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
            
            <div className="flex gap-2">
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
              
              <Button 
                onClick={handleLogout} 
                variant="outline"
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs defaultValue="fs-turma" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fs-turma" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                FS Turma IV
              </TabsTrigger>
              <TabsTrigger value="demonstracoes" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Demonstrações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fs-turma" className="space-y-6">
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

              {/* Nested Tabs for FS Turma IV content */}
              <Tabs defaultValue="table" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 text-xs">
                  <TabsTrigger value="table" className="flex items-center gap-1 px-2">
                    <Table2 className="h-3 w-3" />
                    Tabela
                  </TabsTrigger>
                  <TabsTrigger value="students" className="flex items-center gap-1 px-2">
                    <Users className="h-3 w-3" />
                    Alunos
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="flex items-center gap-1 px-2">
                    <TrendingUp className="h-3 w-3" />
                    Mensal
                  </TabsTrigger>
                  <TabsTrigger value="commissions" className="flex items-center gap-1 px-2">
                    <DollarSign className="h-3 w-3" />
                    Comissões
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="table" className="space-y-6">
                  <FinancialTable data={filteredData} />
                </TabsContent>

                <TabsContent value="students" className="space-y-6">
                  <StudentsDirectory data={filteredData} />
                </TabsContent>

                <TabsContent value="monthly" className="space-y-6">
                  <MonthlyRevenue data={filteredData} />
                </TabsContent>

                <TabsContent value="commissions" className="space-y-6">
                  <MonthlyCommissionReport data={filteredData} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="demonstracoes" className="space-y-6">
              <Tabs defaultValue="dre" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dre" className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    DRE
                  </TabsTrigger>
                  <TabsTrigger value="fluxo-caixa" className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Fluxo de Caixa
                  </TabsTrigger>
                  <TabsTrigger value="comissoes" className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Comissões
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="dre" className="space-y-6">
                  <FinancialDRE data={filteredData} />
                </TabsContent>
                <TabsContent value="fluxo-caixa" className="space-y-6">
                  <CashFlow />
                </TabsContent>
                <TabsContent value="comissoes" className="space-y-6">
                  <Comissoes />
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
