import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  Calendar,
  ChevronDown,
  Wallet,
  PiggyBank,
  FileDown
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import jsPDF from 'jspdf';

interface CashFlowData {
  saldoInicial: number;
  entradas: { [key: string]: number };
  totalEntradas: number;
  totalEntradasBrutas: number;
  saidas: { [key: string]: number };
  totalSaidas: number;
  saldoFinal: number;
  despesasVendas: { [key: string]: number };
  totalDespesasVendas: number;
  // Linhas 34-37: Lucro Inicial
  valorAplicadoBancoInter?: number;
  rendimentos?: { [key: string]: number };
  lucroInicial?: number;
  // Linhas 39-43: Lucro Bruto
  provisoesLucroBruto?: { [key: string]: number };
  lucroBruto?: number;
  // Linhas 45-60: Provisões
  provisoes?: { [key: string]: number };
  provisoesDespesas?: { [key: string]: number };
  aplicacoes?: { [key: string]: number };
  lucroLiquido?: number;
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
      totalEntradasBrutas: 0,
      saidas: {},
      totalSaidas: 0,
      saldoFinal: 0,
      despesasVendas: {},
      totalDespesasVendas: 0,
      valorAplicadoBancoInter: 0,
      rendimentos: {},
      lucroInicial: 0,
      provisoesLucroBruto: {},
      lucroBruto: 0,
      provisoes: {},
      provisoesDespesas: {},
      aplicacoes: {},
      lucroLiquido: 0,
    });

    // Caso 1: linhas cruas (A:Z) — meses em colunas
    if (isArrayRows) {
      // A primeira linha contém os nomes dos meses
      const firstRow = rawData[0] as any[];
      const uniqueMonths = new Set<string>();
      const monthColumns: { [key: string]: number } = {};
      
      // Identificar colunas de meses (colunas pares: 0, 2, 4, 6...)
      // As colunas ímpares (1, 3, 5, 7...) contêm os valores
      for (let i = 0; i < firstRow.length; i += 2) {
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
            currentSection = 'LUCRO_INICIAL'; // Após saldo final, começam as linhas de lucro inicial
          } else if (tituloUp.includes('VALOR APLICADO BANCO INTER')) {
            monthData.valorAplicadoBancoInter = valor;
          } else if (tituloUp.includes('RENDIMENTO')) {
            if (!monthData.rendimentos) monthData.rendimentos = {};
            monthData.rendimentos[titulo] = valor;
          } else if (tituloUp.includes('LUCRO INICIAL')) {
            monthData.lucroInicial = valor;
            currentSection = 'LUCRO_BRUTO'; // Após lucro inicial, começam as linhas de lucro bruto
          } else if (tituloUp.includes('LUCRO BRUTO')) {
            monthData.lucroBruto = valor;
            currentSection = 'PROVISOES'; // Após lucro bruto, começam as provisões
          } else if (tituloUp.includes('LUCRO LIQUIDO') || tituloUp.includes('LUCRO LÍQUIDO')) {
            monthData.lucroLiquido = valor;
            currentSection = '';
          } else if (titulo && valor !== 0) {
            if (currentSection === 'ENTRADAS') {
              monthData.entradas[titulo] = valor;
              monthData.totalEntradasBrutas += valor;
          } else if (currentSection === 'DESPESAS_VENDAS') {
            monthData.despesasVendas[titulo] = valor;
            monthData.totalDespesasVendas += valor;
            } else if (currentSection === 'SAIDAS') {
              monthData.saidas[titulo] = Math.abs(valor);
            } else if (currentSection === 'LUCRO_INICIAL') {
              // Linhas entre saldo final e lucro inicial (34-37)
              if (tituloUp.includes('RENDIMENTO')) {
                if (!monthData.rendimentos) monthData.rendimentos = {};
                monthData.rendimentos[titulo] = valor;
              } else if (tituloUp.includes('PROV')) {
                // Provisões no Lucro Inicial (PROV LUCROS, PROV LANCE A DOIS, etc)
                if (!monthData.rendimentos) monthData.rendimentos = {};
                monthData.rendimentos[titulo] = valor;
              }
            } else if (currentSection === 'LUCRO_BRUTO') {
              // Linhas entre lucro inicial e lucro bruto (39-42)
              if (tituloUp.includes('PROV')) {
                if (!monthData.provisoesLucroBruto) monthData.provisoesLucroBruto = {};
                monthData.provisoesLucroBruto[titulo] = Math.abs(valor);
                console.log('Provisão Lucro Bruto encontrada:', titulo, valor);
              } else if (tituloUp.includes('APLICACAO') || tituloUp.includes('XP')) {
                if (!monthData.aplicacoes) monthData.aplicacoes = {};
                monthData.aplicacoes[titulo] = Math.abs(valor);
                console.log('Aplicação XP encontrada:', titulo, valor);
              }
            } else if (currentSection === 'PROVISOES') {
              // Linhas 45-60: Provisões
              if (tituloUp.includes('PROV')) {
                if (!monthData.provisoes) monthData.provisoes = {};
                monthData.provisoes[titulo] = Math.abs(valor);
              } else if (tituloUp.includes('APLICACAO') || tituloUp.includes('XP')) {
                if (!monthData.aplicacoes) monthData.aplicacoes = {};
                monthData.aplicacoes[titulo] = valor;
              }
            }
          }
        });

        console.log(`Dados processados para ${month}:`, {
          lucroInicial: monthData.lucroInicial,
          aplicacoes: monthData.aplicacoes,
          provisoesLucroBruto: monthData.provisoesLucroBruto,
          lucroBruto: monthData.lucroBruto
        });
        
        monthsData[month] = monthData;
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
        currentSection = 'LUCRO_INICIAL'; // Após saldo final, começam as linhas de lucro inicial
      } else if (up.includes('LUCRO INICIAL')) {
        monthsData[currentMonth].lucroInicial = amt;
        currentSection = 'LUCRO_BRUTO'; // Após lucro inicial, começam as linhas de lucro bruto
      } else if (up.includes('LUCRO BRUTO')) {
        monthsData[currentMonth].lucroBruto = amt;
        currentSection = 'PROVISOES'; // Após lucro bruto, começam as provisões
      } else if (up.includes('LUCRO LIQUIDO') || up.includes('LUCRO LÍQUIDO')) {
        monthsData[currentMonth].lucroLiquido = amt;
        currentSection = '';
      } else if (up.includes('PROV DESPESAS')) {
        currentSection = 'PROV_DESPESAS';
      } else if (cat && amt !== 0) {
        if (currentSection === 'ENTRADAS') {
          monthsData[currentMonth].entradas[cat] = amt;
          monthsData[currentMonth].totalEntradasBrutas += amt;
        } else if (currentSection === 'DESPESAS_VENDAS') {
          monthsData[currentMonth].despesasVendas[cat] = amt;
          monthsData[currentMonth].totalDespesasVendas += amt;
        } else if (currentSection === 'SAIDAS') {
          monthsData[currentMonth].saidas[cat] = Math.abs(amt);
        } else if (currentSection === 'LUCRO_INICIAL') {
          // Linhas entre saldo final e lucro inicial (34-37)
          if (up.includes('RENDIMENTO') || up.includes('PROV')) {
            if (!monthsData[currentMonth].rendimentos) monthsData[currentMonth].rendimentos = {};
            monthsData[currentMonth].rendimentos[cat] = amt;
          } else if (up.includes('VALOR APLICADO BANCO INTER')) {
            monthsData[currentMonth].valorAplicadoBancoInter = amt;
          }
        } else if (currentSection === 'LUCRO_BRUTO') {
          // Linhas entre lucro inicial e lucro bruto (39-42)
          if (up.includes('PROV')) {
            if (!monthsData[currentMonth].provisoesLucroBruto) monthsData[currentMonth].provisoesLucroBruto = {};
            monthsData[currentMonth].provisoesLucroBruto[cat] = Math.abs(amt);
          } else if (up.includes('APLICACAO') || up.includes('XP')) {
            if (!monthsData[currentMonth].aplicacoes) monthsData[currentMonth].aplicacoes = {};
            monthsData[currentMonth].aplicacoes[cat] = Math.abs(amt);
          }
        } else if (currentSection === 'PROV_DESPESAS') {
          if (!monthsData[currentMonth].provisoesDespesas) monthsData[currentMonth].provisoesDespesas = {};
          monthsData[currentMonth].provisoesDespesas[cat] = Math.abs(amt);
        } else if (currentSection === 'PROVISOES') {
          // Linhas 45-60: Provisões
          if (up.includes('PROV')) {
            if (!monthsData[currentMonth].provisoes) monthsData[currentMonth].provisoes = {};
            monthsData[currentMonth].provisoes[cat] = Math.abs(amt);
          } else if (up.includes('APLICACAO') || up.includes('XP')) {
            if (!monthsData[currentMonth].aplicacoes) monthsData[currentMonth].aplicacoes = {};
            monthsData[currentMonth].aplicacoes[cat] = amt;
          }
        } else if (up.includes('VALOR APLICADO') || up.includes('APLICACAO')) {
          if (!monthsData[currentMonth].aplicacoes) monthsData[currentMonth].aplicacoes = {};
          monthsData[currentMonth].aplicacoes[cat] = amt;
        } else if (up.includes('PROV ')) {
          if (!monthsData[currentMonth].provisoes) monthsData[currentMonth].provisoes = {};
          monthsData[currentMonth].provisoes[cat] = Math.abs(amt);
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

  const generatePDF = () => {
    if (!cashFlowData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPosition = 20;

    // Título
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55);
    doc.text('Relatório de Fluxo de Caixa', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.setFontSize(12);
    doc.setTextColor(107, 114, 128);
    doc.text(selectedMonth || 'Período', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 15;

    // Função auxiliar para adicionar seção
    const addSection = (title: string, color: [number, number, number]) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFillColor(...color);
      doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(title, 12, yPosition + 5.5);
      yPosition += 12;
    };

    // Função auxiliar para adicionar linha
    const addLine = (label: string, value: string | number, indent = 0) => {
      if (yPosition > 275) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text(label, 12 + indent, yPosition);
      doc.setTextColor(31, 41, 55);
      doc.text(typeof value === 'number' ? formatCurrency(value) : value, pageWidth - 12, yPosition, { align: 'right' });
      yPosition += 6;
    };

    // Saldo Inicial
    addSection('Saldo Inicial', [59, 130, 246]);
    addLine('Valor disponível no início do período', cashFlowData.saldoInicial);
    yPosition += 3;

    // Entradas
    addSection('Entradas', [34, 197, 94]);
    Object.entries(cashFlowData.entradas).forEach(([key, value]) => {
      addLine(key, value, 3);
    });
    if (cashFlowData.totalDespesasVendas > 0) {
      yPosition += 2;
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('Despesas sobre Vendas:', 15, yPosition);
      yPosition += 5;
      Object.entries(cashFlowData.despesasVendas).forEach(([key, value]) => {
        addLine(key, value, 6);
      });
      addLine('Total Despesas sobre Vendas', cashFlowData.totalDespesasVendas, 3);
    }
    yPosition += 2;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    addLine('Subtotal Entradas Brutas', cashFlowData.totalEntradasBrutas, 3);
    addLine('Subtotal Despesas s/ Vendas', cashFlowData.totalDespesasVendas, 3);
    doc.setFontSize(11);
    doc.setTextColor(22, 163, 74);
    addLine('Total de Entradas Líquidas', cashFlowData.totalEntradas);
    yPosition += 3;

    // Saídas
    addSection('Saídas', [239, 68, 68]);
    Object.entries(cashFlowData.saidas).forEach(([key, value]) => {
      addLine(key, value, 3);
    });
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38);
    addLine('Total de Saídas', cashFlowData.totalSaidas);
    yPosition += 3;

    // Saldo Final
    addSection('Saldo Final', [59, 130, 246]);
    const saldoPositivo = cashFlowData.saldoFinal >= 0;
    doc.setTextColor(saldoPositivo ? 22 : 220, saldoPositivo ? 163 : 38, saldoPositivo ? 74 : 38);
    addLine('Saldo ao final do período', cashFlowData.saldoFinal);
    yPosition += 3;

    // Resumo
    addSection('Resumo do Período', [99, 102, 241]);
    addLine('Saldo Inicial', cashFlowData.saldoInicial, 3);
    addLine('Total Entradas', cashFlowData.totalEntradas, 3);
    addLine('Total Saídas', cashFlowData.totalSaidas, 3);
    addLine('Saldo Final', cashFlowData.saldoFinal, 3);
    yPosition += 3;

    // Lucro Inicial (se houver)
    if (cashFlowData.lucroInicial !== undefined && cashFlowData.lucroInicial !== 0) {
      addSection('Lucro Inicial', [168, 85, 247]);
      if (cashFlowData.valorAplicadoBancoInter) {
        addLine('Valor Aplicado Banco Inter', cashFlowData.valorAplicadoBancoInter, 3);
      }
      if (cashFlowData.rendimentos && Object.keys(cashFlowData.rendimentos).length > 0) {
        Object.entries(cashFlowData.rendimentos).forEach(([key, value]) => {
          addLine(key, value, 3);
        });
      }
      doc.setFontSize(11);
      doc.setTextColor(126, 34, 206);
      addLine('Lucro Inicial', cashFlowData.lucroInicial);
      yPosition += 3;
    }

    // Aplicações XP (se houver)
    if (cashFlowData.aplicacoes && Object.keys(cashFlowData.aplicacoes).length > 0) {
      addSection('Aplicações XP Investimento', [236, 72, 153]);
      Object.entries(cashFlowData.aplicacoes).forEach(([key, value]) => {
        addLine(key, value, 3);
      });
      yPosition += 3;
    }

    // Lucro Bruto (se houver)
    if (cashFlowData.lucroBruto !== undefined && cashFlowData.lucroBruto !== 0) {
      addSection('Lucro Bruto', [249, 115, 22]);
      if (cashFlowData.provisoesLucroBruto && Object.keys(cashFlowData.provisoesLucroBruto).length > 0) {
        Object.entries(cashFlowData.provisoesLucroBruto).forEach(([key, value]) => {
          addLine(key, value, 3);
        });
      }
      doc.setFontSize(11);
      doc.setTextColor(202, 138, 4);
      addLine('Lucro Bruto', cashFlowData.lucroBruto);
      yPosition += 3;
    }

    // Provisões (se houver)
    if (cashFlowData.provisoes && Object.keys(cashFlowData.provisoes).length > 0) {
      addSection('Provisões', [245, 158, 11]);
      Object.entries(cashFlowData.provisoes).forEach(([key, value]) => {
        addLine(key, value, 3);
      });
      yPosition += 3;
    }

    // Lucro Líquido (se houver)
    if (cashFlowData.lucroLiquido !== undefined && cashFlowData.lucroLiquido !== 0) {
      addSection('Lucro Líquido', [16, 185, 129]);
      const lucroPositivo = cashFlowData.lucroLiquido >= 0;
      doc.setTextColor(lucroPositivo ? 5 : 220, lucroPositivo ? 150 : 38, lucroPositivo ? 105 : 38);
      addLine('Resultado líquido do período', cashFlowData.lucroLiquido);
      yPosition += 2;
      doc.setFontSize(10);
      doc.setTextColor(5, 150, 105);
      addLine('Lucro por sócio (÷3)', cashFlowData.lucroLiquido / 3, 3);
    }

    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`Fluxo-Caixa-${selectedMonth || 'Periodo'}.pdf`);
    toast({
      title: "PDF Gerado",
      description: "Relatório de fluxo de caixa baixado com sucesso.",
    });
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
            onClick={generatePDF}
            disabled={!cashFlowData}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            Gerar PDF
          </Button>
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
          <Collapsible defaultOpen={false}>
            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
              <CollapsibleTrigger className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between w-full group">
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <Plus className="h-5 w-5" />
                      Entradas
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-green-800">
                        {formatCurrency(cashFlowData.totalEntradas)}
                      </span>
                      <ChevronDown className="h-5 w-5 text-green-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
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
                      <Collapsible defaultOpen={false}>
                        <div className="space-y-3">
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200 group">
                              <h4 className="font-semibold text-yellow-700 flex items-center gap-2">
                                <Minus className="h-4 w-4" />
                                Despesas sobre Vendas
                              </h4>
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-yellow-800">
                                  {formatCurrency(cashFlowData.totalDespesasVendas)}
                                </span>
                                <ChevronDown className="h-4 w-4 text-yellow-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="space-y-3">
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
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                     </>
                  )}
                  
                  <Separator className="my-4" />
                  
                  {/* Subtotais */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-green-700">Subtotal Entradas Brutas</span>
                      <span className="text-base font-semibold text-green-800">
                        +{formatCurrency(cashFlowData.totalEntradasBrutas)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                      <span className="text-sm font-medium text-yellow-700">Subtotal Despesas sobre Vendas</span>
                      <span className="text-base font-semibold text-yellow-800">
                        {formatCurrency(cashFlowData.totalDespesasVendas)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-green-100 rounded-lg border-2 border-green-300">
                    <span className="text-lg font-bold text-green-800">Total de Entradas Líquidas</span>
                    <span className="text-2xl font-bold text-green-800">
                      +{formatCurrency(cashFlowData.totalEntradas)}
                    </span>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Saídas - VERMELHO */}
          <Collapsible defaultOpen={false}>
            <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
              <CollapsibleTrigger className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between w-full group">
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <Minus className="h-5 w-5" />
                      Saídas
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-red-800">
                        -{formatCurrency(cashFlowData.totalSaidas)}
                      </span>
                      <ChevronDown className="h-5 w-5 text-red-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
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
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

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

          {/* Resumo do Período */}
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

          {/* Lucro Inicial - Linhas 34-37 */}
          {cashFlowData.lucroInicial !== undefined && cashFlowData.lucroInicial !== 0 ? (
            <Collapsible defaultOpen={false}>
              <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100">
                <CollapsibleTrigger className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full group">
                      <CardTitle className="flex items-center gap-2 text-cyan-800">
                        <Wallet className="h-5 w-5" />
                        Lucro Inicial
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-cyan-800">
                          {formatCurrency(cashFlowData.lucroInicial)}
                        </span>
                        <ChevronDown className="h-5 w-5 text-cyan-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-cyan-200">
                      <span className="font-medium text-cyan-700">Saldo Final</span>
                      <span className="text-lg font-bold text-cyan-800">
                        {formatCurrency(cashFlowData.saldoFinal)}
                      </span>
                    </div>
                    {cashFlowData.valorAplicadoBancoInter !== undefined && cashFlowData.valorAplicadoBancoInter !== 0 && (
                      <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-cyan-200">
                        <span className="font-medium text-cyan-700">Valor Aplicado Banco Inter</span>
                        <span className="text-lg font-bold text-cyan-800">
                          {formatCurrency(cashFlowData.valorAplicadoBancoInter)}
                        </span>
                      </div>
                    )}
                    {cashFlowData.rendimentos && Object.entries(cashFlowData.rendimentos).map(([key, value], index) => (
                      <div 
                        key={key} 
                        className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-cyan-200"
                      >
                        <span className="font-medium text-cyan-700">{key}</span>
                        <span className="text-lg font-bold text-cyan-800">
                          {formatCurrency(value)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ) : null}

          {/* Aplicações XP Investimento */}
          {cashFlowData.aplicacoes && Object.keys(cashFlowData.aplicacoes).length > 0 ? (
            <Collapsible defaultOpen={false}>
              <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100">
                <CollapsibleTrigger className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full group">
                      <CardTitle className="flex items-center gap-2 text-sky-800">
                        <PiggyBank className="h-5 w-5" />
                        XP Investimento
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-sky-800">
                          {formatCurrency(Object.values(cashFlowData.aplicacoes).reduce((acc, val) => acc + val, 0))}
                        </span>
                        <ChevronDown className="h-5 w-5 text-sky-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    {/* Mostrar cálculo detalhado do XP */}
                    {cashFlowData.lucroInicial !== undefined && cashFlowData.lucroInicial !== 0 && (
                      <div className="bg-sky-50 border border-sky-300 rounded-lg p-4 space-y-2">
                        <h5 className="font-semibold text-sky-900 mb-3">Cálculo Base XP (10%)</h5>
                        
                        {/* Lucro Inicial */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-sky-700">Lucro Inicial</span>
                          <span className="font-bold text-sky-900">
                            {formatCurrency(cashFlowData.lucroInicial)}
                          </span>
                        </div>
                        
                        {/* Provisões do Lucro Bruto */}
                        {cashFlowData.provisoesLucroBruto && Object.entries(cashFlowData.provisoesLucroBruto).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-red-600">- {key}</span>
                            <span className="font-medium text-red-700">
                              -{formatCurrency(val)}
                            </span>
                          </div>
                        ))}
                        
                        {/* Base de Cálculo */}
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span className="text-sky-800">Base de Cálculo</span>
                          <span className="text-sky-900">
                            {(() => {
                              const totalProvisoes = cashFlowData.provisoesLucroBruto 
                                ? Object.values(cashFlowData.provisoesLucroBruto).reduce((acc, val) => acc + val, 0)
                                : 0;
                              return formatCurrency(cashFlowData.lucroInicial - totalProvisoes);
                            })()}
                          </span>
                        </div>
                        
                        {/* XP 10% */}
                        <div className="flex items-center justify-between pt-2 border-t-2 border-sky-300">
                          <span className="font-bold text-sky-900">XP Investimento (10%)</span>
                          <span className="text-lg font-bold text-sky-900">
                            {(() => {
                              const totalProvisoes = cashFlowData.provisoesLucroBruto 
                                ? Object.values(cashFlowData.provisoesLucroBruto).reduce((acc, val) => acc + val, 0)
                                : 0;
                              const baseCalculo = cashFlowData.lucroInicial - totalProvisoes;
                              return formatCurrency(baseCalculo * 0.1);
                            })()}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Outras aplicações */}
                    {Object.entries(cashFlowData.aplicacoes).map(([key, value], index) => (
                      <div 
                        key={key} 
                        className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-sky-200 hover-scale"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <span className="font-medium text-sky-700">{key}</span>
                        <span className="text-lg font-bold text-sky-800">
                          {formatCurrency(value)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ) : null}

          {/* Lucro Bruto - Base de Cálculo - XP Investimento */}
          {cashFlowData.lucroBruto !== undefined && cashFlowData.lucroBruto !== 0 ? (
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-200 rounded-full">
                      <BarChart3 className="h-6 w-6 text-indigo-700" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-indigo-800">Lucro Bruto</h2>
                      <p className="text-sm text-indigo-600">Base de Cálculo - XP Investimento</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-indigo-800">
                      {(() => {
                        const totalProvisoes = cashFlowData.provisoesLucroBruto 
                          ? Object.values(cashFlowData.provisoesLucroBruto).reduce((acc, val) => acc + val, 0)
                          : 0;
                        const baseCalculo = cashFlowData.lucroInicial - totalProvisoes;
                        const xpInvestimento = baseCalculo * 0.1;
                        return formatCurrency(baseCalculo - xpInvestimento);
                      })()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Provisões - Linhas 45-60 */}
          {cashFlowData.provisoes && Object.keys(cashFlowData.provisoes).length > 0 ? (
            <Collapsible defaultOpen={false}>
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
                <CollapsibleTrigger className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full group">
                      <CardTitle className="flex items-center gap-2 text-purple-800">
                        <PiggyBank className="h-5 w-5" />
                        Provisões
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-purple-800">
                          -{formatCurrency(Object.values(cashFlowData.provisoes).reduce((acc, val) => acc + val, 0))}
                        </span>
                        <ChevronDown className="h-5 w-5 text-purple-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    {Object.entries(cashFlowData.provisoes).map(([key, value], index) => (
                      <div 
                        key={key} 
                        className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-purple-200 hover-scale"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <span className="font-medium text-purple-700">{key}</span>
                        <span className="text-lg font-bold text-purple-800">
                          -{formatCurrency(value)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ) : null}


          {/* Lucro Líquido */}
          {cashFlowData.lucroLiquido !== undefined && cashFlowData.lucroLiquido !== 0 ? (
            <Collapsible defaultOpen={false}>
              <Card className={`border-2 ${
                cashFlowData.lucroLiquido >= 0 
                  ? 'border-teal-300 bg-gradient-to-br from-teal-50 to-teal-100' 
                  : 'border-red-300 bg-gradient-to-br from-red-50 to-red-100'
              }`}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full group">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${
                          cashFlowData.lucroLiquido >= 0 ? 'bg-teal-200' : 'bg-red-200'
                        }`}>
                          <DollarSign className={`h-6 w-6 ${
                            cashFlowData.lucroLiquido >= 0 ? 'text-teal-700' : 'text-red-700'
                          }`} />
                        </div>
                        <div>
                          <h2 className={`text-xl font-bold ${
                            cashFlowData.lucroLiquido >= 0 ? 'text-teal-800' : 'text-red-800'
                          }`}>
                            Lucro Líquido
                          </h2>
                          <p className={`text-sm ${
                            cashFlowData.lucroLiquido >= 0 ? 'text-teal-600' : 'text-red-600'
                          }`}>
                            Resultado final após todas provisões
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`text-3xl font-bold ${
                          cashFlowData.lucroLiquido >= 0 ? 'text-teal-800' : 'text-red-800'
                        }`}>
                          {formatCurrency(cashFlowData.lucroLiquido)}
                        </p>
                        <ChevronDown className={`h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180 ${
                          cashFlowData.lucroLiquido >= 0 ? 'text-teal-600' : 'text-red-600'
                        }`} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <div className="p-4 bg-white/50 rounded-lg border-2 border-teal-200">
                      <p className="text-sm text-teal-700 mb-3 font-medium">Divisão por Sócia (3 sócias)</p>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-teal-700">Valor por Sócia</span>
                        <span className="text-2xl font-bold text-teal-800">
                          {formatCurrency(cashFlowData.lucroLiquido / 3)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ) : null}

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