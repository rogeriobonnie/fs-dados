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
  detalhesSaldoInicial?: { [key: string]: number };
  entradas: { [key: string]: number };
  totalEntradas: number;
  totalEntradasBrutas: number;
  saidas: { [key: string]: number };
  totalSaidas: number;
  saldoFinal: number;
  detalhesSaldoFinal?: { [key: string]: number };
  despesasVendas: { [key: string]: number };
  totalDespesasVendas: number;
  // Outras Entradas (informativo) - capturadas dinamicamente entre TOTAL ENTRADAS e SAÍDAS
  outrasEntradasInfo?: { [key: string]: number };
  // Linhas 34-37: Lucro Inicial
  valorAplicadoBancoInter?: number;
  rendimentos?: { [key: string]: number };
  detalhesLucroInicial?: { [key: string]: number }; // Captura dinâmica de todas as linhas
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
      outrasEntradasInfo: {},
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
            currentSection = 'SALDO_INICIAL_DETALHES';
          } else if (currentSection === 'SALDO_INICIAL_DETALHES' && tituloUp.includes('ENTRADAS:')) {
            currentSection = 'ENTRADAS';
          } else if (currentSection === 'SALDO_INICIAL_DETALHES' && titulo && titulo.trim() && valor !== 0) {
            if (!monthData.detalhesSaldoInicial) monthData.detalhesSaldoInicial = {};
            monthData.detalhesSaldoInicial[titulo] = valor;
          } else if (tituloUp.includes('ENTRADAS:')) {
            currentSection = 'ENTRADAS';
          } else if (tituloUp.includes('DESPESAS SOBRE VENDAS')) {
            currentSection = 'DESPESAS_VENDAS';
          } else if (tituloUp.includes('TOTAL ENTRADAS')) {
            monthData.totalEntradas = valor;
            currentSection = 'OUTRAS_ENTRADAS'; // Seção para capturar entradas informativas
          } else if (tituloUp.includes('SAÍDAS:') || tituloUp.includes('SAIDAS:')) {
            currentSection = 'SAIDAS';
          } else if (tituloUp.includes('TOTAL SAÍDAS') || tituloUp.includes('TOTAL SAIDAS')) {
            monthData.totalSaidas = Math.abs(valor);
            currentSection = '';
          } else if (tituloUp.includes('SALDO FIM')) {
            monthData.saldoFinal = valor;
            currentSection = 'LUCRO_INICIAL'; // Após saldo final, começam as linhas de lucro inicial
          } else if (currentSection === 'LUCRO_INICIAL' && tituloUp.includes('LUCRO INICIAL') && !tituloUp.includes('PROV')) {
            // Este é o valor final do Lucro Inicial - fecha a seção
            monthData.lucroInicial = valor;
            currentSection = 'LUCRO_BRUTO'; // Após lucro inicial, começam as linhas de lucro bruto
          } else if (currentSection === 'LUCRO_INICIAL' && titulo && titulo.trim()) {
            // Captura QUALQUER linha entre SALDO FIM e LUCRO INICIAL
            if (valor !== 0) {
              if (!monthData.detalhesLucroInicial) monthData.detalhesLucroInicial = {};
              monthData.detalhesLucroInicial[titulo] = valor;
              console.log('Detalhe Lucro Inicial (dinâmico):', titulo, valor);
            }
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
            } else if (currentSection === 'OUTRAS_ENTRADAS') {
              // Captura dinâmica de outras entradas entre TOTAL ENTRADAS e SAÍDAS
              if (!monthData.outrasEntradasInfo) monthData.outrasEntradasInfo = {};
              monthData.outrasEntradasInfo[titulo] = valor;
              console.log('Outras Entradas (dinâmico):', titulo, valor);
            } else if (currentSection === 'SAIDAS') {
              monthData.saidas[titulo] = Math.abs(valor);
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
          lucroBruto: monthData.lucroBruto,
          outrasEntradasInfo: monthData.outrasEntradasInfo
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
        currentSection = 'OUTRAS_ENTRADAS'; // Seção para capturar entradas informativas
      } else if (up.includes('SAÍDAS:') || up.includes('SAIDAS:')) {
        currentSection = 'SAIDAS';
      } else if (up.includes('TOTAL SAÍDAS') || up.includes('TOTAL SAIDAS')) {
        monthsData[currentMonth].totalSaidas = Math.abs(amt);
        currentSection = '';
      } else if (up.includes('SALDO FIM')) {
        monthsData[currentMonth].saldoFinal = amt;
        currentSection = 'LUCRO_INICIAL'; // Após saldo final, começam as linhas de lucro inicial
      } else if (currentSection === 'LUCRO_INICIAL' && up.includes('LUCRO INICIAL') && !up.includes('PROV')) {
        // Este é o valor final do Lucro Inicial - fecha a seção
        monthsData[currentMonth].lucroInicial = amt;
        currentSection = 'LUCRO_BRUTO'; // Após lucro inicial, começam as linhas de lucro bruto
      } else if (currentSection === 'LUCRO_INICIAL' && cat && cat.trim()) {
        // Captura QUALQUER linha entre SALDO FIM e LUCRO INICIAL
        if (amt !== 0) {
          if (!monthsData[currentMonth].detalhesLucroInicial) monthsData[currentMonth].detalhesLucroInicial = {};
          monthsData[currentMonth].detalhesLucroInicial[cat] = amt;
          console.log('Detalhe Lucro Inicial (dinâmico - Caso 2):', cat, amt);
        }
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
        } else if (currentSection === 'OUTRAS_ENTRADAS') {
          // Captura dinâmica de outras entradas entre TOTAL ENTRADAS e SAÍDAS
          if (!monthsData[currentMonth].outrasEntradasInfo) monthsData[currentMonth].outrasEntradasInfo = {};
          monthsData[currentMonth].outrasEntradasInfo[cat] = amt;
          console.log('Outras Entradas (dinâmico - Caso 2):', cat, amt);
        } else if (currentSection === 'SAIDAS') {
          monthsData[currentMonth].saidas[cat] = Math.abs(amt);
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
    const pageHeight = doc.internal.pageSize.height;
    const marginBottom = 25;
    let yPosition = 20;

    // Sistema de proteção de seções - verifica se há espaço suficiente
    const ensureSpace = (neededHeight: number): void => {
      if (yPosition + neededHeight > pageHeight - marginBottom) {
        doc.addPage();
        yPosition = 20;
      }
    };

    // Estima altura de uma seção
    const estimateHeight = (itemsCount: number, hasHeader = true, hasExtra = 0): number => {
      const headerHeight = hasHeader ? 12 : 0;
      const lineHeight = 7;
      const padding = 5;
      return headerHeight + (itemsCount * lineHeight) + padding + hasExtra;
    };

    // Adiciona cabeçalho de seção colorido
    const addSectionHeader = (title: string, color: [number, number, number]): void => {
      doc.setFillColor(...color);
      doc.roundedRect(10, yPosition, pageWidth - 20, 10, 2, 2, 'F');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(title, 14, yPosition + 7);
      yPosition += 14;
    };

    // Adiciona linha de item
    const addLine = (label: string, value: number | string, indent = 0, textColor: [number, number, number] = [55, 65, 81], isBold = false): void => {
      doc.setFontSize(isBold ? 10 : 9);
      doc.setTextColor(...textColor);
      if (isBold) doc.setFont('helvetica', 'bold');
      else doc.setFont('helvetica', 'normal');
      doc.text(label, 14 + indent, yPosition);
      const valueStr = typeof value === 'number' ? formatCurrency(value) : value;
      doc.text(valueStr, pageWidth - 14, yPosition, { align: 'right' });
      yPosition += 6;
    };

    // Adiciona box destacado para totais importantes
    const addTotalBox = (label: string, value: number, bgColor: [number, number, number], textColor: [number, number, number]): void => {
      ensureSpace(16);
      doc.setFillColor(...bgColor);
      doc.roundedRect(14, yPosition - 2, pageWidth - 28, 12, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'bold');
      doc.text(label, 18, yPosition + 5);
      doc.text(formatCurrency(value), pageWidth - 18, yPosition + 5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      yPosition += 14;
    };

    // Adiciona separador
    const addSeparator = (): void => {
      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPosition, pageWidth - 14, yPosition);
      yPosition += 4;
    };

    // ========================
    // TÍTULO DO RELATÓRIO
    // ========================
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Fluxo de Caixa', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.setFontSize(12);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedMonth || 'Período', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // ========================
    // 1. SALDO INICIAL
    // ========================
    ensureSpace(estimateHeight(1));
    addSectionHeader('Saldo Inicial', [59, 130, 246]);
    addLine('Valor disponível no início do período', cashFlowData.saldoInicial, 0, [30, 64, 175], true);
    yPosition += 4;

    // ========================
    // 2. ENTRADAS
    // ========================
    const entradasCount = Object.keys(cashFlowData.entradas).length;
    const despesasCount = Object.keys(cashFlowData.despesasVendas).length;
    const outrasEntradasCount = cashFlowData.outrasEntradasInfo ? Object.keys(cashFlowData.outrasEntradasInfo).length : 0;
    const entradasHeight = estimateHeight(entradasCount + despesasCount + 6, true, outrasEntradasCount > 0 ? 40 : 0);
    
    ensureSpace(Math.min(entradasHeight, 120)); // Limita para evitar página vazia
    addSectionHeader('Entradas', [34, 197, 94]);
    
    // Lista de entradas
    Object.entries(cashFlowData.entradas).forEach(([key, value]) => {
      ensureSpace(8);
      addLine(`+ ${key}`, value, 2, [21, 128, 61]);
    });

    // Despesas sobre Vendas
    if (despesasCount > 0) {
      yPosition += 2;
      addSeparator();
      doc.setFontSize(9);
      doc.setTextColor(161, 98, 7);
      doc.setFont('helvetica', 'bold');
      doc.text('Despesas sobre Vendas:', 14, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 6;
      
      Object.entries(cashFlowData.despesasVendas).forEach(([key, value]) => {
        ensureSpace(8);
        addLine(`- ${key}`, value, 4, [161, 98, 7]);
      });
    }

    // Subtotais
    yPosition += 2;
    addSeparator();
    ensureSpace(30);
    addLine('Subtotal Entradas Brutas', cashFlowData.totalEntradasBrutas, 2, [21, 128, 61]);
    addLine('Subtotal Despesas sobre Vendas', cashFlowData.totalDespesasVendas, 2, [161, 98, 7]);
    yPosition += 2;
    
    // Total Entradas Líquidas (box destacado)
    addTotalBox('TOTAL DE ENTRADAS LÍQUIDAS', cashFlowData.totalEntradas, [220, 252, 231], [21, 128, 61]);

    // Outras Entradas (Informativo)
    if (cashFlowData.outrasEntradasInfo && outrasEntradasCount > 0) {
      ensureSpace(estimateHeight(outrasEntradasCount + 2));
      addSeparator();
      doc.setFillColor(219, 234, 254);
      doc.roundedRect(14, yPosition - 2, pageWidth - 28, estimateHeight(outrasEntradasCount + 1, false, 10), 2, 2, 'F');
      yPosition += 2;
      doc.setFontSize(9);
      doc.setTextColor(29, 78, 216);
      doc.setFont('helvetica', 'bold');
      doc.text('Outras Entradas (Informativo)', 18, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 6;
      
      Object.entries(cashFlowData.outrasEntradasInfo).forEach(([key, value]) => {
        addLine(key, value, 4, [29, 78, 216]);
      });
      
      doc.setFontSize(7);
      doc.setTextColor(96, 165, 250);
      doc.text('* Valores apenas para consulta, não somados ao total', 18, yPosition);
      yPosition += 8;
    }
    yPosition += 4;

    // ========================
    // 3. SAÍDAS
    // ========================
    const saidasCount = Object.keys(cashFlowData.saidas).length;
    ensureSpace(estimateHeight(saidasCount + 2));
    addSectionHeader('Saídas', [239, 68, 68]);
    
    Object.entries(cashFlowData.saidas).forEach(([key, value]) => {
      ensureSpace(8);
      addLine(`- ${key}`, value, 2, [185, 28, 28]);
    });
    
    yPosition += 2;
    addTotalBox('TOTAL DE SAÍDAS', cashFlowData.totalSaidas, [254, 226, 226], [185, 28, 28]);
    yPosition += 4;

    // ========================
    // 4. SALDO FINAL
    // ========================
    ensureSpace(25);
    const saldoPositivo = cashFlowData.saldoFinal >= 0;
    addSectionHeader('Saldo Final', saldoPositivo ? [16, 185, 129] : [249, 115, 22]);
    addLine('Resultado final do período', cashFlowData.saldoFinal, 0, saldoPositivo ? [5, 150, 105] : [194, 65, 12], true);
    yPosition += 6;

    // ========================
    // 5. RESUMO DO PERÍODO
    // ========================
    ensureSpace(50);
    addSectionHeader('Resumo do Período', [99, 102, 241]);
    
    // Grid de 3 colunas
    const colWidth = (pageWidth - 40) / 3;
    const startX = 14;
    const boxHeight = 28;
    
    // Entradas
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(startX, yPosition, colWidth - 4, boxHeight, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61);
    doc.text('Total Entradas', startX + (colWidth - 4) / 2, yPosition + 8, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(cashFlowData.totalEntradas), startX + (colWidth - 4) / 2, yPosition + 18, { align: 'center' });
    
    // Saídas
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(startX + colWidth, yPosition, colWidth - 4, boxHeight, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Saídas', startX + colWidth + (colWidth - 4) / 2, yPosition + 8, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(cashFlowData.totalSaidas), startX + colWidth + (colWidth - 4) / 2, yPosition + 18, { align: 'center' });
    
    // Resultado
    const resultado = cashFlowData.totalEntradas - cashFlowData.totalSaidas;
    const resultadoPositivo = resultado >= 0;
    doc.setFillColor(resultadoPositivo ? 219 : 254, resultadoPositivo ? 234 : 215, resultadoPositivo ? 254 : 170);
    doc.roundedRect(startX + colWidth * 2, yPosition, colWidth - 4, boxHeight, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(resultadoPositivo ? 67 : 194, resultadoPositivo ? 56 : 65, resultadoPositivo ? 202 : 12);
    doc.setFont('helvetica', 'normal');
    doc.text('Resultado', startX + colWidth * 2 + (colWidth - 4) / 2, yPosition + 8, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(resultado), startX + colWidth * 2 + (colWidth - 4) / 2, yPosition + 18, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    yPosition += boxHeight + 8;

    // ========================
    // 6. LUCRO INICIAL
    // ========================
    if (cashFlowData.lucroInicial !== undefined && cashFlowData.lucroInicial !== 0) {
      const detalhesCount = cashFlowData.detalhesLucroInicial ? Object.keys(cashFlowData.detalhesLucroInicial).length : 0;
      ensureSpace(estimateHeight(detalhesCount + 5));
      addSectionHeader('Lucro Inicial', [6, 182, 212]);
      
      addLine('Saldo Final', cashFlowData.saldoFinal, 2, [8, 145, 178]);
      
      // Exibir TODOS os detalhes com indicador de soma/subtração
      if (cashFlowData.detalhesLucroInicial) {
        Object.entries(cashFlowData.detalhesLucroInicial).forEach(([key, value]) => {
          ensureSpace(8);
          const isPositive = value >= 0;
          const prefix = isPositive ? '+ ' : '- ';
          const displayValue = Math.abs(value);
          const color: [number, number, number] = isPositive ? [22, 163, 74] : [220, 38, 38];
          addLine(prefix + key, displayValue, 2, color);
        });
      }
      
      addSeparator();
      yPosition += 2;
      addTotalBox('= LUCRO INICIAL', cashFlowData.lucroInicial, [207, 250, 254], [8, 145, 178]);
      yPosition += 4;
    }

    // ========================
    // 7. XP INVESTIMENTO (com cálculo detalhado)
    // ========================
    if (cashFlowData.aplicacoes && Object.keys(cashFlowData.aplicacoes).length > 0) {
      const provisoesLucroBrutoCount = cashFlowData.provisoesLucroBruto ? Object.keys(cashFlowData.provisoesLucroBruto).length : 0;
      ensureSpace(estimateHeight(provisoesLucroBrutoCount + 8));
      addSectionHeader('XP Investimento', [14, 165, 233]);
      
      // Cálculo detalhado
      if (cashFlowData.lucroInicial !== undefined && cashFlowData.lucroInicial !== 0) {
        doc.setFillColor(224, 242, 254);
        const calcBoxHeight = estimateHeight(provisoesLucroBrutoCount + 4, false, 15);
        doc.roundedRect(14, yPosition - 2, pageWidth - 28, calcBoxHeight, 2, 2, 'F');
        yPosition += 2;
        
        doc.setFontSize(9);
        doc.setTextColor(3, 105, 161);
        doc.setFont('helvetica', 'bold');
        doc.text('Cálculo Base XP (10%)', 18, yPosition);
        doc.setFont('helvetica', 'normal');
        yPosition += 7;
        
        addLine('Lucro Inicial', cashFlowData.lucroInicial, 4, [3, 105, 161]);
        
        let totalProvisoes = 0;
        if (cashFlowData.provisoesLucroBruto) {
          Object.entries(cashFlowData.provisoesLucroBruto).forEach(([key, val]) => {
            totalProvisoes += val;
            addLine(`- ${key}`, -val, 4, [185, 28, 28]);
          });
        }
        
        const baseCalculo = cashFlowData.lucroInicial - totalProvisoes;
        const xp10 = baseCalculo * 0.1;
        
        addSeparator();
        addLine('Base de Cálculo', baseCalculo, 4, [3, 105, 161], true);
        addLine('XP Investimento (10%)', xp10, 4, [3, 105, 161], true);
        yPosition += 4;
      }
      
      // Lista de aplicações
      Object.entries(cashFlowData.aplicacoes).forEach(([key, value]) => {
        ensureSpace(8);
        addLine(key, value, 2, [14, 165, 233]);
      });
      yPosition += 6;
    }

    // ========================
    // 8. LUCRO BRUTO (com memória de cálculo)
    // ========================
    if (cashFlowData.lucroBruto !== undefined && cashFlowData.lucroBruto !== 0) {
      ensureSpace(50);
      addSectionHeader('Lucro Bruto', [99, 102, 241]);
      
      // Memória de cálculo
      doc.setFillColor(224, 231, 255);
      doc.roundedRect(14, yPosition - 2, pageWidth - 28, 45, 2, 2, 'F');
      yPosition += 2;
      
      doc.setFontSize(9);
      doc.setTextColor(67, 56, 202);
      doc.setFont('helvetica', 'bold');
      doc.text('Memória de Cálculo', 18, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 7;
      
      let totalProvisoes = 0;
      if (cashFlowData.provisoesLucroBruto) {
        totalProvisoes = Object.values(cashFlowData.provisoesLucroBruto).reduce((acc, val) => acc + val, 0);
      }
      const baseCalculo = (cashFlowData.lucroInicial || 0) - totalProvisoes;
      const xpInvestimento = baseCalculo * 0.1;
      const lucroBrutoCalc = baseCalculo - xpInvestimento;
      
      addLine('Base de Cálculo', baseCalculo, 4, [67, 56, 202]);
      addLine('- XP Investimento (10%)', -xpInvestimento, 4, [185, 28, 28]);
      addSeparator();
      addLine('LUCRO BRUTO', lucroBrutoCalc, 4, [67, 56, 202], true);
      yPosition += 8;
    }

    // ========================
    // 9. PROVISÕES
    // ========================
    if (cashFlowData.provisoes && Object.keys(cashFlowData.provisoes).length > 0) {
      const provisoesCount = Object.keys(cashFlowData.provisoes).length;
      ensureSpace(estimateHeight(provisoesCount + 2));
      addSectionHeader('Provisões', [168, 85, 247]);
      
      let totalProvisoes = 0;
      Object.entries(cashFlowData.provisoes).forEach(([key, value]) => {
        ensureSpace(8);
        totalProvisoes += value;
        addLine(`- ${key}`, value, 2, [126, 34, 206]);
      });
      
      yPosition += 2;
      addTotalBox('TOTAL PROVISÕES', totalProvisoes, [243, 232, 255], [126, 34, 206]);
      yPosition += 4;
    }

    // ========================
    // 10. LUCRO LÍQUIDO (com divisão por sócia)
    // ========================
    if (cashFlowData.lucroLiquido !== undefined && cashFlowData.lucroLiquido !== 0) {
      ensureSpace(50);
      const lucroPositivo = cashFlowData.lucroLiquido >= 0;
      addSectionHeader('Lucro Líquido', lucroPositivo ? [20, 184, 166] : [239, 68, 68]);
      
      addLine('Resultado final após todas provisões', cashFlowData.lucroLiquido, 0, lucroPositivo ? [13, 148, 136] : [185, 28, 28], true);
      
      // Divisão por sócia
      yPosition += 4;
      doc.setFillColor(lucroPositivo ? 204 : 254, lucroPositivo ? 251 : 226, lucroPositivo ? 241 : 226);
      doc.roundedRect(14, yPosition - 2, pageWidth - 28, 22, 2, 2, 'F');
      yPosition += 4;
      
      doc.setFontSize(8);
      doc.setTextColor(lucroPositivo ? 17 : 185, lucroPositivo ? 94 : 28, lucroPositivo ? 89 : 28);
      doc.text('Divisão por Sócia (3 sócias)', 18, yPosition);
      yPosition += 6;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Valor por Sócia:', 18, yPosition);
      doc.text(formatCurrency(cashFlowData.lucroLiquido / 3), pageWidth - 18, yPosition, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      yPosition += 10;
    }

    // ========================
    // RODAPÉ
    // ========================
    const pageCount = doc.getNumberOfPages();
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Página ${i} de ${pageCount} - ${selectedMonth || 'Período'}`,
        pageWidth / 2,
        pageHeight - 12,
        { align: 'center' }
      );
      doc.text(
        `Gerado em ${dateStr} às ${timeStr}`,
        pageWidth / 2,
        pageHeight - 7,
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
                  
                  {/* Outras Entradas - Informativo */}
                  {cashFlowData.outrasEntradasInfo && Object.keys(cashFlowData.outrasEntradasInfo).length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Outras Entradas (Informativo)
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(cashFlowData.outrasEntradasInfo).map(([key, value]) => (
                            <div 
                              key={key} 
                              className="flex items-center justify-between p-2 bg-white/70 rounded-lg"
                            >
                              <span className="text-sm font-medium text-blue-600">{key}</span>
                              <span className="text-base font-semibold text-blue-800">
                                {formatCurrency(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-blue-500 mt-3 italic">
                          * Valores apenas para consulta, não somados ao total
                        </p>
                      </div>
                    </>
                  )}
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
                    {/* Saldo Final como base */}
                    <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-cyan-200">
                      <span className="font-medium text-cyan-700">Saldo Final</span>
                      <span className="text-lg font-bold text-cyan-800">
                        {formatCurrency(cashFlowData.saldoFinal)}
                      </span>
                    </div>
                    
                    {/* Exibir TODOS os detalhes com indicador de soma/subtração */}
                    {cashFlowData.detalhesLucroInicial && Object.entries(cashFlowData.detalhesLucroInicial).map(([key, value]) => (
                      <div 
                        key={key} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          value >= 0 
                            ? 'bg-green-50/50 border-green-200' 
                            : 'bg-red-50/50 border-red-200'
                        }`}
                      >
                        <span className={`font-medium flex items-center gap-2 ${value >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {value >= 0 ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                          {key}
                        </span>
                        <span className={`text-lg font-bold ${value >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                          {value >= 0 ? '+' : ''}{formatCurrency(value)}
                        </span>
                      </div>
                    ))}
                    
                    {/* Separador e Total */}
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between p-3 bg-cyan-200/50 rounded-lg border-2 border-cyan-400">
                      <span className="font-bold text-cyan-900">= LUCRO INICIAL</span>
                      <span className="text-xl font-bold text-cyan-900">
                        {formatCurrency(cashFlowData.lucroInicial)}
                      </span>
                    </div>
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
            <Collapsible defaultOpen={false}>
              <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100">
                <CollapsibleTrigger className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between w-full group">
                      <CardTitle className="flex items-center gap-2 text-indigo-800">
                        <BarChart3 className="h-5 w-5" />
                        Lucro Bruto
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-indigo-800">
                          {(() => {
                            const totalProvisoes = cashFlowData.provisoesLucroBruto 
                              ? Object.values(cashFlowData.provisoesLucroBruto).reduce((acc, val) => acc + val, 0)
                              : 0;
                            const baseCalculo = cashFlowData.lucroInicial - totalProvisoes;
                            const xpInvestimento = baseCalculo * 0.1;
                            return formatCurrency(baseCalculo - xpInvestimento);
                          })()}
                        </span>
                        <ChevronDown className="h-5 w-5 text-indigo-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-4 space-y-2">
                      <h5 className="font-semibold text-indigo-900 mb-3">Memória de Cálculo</h5>
                      
                      {/* Base de Cálculo */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-indigo-700">Base de Cálculo</span>
                        <span className="font-bold text-indigo-900">
                          {(() => {
                            const totalProvisoes = cashFlowData.provisoesLucroBruto 
                              ? Object.values(cashFlowData.provisoesLucroBruto).reduce((acc, val) => acc + val, 0)
                              : 0;
                            return formatCurrency(cashFlowData.lucroInicial - totalProvisoes);
                          })()}
                        </span>
                      </div>
                      
                      {/* XP Investimento */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-red-600">- XP Investimento (10%)</span>
                        <span className="font-medium text-red-700">
                          -{(() => {
                            const totalProvisoes = cashFlowData.provisoesLucroBruto 
                              ? Object.values(cashFlowData.provisoesLucroBruto).reduce((acc, val) => acc + val, 0)
                              : 0;
                            const baseCalculo = cashFlowData.lucroInicial - totalProvisoes;
                            return formatCurrency(baseCalculo * 0.1);
                          })()}
                        </span>
                      </div>
                      
                      {/* Lucro Bruto */}
                      <Separator className="my-2" />
                      <div className="flex items-center justify-between pt-2 border-t-2 border-indigo-300">
                        <span className="font-bold text-indigo-900">Lucro Bruto</span>
                        <span className="text-lg font-bold text-indigo-900">
                          {(() => {
                            const totalProvisoes = cashFlowData.provisoesLucroBruto 
                              ? Object.values(cashFlowData.provisoesLucroBruto).reduce((acc, val) => acc + val, 0)
                              : 0;
                            const baseCalculo = cashFlowData.lucroInicial - totalProvisoes;
                            const xpInvestimento = baseCalculo * 0.1;
                            return formatCurrency(baseCalculo - xpInvestimento);
                          })()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
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