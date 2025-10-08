import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { 
  TrendingUp, 
  TrendingDown, 
  Loader2,
  RefreshCw,
  DollarSign,
  Minus,
  Plus,
  BarChart3,
  Calendar
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CashFlowData {
  saldoInicial: number;
  entradas: { [key: string]: number };
  totalEntradas: number;
  saidas: { [key: string]: number };
  totalSaidas: number;
  saldoFinal: number;
  despesasVendas: { [key: string]: number };
  totalDespesasVendas: number;
}

const CashFlow: React.FC = () => {
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [allMonthsData, setAllMonthsData] = useState<{ [key: string]: CashFlowData }>({});
  
  const { toast } = useToast();

  // Converte string brasileira para número
  const parseValor = (str: string): number => {
    if (!str) return 0;
    const cleanStr = str.toString().replace(/[^\d,-]/g, '').replace(',', '.');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  // Process raw cash flow data de dois formatos possíveis:
  // 1) Array de arrays (A:Z da planilha) com meses em colunas pares (A,C,E...)
  // 2) Array de objetos já parseados pelo service (fallback)
  const processCashFlowDataByMonths = (rawData: any[]): { months: string[], data: { [key: string]: CashFlowData } } => {
    console.log('Raw data from Página3:', rawData);
    
    if (!rawData || rawData.length === 0) {
      return { months: [], data: {} };
    }

    const isArrayRows = Array.isArray(rawData[0]);

    // Utilitário para iniciar estrutura do mês
    const initMonthData = (): CashFlowData => ({
      saldoInicial: 0,
      entradas: {},
      totalEntradas: 0,
      saidas: {},
      totalSaidas: 0,
      saldoFinal: 0,
      despesasVendas: {},
      totalDespesasVendas: 0,
    });

    // Caso 1: linhas cruas (A:Z) — meses em colunas
    if (isArrayRows) {
      // A primeira linha contém os nomes dos meses
      const firstRow = rawData[0] as any[];
      const uniqueMonths = new Set<string>();
      const monthColumns: { [key: string]: number } = {};
      
      // Identificar colunas de meses (colunas pares: 0, 2, 4, 6...)
      // As colunas ímpares (1, 3, 5, 7...) contêm os valores
      for (let i = 0; i < 40; i += 2) {
        const value = firstRow[i];
        if (value && typeof value === 'string' && value.trim()) {
          const label = value.trim();
          uniqueMonths.add(label);
          if (!monthColumns[label]) {
            monthColumns[label] = i;
            console.log('Mês encontrado (colunas):', label, 'na coluna', i);
          }
        }
      }

      const months = Array.from(uniqueMonths);
      console.log('Meses únicos identificados (colunas):', months);

      const monthsData: { [key: string]: CashFlowData } = {};

      months.forEach((month) => {
        const monthData = initMonthData();
        let currentSection = '';
        const valueColumnIndex = monthColumns[month] + 1; // Coluna de valores é a próxima

        rawData.forEach((record: any[], rowIndex: number) => {
          if (rowIndex === 0) return; // Skip header row

          const titulo = record[monthColumns[month]] || '';
          const valorStr = record[valueColumnIndex] || '';
          const valor = parseValor(valorStr);

          const tituloUp = (titulo || '').toString().toUpperCase();

          if (tituloUp.includes('SALDO INICIAL')) {
            monthData.saldoInicial = valor;
          } else if (tituloUp.includes('ENTRADAS:')) {
            currentSection = 'ENTRADAS';
          } else if (tituloUp.includes('DESPESAS SOBRE VENDAS')) {
            currentSection = 'DESPESAS_VENDAS';
          } else if (tituloUp.includes('TOTAL ENTRADAS')) {
            monthData.totalEntradas = valor;
            currentSection = '';
          } else if (tituloUp.includes('SAÍDAS:') || tituloUp.includes('SAIDAS:')) {
            currentSection = 'SAIDAS';
          } else if (tituloUp.includes('TOTAL SAÍDAS') || tituloUp.includes('TOTAL SAIDAS')) {
            monthData.totalSaidas = Math.abs(valor);
            currentSection = '';
          } else if (tituloUp.includes('SALDO FIM')) {
            monthData.saldoFinal = valor;
          } else if (titulo && valor !== 0) {
            if (currentSection === 'ENTRADAS') {
              monthData.entradas[titulo] = valor;
            } else if (currentSection === 'DESPESAS_VENDAS') {
              monthData.despesasVendas[titulo] = valor;
              monthData.totalDespesasVendas += Math.abs(valor);
            } else if (currentSection === 'SAIDAS') {
              monthData.saidas[titulo] = Math.abs(valor);
            }
          }
        });

        monthsData[month] = monthData;
        console.log(`Dados processados (colunas) para ${month}:`, monthData);
      });

      return { months, data: monthsData };
    }

    // Caso 2: lista de objetos já parseados — detectar meses por linhas "agosto/2025"
    const monthsData: { [key: string]: CashFlowData } = {};
    const monthsOrder: string[] = [];

    const ensureMonth = (label: string) => {
      if (!monthsData[label]) {
        monthsData[label] = initMonthData();
        monthsOrder.push(label);
      }
    };

    const monthLabelRegex = /^[A-Za-zÀ-ÿ]+\/(19|20)\d{2}$/i;
    let currentMonth = '';
    let currentSection = '';

    (rawData as any[]).forEach((rec) => {
      const cat = (rec.category || rec.description || '').toString().trim();
      const amt = typeof rec.amount === 'number' ? rec.amount : parseFloat(`${rec.amount}`) || 0;
      const up = cat.toUpperCase();

      // Nova seção de mês quando linha é "agosto/2025"
      if (cat && monthLabelRegex.test(cat)) {
        currentMonth = cat;
        ensureMonth(currentMonth);
        currentSection = '';
        return;
      }

      // Se ainda não definimos mês, usa um padrão
      if (!currentMonth) {
        currentMonth = 'Período';
        ensureMonth(currentMonth);
      }

      if (up.includes('SALDO INICIAL')) {
        monthsData[currentMonth].saldoInicial = amt;
      } else if (up.includes('ENTRADAS:')) {
        currentSection = 'ENTRADAS';
      } else if (up.includes('DESPESAS SOBRE VENDAS')) {
        currentSection = 'DESPESAS_VENDAS';
      } else if (up.includes('TOTAL ENTRADAS')) {
        monthsData[currentMonth].totalEntradas = Math.abs(amt);
        currentSection = '';
      } else if (up.includes('SAÍDAS:') || up.includes('SAIDAS:')) {
        currentSection = 'SAIDAS';
      } else if (up.includes('TOTAL SAÍDAS') || up.includes('TOTAL SAIDAS')) {
        monthsData[currentMonth].totalSaidas = Math.abs(amt);
        currentSection = '';
      } else if (up.includes('SALDO FIM')) {
        monthsData[currentMonth].saldoFinal = amt;
      } else if (cat && amt !== 0) {
        if (currentSection === 'ENTRADAS') {
          monthsData[currentMonth].entradas[cat] = amt;
        } else if (currentSection === 'DESPESAS_VENDAS') {
          monthsData[currentMonth].despesasVendas[cat] = amt;
          monthsData[currentMonth].totalDespesasVendas += Math.abs(amt);
        } else if (currentSection === 'SAIDAS') {
          monthsData[currentMonth].saidas[cat] = Math.abs(amt);
        }
      }
    });

    const months = monthsOrder.filter((m, i) => monthsOrder.indexOf(m) === i); // unicidade preservando ordem
    console.log('Meses identificados (objetos):', months);

    return { months, data: monthsData };
  };

  const loadCashFlowData = async () => {
    setIsLoading(true);
    try {
      const rawData = await GoogleSheetsService.fetchCashFlowData();
      const { months, data } = processCashFlowDataByMonths(rawData);
      
      setAvailableMonths(months);
      setAllMonthsData(data);
      
      // Selecionar o último mês com dados automaticamente
      if (months.length > 0) {
        const lastMonth = months[months.length - 1];
        setSelectedMonth(lastMonth);
        setCashFlowData(data[lastMonth]);
      }
      
      setHasSearched(true);
      toast({
        title: "Sucesso",
        description: `Dados carregados para ${months.length} ${months.length === 1 ? 'mês' : 'meses'}.`,
      });
    } catch (error) {
      console.error('Error loading cash flow data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do fluxo de caixa.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setCashFlowData(allMonthsData[month]);
  };

  useEffect(() => {
    loadCashFlowData();
  }, []);

  if (!hasSearched) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1>
            <p className="text-muted-foreground">
              Demonstração detalhada das movimentações financeiras
            </p>
          </div>
          <Button 
            onClick={loadCashFlowData} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isLoading ? 'Carregando...' : 'Carregar Dados'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1>
          <p className="text-muted-foreground">
            Demonstração detalhada das movimentações financeiras
          </p>
        </div>
        <div className="flex gap-3">
          {availableMonths.length > 0 && (
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[200px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((month) => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button 
            onClick={loadCashFlowData} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isLoading ? 'Carregando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {cashFlowData && (
        <div className="space-y-6 animate-fade-in">
          {/* Saldo Inicial */}
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-200 rounded-full">
                    <BarChart3 className="h-6 w-6 text-blue-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-blue-800">Saldo Inicial</h2>
                    <p className="text-sm text-blue-600">Valor disponível no início do período</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-800">
                    {formatCurrency(cashFlowData.saldoInicial)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Entradas - VERDE */}
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Plus className="h-5 w-5" />
                Entradas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(cashFlowData.entradas).map(([key, value], index) => (
                <div 
                  key={key} 
                  className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-green-200 hover-scale"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="font-medium text-green-700">{key}</span>
                  <span className="text-lg font-bold text-green-800">
                    +{formatCurrency(value)}
                  </span>
                </div>
              ))}
              
              {/* Despesas sobre Vendas - AMARELO */}
              {Object.keys(cashFlowData.despesasVendas).length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <h4 className="font-semibold text-yellow-700 flex items-center gap-2">
                      <Minus className="h-4 w-4" />
                      Despesas sobre Vendas
                    </h4>
                    {Object.entries(cashFlowData.despesasVendas).map(([key, value], index) => (
                      <div 
                        key={key} 
                        className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200 hover-scale"
                        style={{ animationDelay: `${(index + Object.keys(cashFlowData.entradas).length) * 0.1}s` }}
                      >
                        <span className="font-medium text-yellow-700">{key}</span>
                        <span className="text-lg font-bold text-yellow-800">
                          {formatCurrency(value)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 bg-yellow-100 rounded-lg border-2 border-yellow-300">
                      <span className="text-sm font-bold text-yellow-800">Subtotal Despesas Vendas</span>
                      <span className="text-lg font-bold text-yellow-800">
                        -{formatCurrency(cashFlowData.totalDespesasVendas)}
                      </span>
                    </div>
                  </div>
                </>
              )}
              
              <Separator className="my-4" />
              <div className="flex items-center justify-between p-4 bg-green-100 rounded-lg border-2 border-green-300">
                <span className="text-lg font-bold text-green-800">Total de Entradas</span>
                <span className="text-2xl font-bold text-green-800">
                  {formatCurrency(cashFlowData.totalEntradas)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Saídas - VERMELHO */}
          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <Minus className="h-5 w-5" />
                Saídas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(cashFlowData.saidas).map(([key, value], index) => (
                <div 
                  key={key} 
                  className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-red-200 hover-scale"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="font-medium text-red-700">{key}</span>
                  <span className="text-lg font-bold text-red-800">
                    -{formatCurrency(value)}
                  </span>
                </div>
              ))}
              
              <Separator className="my-4" />
              <div className="flex items-center justify-between p-4 bg-red-100 rounded-lg border-2 border-red-300">
                <span className="text-lg font-bold text-red-800">Total de Saídas</span>
                <span className="text-2xl font-bold text-red-800">
                  -{formatCurrency(cashFlowData.totalSaidas)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Saldo Final */}
          <Card className={`border-2 ${
            cashFlowData.saldoFinal >= 0 
              ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100' 
              : 'border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${
                    cashFlowData.saldoFinal >= 0 ? 'bg-emerald-200' : 'bg-orange-200'
                  }`}>
                    <DollarSign className={`h-6 w-6 ${
                      cashFlowData.saldoFinal >= 0 ? 'text-emerald-700' : 'text-orange-700'
                    }`} />
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${
                      cashFlowData.saldoFinal >= 0 ? 'text-emerald-800' : 'text-orange-800'
                    }`}>
                      Saldo Final
                    </h2>
                    <p className={`text-sm ${
                      cashFlowData.saldoFinal >= 0 ? 'text-emerald-600' : 'text-orange-600'
                    }`}>
                      Resultado final do período
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${
                    cashFlowData.saldoFinal >= 0 ? 'text-emerald-800' : 'text-orange-800'
                  }`}>
                    {formatCurrency(cashFlowData.saldoFinal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo Visual */}
          <Card className="border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Resumo do Período
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 bg-green-100 rounded-lg hover-scale">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-600">Total Entradas</p>
                  <p className="text-xl font-bold text-green-800">
                    {formatCurrency(cashFlowData.totalEntradas)}
                  </p>
                </div>
                <div className="text-center p-4 bg-red-100 rounded-lg hover-scale">
                  <TrendingDown className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <p className="text-sm text-red-600">Total Saídas</p>
                  <p className="text-xl font-bold text-red-800">
                    {formatCurrency(cashFlowData.totalSaidas)}
                  </p>
                </div>
                <div className={`text-center p-4 rounded-lg hover-scale ${
                  (cashFlowData.totalEntradas - cashFlowData.totalSaidas) >= 0 
                    ? 'bg-blue-100' 
                    : 'bg-orange-100'
                }`}>
                  <DollarSign className={`h-8 w-8 mx-auto mb-2 ${
                    (cashFlowData.totalEntradas - cashFlowData.totalSaidas) >= 0 
                      ? 'text-blue-600' 
                      : 'text-orange-600'
                  }`} />
                  <p className={`text-sm ${
                    (cashFlowData.totalEntradas - cashFlowData.totalSaidas) >= 0 
                      ? 'text-blue-600' 
                      : 'text-orange-600'
                  }`}>
                    Resultado
                  </p>
                  <p className={`text-xl font-bold ${
                    (cashFlowData.totalEntradas - cashFlowData.totalSaidas) >= 0 
                      ? 'text-blue-800' 
                      : 'text-orange-800'
                  }`}>
                    {formatCurrency(cashFlowData.totalEntradas - cashFlowData.totalSaidas)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {hasSearched && !cashFlowData && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Nenhum dado encontrado na Página3.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CashFlow;