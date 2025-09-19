import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Building2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CashFlowRecord {
  id: string;
  category: string;
  description: string;
  subcategory: string;
  detail: string;
  amount: number;
  date: string;
  bank: string;
  type: 'ENTRADA' | 'SAÍDA';
}

const CashFlow: React.FC = () => {
  const [cashFlowData, setCashFlowData] = useState<CashFlowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const { toast } = useToast();

  const loadCashFlowData = async () => {
    setIsLoading(true);
    try {
      const data = await GoogleSheetsService.fetchCashFlowData();
      setCashFlowData(data);
      setHasSearched(true);
      toast({
        title: "Sucesso",
        description: `${data.length} registros de fluxo de caixa carregados.`,
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

  // Calculate summary
  const summary = useMemo(() => {
    const totalEntradas = cashFlowData
      .filter(record => record.type === 'ENTRADA')
      .reduce((sum, record) => sum + record.amount, 0);
    
    const totalSaidas = cashFlowData
      .filter(record => record.type === 'SAÍDA')
      .reduce((sum, record) => sum + Math.abs(record.amount), 0);
    
    const saldoLiquido = totalEntradas - totalSaidas;

    return {
      totalEntradas,
      totalSaidas,
      saldoLiquido
    };
  }, [cashFlowData]);

  // Group data by category
  const groupedData = useMemo(() => {
    const groups: { [key: string]: CashFlowRecord[] } = {};
    
    cashFlowData.forEach(record => {
      const key = record.category || 'Outros';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    });

    return groups;
  }, [cashFlowData]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1>
          <p className="text-muted-foreground">
            Análise completa das entradas e saídas financeiras
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
          {isLoading ? 'Carregando...' : 'Consultar'}
        </Button>
      </div>


      {/* Summary Cards */}
      {hasSearched && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Total Entradas</p>
                  <p className="text-2xl font-bold text-green-800">
                    {formatCurrency(summary.totalEntradas)}
                  </p>
                </div>
                <div className="p-3 bg-green-200 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Total Saídas</p>
                  <p className="text-2xl font-bold text-red-800">
                    {formatCurrency(summary.totalSaidas)}
                  </p>
                </div>
                <div className="p-3 bg-red-200 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 ${summary.saldoLiquido >= 0 ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100' : 'border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Saldo Líquido</p>
                  <p className={`text-2xl font-bold ${summary.saldoLiquido >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                    {formatCurrency(summary.saldoLiquido)}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${summary.saldoLiquido >= 0 ? 'bg-blue-200' : 'bg-orange-200'}`}>
                  <Building2 className={`h-6 w-6 ${summary.saldoLiquido >= 0 ? 'text-blue-700' : 'text-orange-700'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Display */}
      {hasSearched && (
        <div className="space-y-6">
          {Object.entries(groupedData).map(([category, records]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{category}</span>
                  <Badge variant="secondary">
                    {records.length} registro{records.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {records.map((record, index) => (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{record.description}</h4>
                          <Badge variant={record.type === 'ENTRADA' ? 'default' : 'destructive'}>
                            {record.type}
                          </Badge>
                        </div>
                        {record.subcategory && (
                          <p className="text-sm text-muted-foreground">{record.subcategory}</p>
                        )}
                        {record.detail && (
                          <p className="text-sm text-muted-foreground">{record.detail}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {record.date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {record.date}
                            </div>
                          )}
                          {record.bank && (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {record.bank}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${record.type === 'ENTRADA' ? 'text-green-600' : 'text-red-600'}`}>
                          {record.type === 'ENTRADA' ? '+' : '-'}{formatCurrency(Math.abs(record.amount))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasSearched && cashFlowData.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Nenhum registro encontrado na Página3.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CashFlow;