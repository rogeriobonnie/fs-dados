import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
  BarChart3
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
  
  const { toast } = useToast();

  // Process raw cash flow data from Google Sheets into structured format
  const processCashFlowData = (rawData: any[]): CashFlowData => {
    const result: CashFlowData = {
      saldoInicial: 0,
      entradas: {},
      totalEntradas: 0,
      saidas: {},
      totalSaidas: 0,
      saldoFinal: 0,
      despesasVendas: {},
      totalDespesasVendas: 0
    };

    console.log('Raw data from Página3:', rawData);

    let currentSection = '';
    
    rawData.forEach((record, index) => {
      // Os dados vêm como: category = coluna A (título), subcategory = coluna B (valor)
      const titulo = record.category || record.description || ''; // Coluna A
      const valorStr = record.subcategory || ''; // Coluna B
      
      console.log(`Row ${index}:`, { titulo, valorStr, record });
      
      // Converte string brasileira para número
      const parseValor = (str: string): number => {
        if (!str) return 0;
        const cleanStr = str.toString().replace(/[^\d,-]/g, '').replace(',', '.');
        const num = parseFloat(cleanStr);
        return isNaN(num) ? 0 : num;
      };
      
      const valor = parseValor(valorStr);
      
      if (titulo.toUpperCase().includes('SALDO INICIAL')) {
        result.saldoInicial = valor;
        console.log('Saldo inicial:', valor);
      } else if (titulo.toUpperCase().includes('ENTRADAS:')) {
        currentSection = 'ENTRADAS';
        console.log('Seção: ENTRADAS');
      } else if (titulo.toUpperCase().includes('DESPESAS SOBRE VENDAS')) {
        currentSection = 'DESPESAS_VENDAS';
        console.log('Seção: DESPESAS_VENDAS');
      } else if (titulo.toUpperCase().includes('TOTAL ENTRADAS')) {
        result.totalEntradas = valor;
        console.log('Total entradas:', valor);
        currentSection = '';
      } else if (titulo.toUpperCase().includes('SAÍDAS:')) {
        currentSection = 'SAIDAS';
        console.log('Seção: SAIDAS');
      } else if (titulo.toUpperCase().includes('TOTAL SAÍDAS')) {
        result.totalSaidas = Math.abs(valor);
        console.log('Total saídas:', Math.abs(valor));
        currentSection = '';
      } else if (titulo.toUpperCase().includes('SALDO FIM')) {
        result.saldoFinal = valor;
        console.log('Saldo final:', valor);
      } else if (titulo && valor !== 0) {
        if (currentSection === 'ENTRADAS') {
          result.entradas[titulo] = valor;
          console.log('Entrada adicionada:', titulo, valor);
        } else if (currentSection === 'DESPESAS_VENDAS') {
          result.despesasVendas[titulo] = valor;
          result.totalDespesasVendas += Math.abs(valor);
          console.log('Despesa sobre vendas adicionada:', titulo, valor);
        } else if (currentSection === 'SAIDAS') {
          result.saidas[titulo] = Math.abs(valor);
          console.log('Saída adicionada:', titulo, Math.abs(valor));
        }
      }
    });

    console.log('Processed cash flow data:', result);
    return result;
  };

  const loadCashFlowData = async () => {
    setIsLoading(true);
    try {
      const rawData = await GoogleSheetsService.fetchCashFlowData();
      const processedData = processCashFlowData(rawData);
      setCashFlowData(processedData);
      setHasSearched(true);
      toast({
        title: "Sucesso",
        description: "Dados do fluxo de caixa carregados com sucesso.",
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
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </Button>
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