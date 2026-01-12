import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatCurrentDate } from '@/utils/dateUtils';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  FileText,
  Minus,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DRENovoCursoModal, { DRENovoVenda } from './DRENovoCursoModal';

// Interfaces
interface LanceADoisReceita {
  descricao: string;
  tipo: 'entrada' | 'transitar';
  valorBruto: number;
  taxasPlataforma: number;
  impostos: number;
  valorLiquido: number;
  vendas: DRENovoVenda[];
}

interface LanceADoisSaida {
  codigo: string;
  descricao: string;
  valor: number;
}

interface ConsultantCommission {
  name: string;
  total: number;
  commission: number;
  records: {
    date: string;
    customerName: string;
    product: string;
    amount: number;
  }[];
}

interface LanceADoisDados {
  mes: string;
  ano: string;
  receitas: LanceADoisReceita[];
  taxasPlataforma: number;
  impostos: number;
  saidas: { [codigo: string]: LanceADoisSaida[] };
  comissoesConsultoras: { [name: string]: ConsultantCommission };
  totais: {
    receitaBruta: number;
    taxasPlataforma: number;
    impostos: number;
    receitaLiquida: number;
    totalSaidas: number;
    totalComissoes: number;
    resultado: number;
  };
}

interface RawDRERecord {
  id: string;
  type: string;
  description: string;
  details: string;
  amount: number;
  month: string;
  year: string;
  date: string;
  extraDetail1: string;
  extraDetail2: string;
  extraDetail3: string;
  originalAmount: number;
  sourceType: string;
}

interface ConsultantRecord {
  id: string;
  consultantName: string;
  amount: number;
  month: string;
  year: string;
  date: string;
  description: string;
  customerName: string;
  product: string;
}

const monthNames: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
};

const codigoNames: Record<string, string> = {
  '02': 'Saídas Gerais',
  '02.1': 'Pessoal',
  '02.2': 'Operacional',
  '02.3': 'Marketing',
  '02.4': 'Administrativo',
  '02.5': 'Outros',
};

const COMMISSION_RATE = 0.03; // 3%

const LanceADois: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [rawData, setRawData] = useState<RawDRERecord[]>([]);
  const [consultantData, setConsultantData] = useState<ConsultantRecord[]>([]);
  const [taxData, setTaxData] = useState<{ taxPercentage: number; month: string; year: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    receitas: true,
    saidas: true,
    comissoes: true,
  });
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCurso, setModalCurso] = useState('');
  const [modalVendas, setModalVendas] = useState<DRENovoVenda[]>([]);
  
  const { toast } = useToast();

  // Load data from Google Sheets
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [dreData, taxInfo, consultantsData] = await Promise.all([
        GoogleSheetsService.fetchDREData(),
        GoogleSheetsService.fetchLanceADoisTaxData(),
        GoogleSheetsService.fetchConsultantData()
      ]);
      
      console.log('Lance a Dois - DRE data loaded:', dreData.length, 'records');
      console.log('Tax data loaded:', taxInfo);
      console.log('Consultant data loaded:', consultantsData);
      
      setRawData(dreData);
      setTaxData(taxInfo || []);
      setConsultantData(consultantsData);
      
      toast({
        title: "Dados carregados!",
        description: `${dreData.length} registros carregados`,
      });
    } catch (error) {
      console.error('Error loading Lance a Dois data:', error);
      setRawData([]);
      setTaxData([]);
      setConsultantData([]);
      toast({
        title: "Erro ao carregar dados",
        description: "Falha ao conectar com a Página2 da planilha.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load on mount
  useEffect(() => {
    if (rawData.length === 0) {
      loadData();
    }
  }, []);

  // Available months and years
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    rawData.forEach(record => {
      if (record.month && record.extraDetail3?.toUpperCase().includes('LANCE A DOIS')) {
        months.add(record.month.padStart(2, '0'));
      }
    });
    return Array.from(months).sort();
  }, [rawData]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    rawData.forEach(record => {
      if (record.year && record.extraDetail3?.toUpperCase().includes('LANCE A DOIS')) {
        years.add(record.year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [rawData]);

  // Process data into Lance a Dois structure
  const processedData = useMemo((): LanceADoisDados => {
    // Filter only LANCE A DOIS records
    let filteredData = rawData.filter(record => 
      record.extraDetail3?.toUpperCase().includes('LANCE A DOIS')
    );

    // Apply month/year filters
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredData = filteredData.filter(record => {
        const monthMatches = selectedMonth === 'all' || record.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || record.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }

    console.log('Lance a Dois - Filtered data:', filteredData.length, 'records');

    // Helper to normalize text
    const normalize = (s?: string) => (s || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Check sourceType (column A)
    const getSourceType = (record: RawDRERecord) => normalize(record.sourceType || '');

    // Separate records by type based on column A codes
    const entradasRecords = filteredData.filter(r => {
      const st = getSourceType(r);
      return st.startsWith('01') && !st.includes('TRANSITAR') && !st.includes('01.02');
    });

    const transitarRecords = filteredData.filter(r => {
      const st = getSourceType(r);
      return st.includes('TRANSITAR') || st.includes('01-TRANSITAR');
    });

    const taxaRecords = filteredData.filter(r => {
      const st = getSourceType(r);
      return st.includes('01.02') || st.includes('TAXA');
    });

    const saidasRecords = filteredData.filter(r => {
      const st = getSourceType(r);
      return st.startsWith('02') || st.includes('SAIDA');
    });

    console.log('Lance a Dois - Entradas:', entradasRecords.length);
    console.log('Lance a Dois - Transitar:', transitarRecords.length);
    console.log('Lance a Dois - Taxas:', taxaRecords.length);
    console.log('Lance a Dois - Saídas:', saidasRecords.length);

    // Calculate total platform fees (01.02-TAXAS)
    const totalTaxasPlataforma = taxaRecords.reduce((s, r) => s + Math.abs(r.amount), 0);

    // Calculate total bruto for tax distribution
    const totalBrutoEntradas = entradasRecords.reduce((s, r) => s + r.amount, 0);
    const totalBrutoTransitar = transitarRecords.reduce((s, r) => s + r.amount, 0);
    const totalBruto = totalBrutoEntradas + totalBrutoTransitar;
    const taxaPercentual = totalBruto > 0 ? totalTaxasPlataforma / totalBruto : 0;

    // Get tax percentage for impostos
    const matchingTax = taxData.find(t => {
      const monthMatches = selectedMonth === 'all' || t.month === selectedMonth;
      const yearMatches = selectedYear === 'all' || t.year === selectedYear;
      return monthMatches && yearMatches;
    });
    const impostosPercentual = matchingTax ? matchingTax.taxPercentage / 100 : 0.1289;

    // Group receitas by description (curso) - combining entradas and transitar
    const receitasMap = new Map<string, LanceADoisReceita>();

    // Process entradas
    entradasRecords.forEach(record => {
      const key = record.description || 'Sem descrição';
      const existing = receitasMap.get(key);
      
      if (existing && existing.tipo === 'entrada') {
        existing.valorBruto += record.amount;
        existing.vendas.push({
          data: record.date,
          aluno: record.details || record.extraDetail1 || '',
          formaPagamento: record.extraDetail2 || '',
          valor: record.amount,
        });
      } else {
        receitasMap.set(key, {
          descricao: key,
          tipo: 'entrada',
          valorBruto: record.amount,
          taxasPlataforma: 0,
          impostos: 0,
          valorLiquido: 0,
          vendas: [{
            data: record.date,
            aluno: record.details || record.extraDetail1 || '',
            formaPagamento: record.extraDetail2 || '',
            valor: record.amount,
          }],
        });
      }
    });

    // Process transitar
    transitarRecords.forEach(record => {
      const key = record.description || 'Sem descrição';
      const existingEntrada = receitasMap.get(key);
      const transitarKey = `${key} (Transitar)`;
      const existingTransitar = receitasMap.get(transitarKey);
      
      if (existingTransitar) {
        existingTransitar.valorBruto += record.amount;
        existingTransitar.vendas.push({
          data: record.date,
          aluno: record.details || record.extraDetail1 || '',
          formaPagamento: record.extraDetail2 || '',
          valor: record.amount,
        });
      } else {
        receitasMap.set(transitarKey, {
          descricao: key,
          tipo: 'transitar',
          valorBruto: record.amount,
          taxasPlataforma: 0,
          impostos: 0,
          valorLiquido: 0,
          vendas: [{
            data: record.date,
            aluno: record.details || record.extraDetail1 || '',
            formaPagamento: record.extraDetail2 || '',
            valor: record.amount,
          }],
        });
      }
    });

    // Apply proportional taxes and impostos to each receita
    receitasMap.forEach((receita) => {
      receita.taxasPlataforma = receita.valorBruto * taxaPercentual;
      receita.impostos = receita.valorBruto * impostosPercentual;
      receita.valorLiquido = receita.valorBruto - receita.taxasPlataforma - receita.impostos;
    });

    const receitas = Array.from(receitasMap.values()).sort((a, b) => b.valorBruto - a.valorBruto);

    // Group saídas by código (2.1, 2.2, etc.)
    const saidasByCode: { [codigo: string]: LanceADoisSaida[] } = {};
    saidasRecords.forEach(record => {
      const st = getSourceType(record);
      let codigo = '02';
      
      const codeMatch = st.match(/02\.(\d+)/);
      if (codeMatch) {
        codigo = `02.${codeMatch[1]}`;
      } else if (st.includes('PESSOAL') || record.description?.toUpperCase().includes('PESSOAL')) {
        codigo = '02.1';
      } else if (st.includes('OPERACIONAL') || record.description?.toUpperCase().includes('OPERACIONAL')) {
        codigo = '02.2';
      } else if (st.includes('MARKETING') || record.description?.toUpperCase().includes('MARKETING')) {
        codigo = '02.3';
      }

      if (!saidasByCode[codigo]) {
        saidasByCode[codigo] = [];
      }
      
      saidasByCode[codigo].push({
        codigo,
        descricao: record.description || 'Sem descrição',
        valor: Math.abs(record.amount),
      });
    });

    // Calculate consultant commissions (filtered by month/year and LANCE A DOIS)
    let filteredConsultants = consultantData;
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredConsultants = consultantData.filter(consultant => {
        const monthMatches = selectedMonth === 'all' || consultant.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || consultant.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }

    // Group consultants by name and calculate commissions
    const comissoesConsultoras: { [name: string]: ConsultantCommission } = {};
    filteredConsultants.forEach(record => {
      const name = record.consultantName || 'Sem nome';
      if (!comissoesConsultoras[name]) {
        comissoesConsultoras[name] = { 
          name, 
          total: 0, 
          commission: 0, 
          records: [] 
        };
      }
      comissoesConsultoras[name].total += record.amount;
      comissoesConsultoras[name].records.push({
        date: record.date,
        customerName: record.customerName,
        product: record.product,
        amount: record.amount,
      });
    });

    // Calculate commissions (3%)
    let totalComissoes = 0;
    Object.keys(comissoesConsultoras).forEach(name => {
      const commission = comissoesConsultoras[name].total * COMMISSION_RATE;
      comissoesConsultoras[name].commission = commission;
      totalComissoes += commission;
    });

    // Calculate totals
    const totais = {
      receitaBruta: totalBruto,
      taxasPlataforma: totalTaxasPlataforma,
      impostos: totalBruto * impostosPercentual,
      receitaLiquida: totalBruto - totalTaxasPlataforma - (totalBruto * impostosPercentual),
      totalSaidas: Object.values(saidasByCode).flat().reduce((s, item) => s + item.valor, 0),
      totalComissoes,
      resultado: 0,
    };

    totais.resultado = totais.receitaLiquida - totais.totalSaidas - totais.totalComissoes;

    return {
      mes: selectedMonth,
      ano: selectedYear,
      receitas,
      taxasPlataforma: totalTaxasPlataforma,
      impostos: totais.impostos,
      saidas: saidasByCode,
      comissoesConsultoras,
      totais,
    };
  }, [rawData, consultantData, selectedMonth, selectedYear, taxData]);

  const handleSearch = () => {
    setHasSearched(true);
    if (rawData.length === 0) {
      loadData();
    }
  };

  const handleClearFilters = () => {
    setSelectedMonth('all');
    setSelectedYear('all');
    setHasSearched(false);
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const openModal = (cursoNome: string, vendas: DRENovoVenda[]) => {
    setModalCurso(cursoNome);
    setModalVendas(vendas);
    setModalOpen(true);
  };

  const getResultColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const getResultIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4" />;
    if (value < 0) return <TrendingDown className="h-4 w-4" />;
    return <DollarSign className="h-4 w-4" />;
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Colors
    const greenColor: [number, number, number] = [34, 197, 94];
    const redColor: [number, number, number] = [239, 68, 68];
    const blueColor: [number, number, number] = [59, 130, 246];
    const purpleColor: [number, number, number] = [139, 92, 246];

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DEMONSTRATIVO LANCE A DOIS', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Period
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodText = selectedMonth !== 'all' || selectedYear !== 'all' 
      ? `${selectedMonth !== 'all' ? monthNames[selectedMonth] : 'Todos os meses'} ${selectedYear !== 'all' ? selectedYear : ''}`
      : 'Todos os períodos';
    doc.text(periodText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Summary Box
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(15, yPosition, pageWidth - 30, 50, 3, 3, 'F');
    
    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO GERAL', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const summaryData = [
      ['Receita Bruta', formatCurrency(processedData.totais.receitaBruta)],
      ['(-) Taxas Plataforma', `- ${formatCurrency(processedData.totais.taxasPlataforma)}`],
      ['(-) Impostos', `- ${formatCurrency(processedData.totais.impostos)}`],
      ['(=) Receita Líquida', formatCurrency(processedData.totais.receitaLiquida)],
      ['(-) Despesas', `- ${formatCurrency(processedData.totais.totalSaidas)}`],
      ['(-) Comissões (3%)', `- ${formatCurrency(processedData.totais.totalComissoes)}`],
    ];

    summaryData.forEach(([label, value]) => {
      doc.text(label, 25, yPosition);
      doc.text(value, pageWidth - 25, yPosition, { align: 'right' });
      yPosition += 5;
    });

    yPosition += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const resultColor = processedData.totais.resultado >= 0 ? greenColor : redColor;
    doc.setTextColor(...resultColor);
    doc.text('RESULTADO', 25, yPosition);
    doc.text(formatCurrency(processedData.totais.resultado), pageWidth - 25, yPosition, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPosition += 20;

    // Receitas Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...greenColor);
    doc.text('01 - RECEITAS BRUTAS (Por Curso)', 20, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 5;

    if (processedData.receitas.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        head: [['Curso', 'Tipo', 'Bruto', 'Taxas Plat.', 'Impostos', 'Líquido']],
        body: processedData.receitas.map(r => [
          r.descricao.substring(0, 25),
          r.tipo === 'entrada' ? 'Entrada' : 'Transitar',
          formatCurrency(r.valorBruto),
          `- ${formatCurrency(r.taxasPlataforma)}`,
          `- ${formatCurrency(r.impostos)}`,
          formatCurrency(r.valorLiquido),
        ]),
        foot: [[
          'TOTAL RECEITAS',
          '',
          formatCurrency(processedData.totais.receitaBruta),
          `- ${formatCurrency(processedData.totais.taxasPlataforma)}`,
          `- ${formatCurrency(processedData.totais.impostos)}`,
          formatCurrency(processedData.totais.receitaLiquida),
        ]],
        theme: 'striped',
        headStyles: { fillColor: greenColor, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [220, 252, 231], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        margin: { left: 15, right: 15 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 20 },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
        },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Check if need new page
    if (yPosition > 230) {
      doc.addPage();
      yPosition = 20;
    }

    // Despesas Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...redColor);
    doc.text('02 - DESPESAS (Por Categoria)', 20, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 5;

    const allExpenses = Object.entries(processedData.saidas)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([codigo, items]) => 
        items.map(item => ({
          codigo,
          categoria: codigoNames[codigo] || 'Outras',
          descricao: item.descricao,
          valor: item.valor,
        }))
      );

    if (allExpenses.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        head: [['Código', 'Categoria', 'Descrição', 'Valor']],
        body: allExpenses.map(e => [
          e.codigo,
          e.categoria,
          e.descricao.substring(0, 35),
          formatCurrency(e.valor),
        ]),
        foot: [['', '', 'TOTAL DESPESAS', formatCurrency(processedData.totais.totalSaidas)]],
        theme: 'striped',
        headStyles: { fillColor: redColor, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [254, 226, 226], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        margin: { left: 15, right: 15 },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 35 },
          2: { cellWidth: 80 },
          3: { halign: 'right' },
        },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Check if need new page
    if (yPosition > 230) {
      doc.addPage();
      yPosition = 20;
    }

    // Comissões Table
    if (Object.keys(processedData.comissoesConsultoras).length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...purpleColor);
      doc.text('COMISSÕES CONSULTORAS (3%)', 20, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 5;

      autoTable(doc, {
        startY: yPosition,
        head: [['Consultora', 'Vendas', 'Total Vendido', 'Comissão (3%)']],
        body: Object.values(processedData.comissoesConsultoras)
          .sort((a, b) => b.commission - a.commission)
          .map(c => [
            c.name,
            c.records.length.toString(),
            formatCurrency(c.total),
            formatCurrency(c.commission),
          ]),
        foot: [['', '', 'TOTAL COMISSÕES', formatCurrency(processedData.totais.totalComissoes)]],
        theme: 'striped',
        headStyles: { fillColor: purpleColor, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [237, 233, 254], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        margin: { left: 15, right: 15 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
        },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      doc.text(`Gerado em ${formatCurrentDate()}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }

    doc.save(`lance_a_dois_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF gerado!",
      description: "O relatório foi baixado com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Demonstrativo Comissões Lance a Dois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>
                      {monthNames[month] || `Mês ${month}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSearch} className="flex items-center gap-2" disabled={isLoading}>
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isLoading ? 'Carregando...' : 'Consultar'}
              </Button>
              
              {(selectedMonth !== 'all' || selectedYear !== 'all') && (
                <Button variant="outline" onClick={handleClearFilters}>
                  Limpar Filtros
                </Button>
              )}

              {rawData.length > 0 && (
                <Button variant="outline" onClick={loadData} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              )}
            </div>
          </div>

          {(selectedMonth !== 'all' || selectedYear !== 'all') && (
            <div className="mt-4 flex gap-2">
              {selectedMonth !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {monthNames[selectedMonth] || `Mês ${selectedMonth}`}
                </Badge>
              )}
              {selectedYear !== 'all' && (
                <Badge variant="secondary">
                  {selectedYear}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Button */}
      {hasSearched && (
        <div className="flex justify-end">
          <Button onClick={generatePDF} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Gerar PDF
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      {hasSearched && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Receita Líquida</p>
                  <p className="text-2xl font-bold text-green-800">
                    {formatCurrency(processedData.totais.receitaLiquida)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Após taxas e impostos
                  </p>
                </div>
                <div className="p-3 bg-green-200 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Receita Bruta</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {formatCurrency(processedData.totais.receitaBruta)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {processedData.receitas.length} curso(s)
                  </p>
                </div>
                <div className="p-3 bg-blue-200 rounded-full">
                  <DollarSign className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Taxas + Impostos</p>
                  <p className="text-2xl font-bold text-red-800">
                    - {formatCurrency(processedData.totais.taxasPlataforma + processedData.totais.impostos)}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Deduções
                  </p>
                </div>
                <div className="p-3 bg-red-200 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-2 ${processedData.totais.resultado >= 0 ? 'border-green-300 bg-gradient-to-br from-green-50 to-green-100' : 'border-red-300 bg-gradient-to-br from-red-50 to-red-100'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Resultado</p>
                  <p className={`text-2xl font-bold ${getResultColor(processedData.totais.resultado)}`}>
                    {formatCurrency(processedData.totais.resultado)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {processedData.totais.resultado >= 0 ? 'Lucro' : 'Prejuízo'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${processedData.totais.resultado >= 0 ? 'bg-green-200' : 'bg-red-200'}`}>
                  {getResultIcon(processedData.totais.resultado)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 01 - RECEITAS BRUTAS Table */}
      {hasSearched && (
        <Card>
          <Collapsible open={openSections.receitas} onOpenChange={() => toggleSection('receitas')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-5 w-5" />
                    01 - RECEITAS BRUTAS (Por Curso)
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-green-600 font-bold">
                      {formatCurrency(processedData.totais.receitaLiquida)}
                    </span>
                    {openSections.receitas ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Curso</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor Bruto</TableHead>
                        <TableHead className="text-right">Taxas Plat.</TableHead>
                        <TableHead className="text-right">Impostos</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedData.receitas.map((receita, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <button
                              onClick={() => openModal(receita.descricao, receita.vendas)}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {receita.descricao}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant={receita.tipo === 'entrada' ? 'default' : 'secondary'}>
                              {receita.tipo === 'entrada' ? 'Entrada' : 'Transitar'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(receita.valorBruto)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            -{formatCurrency(receita.taxasPlataforma)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            -{formatCurrency(receita.impostos)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-green-600">
                            {formatCurrency(receita.valorLiquido)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {processedData.receitas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhuma receita encontrada para o período selecionado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  {/* Subtotal */}
                  {processedData.receitas.length > 0 && (
                    <div className="flex items-center justify-between p-4 bg-green-50 border-t font-semibold">
                      <span>SUBTOTAL RECEITAS</span>
                      <div className="flex gap-6">
                        <span className="text-right w-24">
                          {formatCurrency(processedData.totais.receitaBruta)}
                        </span>
                        <span className="text-right w-24 text-red-600">
                          -{formatCurrency(processedData.totais.taxasPlataforma)}
                        </span>
                        <span className="text-right w-24 text-red-600">
                          -{formatCurrency(processedData.totais.impostos)}
                        </span>
                        <span className="text-right w-24 text-green-600">
                          {formatCurrency(processedData.totais.receitaLiquida)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* 02 - SAÍDAS Table */}
      {hasSearched && (
        <Card>
          <Collapsible open={openSections.saidas} onOpenChange={() => toggleSection('saidas')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-600">
                    <TrendingDown className="h-5 w-5" />
                    02 - DESPESAS
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-red-600 font-bold">
                      -{formatCurrency(processedData.totais.totalSaidas)}
                    </span>
                    {openSections.saidas ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {Object.entries(processedData.saidas)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([codigo, items]) => {
                    const subtotal = items.reduce((s, i) => s + i.valor, 0);
                    return (
                      <div key={codigo} className="border rounded-lg overflow-hidden">
                        <div className="bg-red-50 p-3 flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-600" />
                            {codigo} - {codigoNames[codigo] || 'Despesas'}
                          </span>
                          <span className="text-red-600">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                        <div className="divide-y">
                          {items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 hover:bg-muted/30">
                              <span className="text-muted-foreground pl-6 flex items-center gap-2">
                                <Minus className="h-3 w-3" />
                                {item.descricao}
                              </span>
                              <span className="font-mono">
                                {formatCurrency(item.valor)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                {Object.keys(processedData.saidas).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma despesa encontrada para o período selecionado.
                  </div>
                )}

                {/* Total Saídas */}
                {Object.keys(processedData.saidas).length > 0 && (
                  <div className="flex items-center justify-between p-4 bg-red-100 rounded-lg font-bold text-lg">
                    <span>TOTAL DESPESAS</span>
                    <span className="text-red-600">
                      -{formatCurrency(processedData.totais.totalSaidas)}
                    </span>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Comissões Consultoras */}
      {hasSearched && Object.keys(processedData.comissoesConsultoras).length > 0 && (
        <Card>
          <Collapsible open={openSections.comissoes} onOpenChange={() => toggleSection('comissoes')}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-600">
                    <Users className="h-5 w-5" />
                    COMISSÕES CONSULTORAS (3%)
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-purple-600 font-bold">
                      -{formatCurrency(processedData.totais.totalComissoes)}
                    </span>
                    {openSections.comissoes ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Consultora</TableHead>
                        <TableHead className="text-center">Vendas</TableHead>
                        <TableHead className="text-right">Total Vendido</TableHead>
                        <TableHead className="text-right">Comissão (3%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(processedData.comissoesConsultoras)
                        .sort((a, b) => b.commission - a.commission)
                        .map((consultora, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{consultora.name}</TableCell>
                            <TableCell className="text-center">{consultora.records.length}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(consultora.total)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-purple-600">
                              {formatCurrency(consultora.commission)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  
                  <div className="flex items-center justify-between p-4 bg-purple-50 border-t font-semibold">
                    <span>TOTAL COMISSÕES</span>
                    <span className="text-purple-600">
                      {formatCurrency(processedData.totais.totalComissoes)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Resultado Final */}
      {hasSearched && (
        <Card className={`border-2 ${processedData.totais.resultado >= 0 ? 'border-green-400' : 'border-red-400'}`}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-lg">
                <span className="text-muted-foreground">Receita Líquida</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(processedData.totais.receitaLiquida)}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-lg">
                <span className="text-muted-foreground">(-) Total Despesas</span>
                <span className="font-semibold text-red-600">
                  -{formatCurrency(processedData.totais.totalSaidas)}
                </span>
              </div>

              <div className="flex items-center justify-between text-lg">
                <span className="text-muted-foreground">(-) Comissões (3%)</span>
                <span className="font-semibold text-purple-600">
                  -{formatCurrency(processedData.totais.totalComissoes)}
                </span>
              </div>

              <div className="border-t-2 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xl font-bold">
                    {getResultIcon(processedData.totais.resultado)}
                    <span>RESULTADO</span>
                  </div>
                  <span className={`text-3xl font-bold ${getResultColor(processedData.totais.resultado)}`}>
                    {formatCurrency(processedData.totais.resultado)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {processedData.totais.resultado >= 0 
                    ? 'Lucro no período selecionado' 
                    : 'Prejuízo no período selecionado'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Initial State */}
      {!hasSearched && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Demonstrativo Lance a Dois</h3>
                <p className="text-muted-foreground mt-1">
                  Selecione um período e clique em "Consultar" para visualizar o demonstrativo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <DRENovoCursoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        cursoNome={modalCurso}
        vendas={modalVendas}
      />
    </div>
  );
};

export default LanceADois;
