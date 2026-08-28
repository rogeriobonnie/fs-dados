import { useState, useEffect } from 'react';
import FinancialDRE from '@/components/FinancialDRE';
import FinancialDRENovo from '@/components/FinancialDRENovo';
import CursosParceiros from '@/components/CursosParceiros';
import CashFlow from '@/components/CashFlow';
import PainelFinanceiro from '@/components/PainelFinanceiro';
import HistoricoAnual from '@/components/HistoricoAnual';
import Comissoes from '@/components/Comissoes';
import TurmaPanel from '@/components/TurmaPanel';
import { PinAuth } from '@/components/PinAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { financialData } from '@/data/financialData';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { FinancialRecord } from '@/types/financial';
import { Users, TrendingUp, RefreshCw, LogOut, DollarSign, BarChart3, GraduationCap } from 'lucide-react';
import logoFS from '@/assets/logo-fs.png';

const Index = () => {
  const [data, setData] = useState<FinancialRecord[]>(financialData);
  const [turmaVData, setTurmaVData] = useState<FinancialRecord[]>([]);
  const [turmaIIIData, setTurmaIIIData] = useState<FinancialRecord[]>([]);

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

  const handleAuthenticated = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };

  const loadDataFromSheets = async () => {
    setIsLoading(true);
    try {
      const [sheetData, turmaV] = await Promise.all([
        GoogleSheetsService.fetchSheetData(),
        GoogleSheetsService.fetchTurmaVData().catch((e) => {
          console.error('Erro ao carregar Turma V:', e);
          return [] as FinancialRecord[];
        }),
      ]);
      setData(sheetData);
      setTurmaVData(turmaV);
      toast({
        title: "Dados atualizados!",
        description: `${sheetData.length} registros da Turma IV e ${turmaV.length} da Turma V`,
      });
    } catch (error) {
      console.error('Error loading data from sheets:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Falha ao conectar com a planilha. Usando dados locais.",
        variant: "destructive",
      });
      setData(financialData);
    } finally {
      setIsLoading(false);
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
          <div className="flex justify-between items-center bg-sky-500 -mx-4 px-4 py-6 rounded-lg">
            <div className="flex items-center gap-4">
              <img src={logoFS} alt="Fisioterapeutas do Sono" className="h-16 w-auto" />
              <h1 className="text-3xl font-bold tracking-tight text-white">Controle FS</h1>
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
          <Tabs defaultValue="curso-extensao" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="curso-extensao" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Curso de Extensão
              </TabsTrigger>
              <TabsTrigger value="demonstracoes" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Demonstrações
              </TabsTrigger>
              <TabsTrigger value="painel-financeiro" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Painel Financeiro
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="curso-extensao" className="space-y-6">
              <Tabs defaultValue="turma-v" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="turma-v" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Turma V
                  </TabsTrigger>
                  <TabsTrigger value="turma-iv" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Turma IV
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="turma-v" className="space-y-6">
                  <TurmaPanel data={turmaVData} />
                </TabsContent>

                <TabsContent value="turma-iv" className="space-y-6">
                  <TurmaPanel data={data} showVisaoGeral />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="demonstracoes" className="space-y-6">
              <Tabs defaultValue="dre-novo" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="dre-novo" className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    DRE Novo
                  </TabsTrigger>
                  <TabsTrigger value="cursos-parceiros" className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Cursos Parceiros
                  </TabsTrigger>
                  <TabsTrigger value="dre" className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    DRE Antigo
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
                <TabsContent value="dre-novo" className="space-y-6">
                  <FinancialDRENovo />
                </TabsContent>
                <TabsContent value="cursos-parceiros" className="space-y-6">
                  <CursosParceiros />
                </TabsContent>
                <TabsContent value="dre" className="space-y-6">
                  <FinancialDRE data={data} />
                </TabsContent>
                <TabsContent value="fluxo-caixa" className="space-y-6">
                  <CashFlow />
                </TabsContent>
                <TabsContent value="comissoes" className="space-y-6">
                  <Comissoes />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="painel-financeiro" className="space-y-6">
              <PainelFinanceiro />
            </TabsContent>

            <TabsContent value="historico" className="space-y-6">
              <HistoricoAnual />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
