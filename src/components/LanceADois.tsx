import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatCurrentDate } from '@/utils/dateUtils';
import { TrendingUp, Search, Filter, RefreshCw, Calendar, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface LanceADoisRecord {
  id: string;
  description: string;
  details: string;
  amount: number;
  month: string;
  year: string;
  date: string;
  extraDetail1: string;
  extraDetail2: string;
}

interface LanceADoisExpense {
  id: string;
  description: string;
  details: string;
  amount: number;
  month: string;
  year: string;
  date: string;
  extraDetail1: string;
  extraDetail2: string;
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

const LanceADois = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [lanceData, setLanceData] = useState<LanceADoisRecord[]>([]);
  const [lanceExpenses, setLanceExpenses] = useState<LanceADoisExpense[]>([]);
  const [consultantData, setConsultantData] = useState<ConsultantRecord[]>([]);
  const [taxData, setTaxData] = useState<{ taxPercentage: number; month: string; year: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openCategories, setOpenCategories] = useState<{ [key: string]: boolean }>({});
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [revenuesOpen, setRevenuesOpen] = useState(false);
  const [commissionsOpen, setCommissionsOpen] = useState(false);
  const { toast } = useToast();

  // Commission rate for consultants
  const COMMISSION_RATE = 0.03; // 3%

  // Load Lance a Dois data from Google Sheets
  const loadLanceADoisData = async () => {
    setIsLoading(true);
    try {
      const [lanceDataResult, taxInfo, consultantsData] = await Promise.all([
        GoogleSheetsService.fetchLanceADoisData(),
        GoogleSheetsService.fetchLanceADoisTaxData(),
        GoogleSheetsService.fetchConsultantData()
      ]);
      
      console.log('Lance a Dois data loaded:', lanceDataResult);
      console.log('Tax data loaded:', taxInfo);
      console.log('Consultant data loaded:', consultantsData);
      
      setLanceData(lanceDataResult.revenues);
      setLanceExpenses(lanceDataResult.expenses);
      setConsultantData(consultantsData);
      setTaxData(taxInfo);
      
      toast({
        title: "Dados Lance a Dois carregados!",
        description: `${lanceDataResult.revenues.length} receitas, ${lanceDataResult.expenses.length} despesas e ${consultantsData.length} comissões encontradas`,
      });
    } catch (error) {
      console.error('Error loading Lance a Dois data:', error);
      setLanceData([]);
      setLanceExpenses([]);
      setConsultantData([]);
      setTaxData(null);
      toast({
        title: "Erro ao carregar dados",
        description: "Falha ao conectar com a Página2 da planilha.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load data when component mounts
  useEffect(() => {
    if (lanceData.length === 0) {
      loadLanceADoisData();
    }
  }, []);

  // Get available months and years
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    lanceData.forEach(record => {
      if (record.month) {
        const month = record.month.padStart(2, '0');
        months.add(month);
      }
    });
    return Array.from(months).sort();
  }, [lanceData]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    lanceData.forEach(record => {
      if (record.year) {
        years.add(record.year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [lanceData]);

  const monthNames: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  };

  // Filter and process data
  const processedData = useMemo(() => {
    let filteredData = lanceData;

    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredData = lanceData.filter(record => {
        const monthMatches = selectedMonth === 'all' || record.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || record.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }

    // Group by description
    const grouped: { [key: string]: LanceADoisRecord[] } = {};
    filteredData.forEach(record => {
      const key = record.description || 'Sem descrição';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(record);
    });

    // Sort groups by total amount (descending)
    const sortedGrouped = Object.entries(grouped)
      .map(([category, records]) => ({
        category,
        records,
        total: records.reduce((sum, r) => sum + r.amount, 0)
      }))
      .sort((a, b) => b.total - a.total)
      .reduce((acc, item) => {
        acc[item.category] = item.records;
        return acc;
      }, {} as { [key: string]: LanceADoisRecord[] });

    const total = filteredData.reduce((sum, record) => sum + record.amount, 0);

    // Calculate taxes based on filtered data
    let taxAmount = 0;
    let taxPercentage = 12.89269; // Default tax percentage
    
    if (taxData && taxData.taxPercentage > 0) {
      taxPercentage = taxData.taxPercentage;
    }
    
    // If filters are applied, apply tax only if the tax month/year matches the filter
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      if (taxData) {
        const taxMonthMatches = selectedMonth === 'all' || taxData.month === selectedMonth;
        const taxYearMatches = selectedYear === 'all' || taxData.year === selectedYear;
        
        if (taxMonthMatches && taxYearMatches) {
          taxAmount = total * (taxPercentage / 100);
        }
      } else {
        // No tax data from sheet, apply default percentage
        taxAmount = total * (taxPercentage / 100);
      }
    } else {
      // No filters, apply tax to total
      taxAmount = total * (taxPercentage / 100);
    }
    
    // Calculate Lance a Dois expenses (filtered by month/year)
    let filteredExpenses = lanceExpenses;
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredExpenses = lanceExpenses.filter(expense => {
        const monthMatches = selectedMonth === 'all' || expense.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || expense.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }
    
    // Group expenses by description (column B) and then by details (column C)
    const groupedExpenses: { [key: string]: LanceADoisExpense[] } = {};
    filteredExpenses.forEach(expense => {
      const key = expense.description || 'Sem descrição';
      if (!groupedExpenses[key]) {
        groupedExpenses[key] = [];
      }
      groupedExpenses[key].push(expense);
    });
    
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Calculate consultant commissions (filtered by month/year)
    let filteredConsultants = consultantData;
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredConsultants = consultantData.filter(consultant => {
        const monthMatches = selectedMonth === 'all' || consultant.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || consultant.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }
    
    // Group consultants by name and calculate commissions
    const consultantCommissions: { [key: string]: { total: number; commission: number; records: ConsultantRecord[] } } = {};
    filteredConsultants.forEach(record => {
      const name = record.consultantName || 'Sem nome';
      if (!consultantCommissions[name]) {
        consultantCommissions[name] = { total: 0, commission: 0, records: [] };
      }
      consultantCommissions[name].total += record.amount;
      consultantCommissions[name].records.push(record);
    });
    
    // Calculate total commissions (3% of total sales per consultant)
    let totalConsultantCommissions = 0;
    Object.keys(consultantCommissions).forEach(name => {
      const commission = consultantCommissions[name].total * COMMISSION_RATE;
      consultantCommissions[name].commission = commission;
      totalConsultantCommissions += commission;
    });
    
    // Revenue after tax, expenses, and consultant commissions
    const revenueAfterTaxAndExpenses = total - taxAmount - totalExpenses - totalConsultantCommissions;
    
    // Calculate Lance a Dois commission (10% of revenue after tax and expenses)
    const lanceADoisCommission = revenueAfterTaxAndExpenses * 0.10;

    return { 
      grouped: sortedGrouped, 
      total, 
      taxAmount, 
      taxPercentage, 
      totalExpenses,
      groupedExpenses,
      totalConsultantCommissions,
      consultantCommissions,
      revenueAfterTaxAndExpenses,
      lanceADoisCommission,
      count: filteredData.length,
      expensesCount: filteredExpenses.length,
      consultantsCount: filteredConsultants.length
    };
  }, [lanceData, lanceExpenses, consultantData, selectedMonth, selectedYear, taxData]);

  // Initialize open state for all categories (all closed by default)
  useEffect(() => {
    const initialState: { [key: string]: boolean } = {};
    Object.keys(processedData.grouped).forEach(key => {
      initialState[key] = false; // All closed by default
    });
    setOpenCategories(initialState);
  }, [processedData.grouped]);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSearch = () => {
    setHasSearched(true);
    if (lanceData.length === 0) {
      loadLanceADoisData();
    }
  };

  const handleClearFilters = () => {
    setSelectedMonth('all');
    setSelectedYear('all');
    setHasSearched(false);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatorio Lance a Dois', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Period info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodText = selectedMonth !== 'all' || selectedYear !== 'all' 
      ? `Periodo: ${selectedMonth !== 'all' ? monthNames[selectedMonth] : 'Todos os meses'} ${selectedYear !== 'all' ? selectedYear : ''}`
      : 'Periodo: Todos';
    doc.text(periodText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Gross Revenue Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94); // green
    doc.text('RECEITAS BRUTAS LANCE A DOIS', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(12);
    doc.text(`Total: ${formatCurrency(processedData.total)}`, 20, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`${processedData.count} registro(s) - ${Object.keys(processedData.grouped).length} categoria(s)`, 20, yPosition);
    yPosition += 10;

    // Revenue breakdown by category
    Object.entries(processedData.grouped).forEach(([category, records]) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }

      const categoryTotal = records.reduce((sum, r) => sum + r.amount, 0);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${category}:`, 25, yPosition);
      doc.text(formatCurrency(categoryTotal), pageWidth - 25, yPosition, { align: 'right' });
      yPosition += 6;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      records.forEach((record) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`- ${record.details}`, 30, yPosition);
        doc.text(formatCurrency(record.amount), pageWidth - 30, yPosition, { align: 'right' });
        yPosition += 4;
      });
      yPosition += 4;
    });

    yPosition += 5;

    // Taxes Section
    if (processedData.taxAmount > 0) {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68); // red
      doc.text('IMPOSTOS', 20, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`${processedData.taxPercentage.toFixed(2)}%: ${formatCurrency(processedData.taxAmount)}`, 25, yPosition);
      yPosition += 10;
    }

    // Expenses Section
    if (processedData.totalExpenses > 0 || processedData.totalConsultantCommissions > 0) {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68); // red
      doc.text('DESPESAS LANCE A DOIS', 20, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Total: ${formatCurrency(processedData.totalExpenses + processedData.totalConsultantCommissions)}`, 25, yPosition);
      yPosition += 8;

      // Regular expenses
      if (processedData.totalExpenses > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Despesas Gerais:', 25, yPosition);
        yPosition += 5;

        doc.setFont('helvetica', 'normal');
        Object.entries(processedData.groupedExpenses)
          .flatMap(([category, expenses]) =>
            expenses.map((expense) => ({
              ...expense,
              category
            }))
          )
          .sort((a, b) => b.amount - a.amount)
          .forEach((expense) => {
            if (yPosition > pageHeight - 20) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(`- ${expense.category} (${expense.details})`, 30, yPosition);
            doc.text(formatCurrency(expense.amount), pageWidth - 30, yPosition, { align: 'right' });
            yPosition += 5;
          });
        yPosition += 3;
      }

      // Consultant commissions
      if (processedData.totalConsultantCommissions > 0) {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Comissoes Consultoras (3%):', 25, yPosition);
        doc.text(formatCurrency(processedData.totalConsultantCommissions), pageWidth - 30, yPosition, { align: 'right' });
        yPosition += 5;

        doc.setFont('helvetica', 'normal');
        Object.entries(processedData.consultantCommissions)
          .sort(([, a], [, b]) => b.commission - a.commission)
          .forEach(([name, data]) => {
            if (yPosition > pageHeight - 20) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(`- ${name} (${data.records.length} venda(s))`, 30, yPosition);
            doc.text(formatCurrency(data.commission), pageWidth - 30, yPosition, { align: 'right' });
            yPosition += 5;
          });
        yPosition += 3;
      }
    }

    yPosition += 5;

    // Net Revenue Section
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94); // green
    doc.text('RECEITAS LIQUIDAS', 20, yPosition);
    yPosition += 7;

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(formatCurrency(processedData.revenueAfterTaxAndExpenses), 25, yPosition);
    yPosition += 10;

    // Lance a Dois Commission
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 179, 8); // yellow
    doc.text('COMISSAO LANCE A DOIS (10%)', 20, yPosition);
    yPosition += 7;

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(formatCurrency(processedData.lanceADoisCommission), 25, yPosition);

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Pagina ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text(`Gerado em ${formatCurrentDate()}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    doc.save(`lance_a_dois_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF gerado!",
      description: "O relatorio foi baixado com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Lance a Dois
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

              {lanceData.length > 0 && (
                <Button variant="outline" onClick={loadLanceADoisData} disabled={isLoading}>
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

      {/* Action Buttons */}
      {hasSearched && (
        <div className="flex justify-end">
          <Button onClick={generatePDF} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Gerar PDF
          </Button>
        </div>
      )}

      {/* Summary Card */}
      {hasSearched && (
        <Card className="border-success/30 bg-gradient-to-br from-success/5 via-success/10 to-success/15 shadow-lg">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-success/10 p-3 rounded-lg transition-all"
                onClick={() => setRevenuesOpen(!revenuesOpen)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {revenuesOpen ? (
                      <ChevronUp className="h-5 w-5 text-success" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-success" />
                    )}
                    <p className="text-sm font-medium text-success">Receitas Brutas Lance a Dois</p>
                  </div>
                  <p className="text-3xl font-bold text-success mt-2 ml-7">
                    {formatCurrency(processedData.total)}
                  </p>
                  <p className="text-xs text-success/70 mt-2 ml-7">
                    {processedData.count} registro{processedData.count !== 1 ? 's' : ''} • {Object.keys(processedData.grouped).length} categoria{Object.keys(processedData.grouped).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-4 bg-success/20 rounded-full">
                  <TrendingUp className="h-8 w-8 text-success" />
                </div>
              </div>

              {revenuesOpen && (
                <div className="ml-7 space-y-2 bg-success/5 p-4 rounded-lg border border-success/20 max-h-96 overflow-y-auto">
                  {Object.entries(processedData.grouped).map(([category, records]) => {
                    const categoryTotal = records.reduce((sum, r) => sum + r.amount, 0);
                    const isOpen = openCategories[category];
                    
                    return (
                      <div key={category} className="border-l-2 border-success/40 pl-3">
                        <div 
                          className="flex items-center justify-between mb-1 cursor-pointer hover:bg-success/10 p-2 rounded-lg transition-all"
                          onClick={() => toggleCategory(category)}
                        >
                          <div className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4 text-success" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-success" />
                            )}
                            <p className="font-medium text-sm text-success">{category}</p>
                            <Badge variant="secondary" className="text-xs bg-success/10 text-success border-success/20">
                              {records.length}
                            </Badge>
                          </div>
                          <p className="font-semibold text-success">{formatCurrency(categoryTotal)}</p>
                        </div>
                        
                        {isOpen && (
                          <div className="space-y-1 ml-6 mt-2">
                            {records.map((record) => (
                              <div key={record.id} className="flex items-center justify-between text-xs text-success/80 py-1">
                                <div className="flex flex-col">
                                  <span className="font-medium">{record.details}</span>
                                  {record.date && (
                                    <span className="text-[10px] text-success/60">{record.date}</span>
                                  )}
                                </div>
                                <span className="font-medium">{formatCurrency(record.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {processedData.taxAmount > 0 && (
                <>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between p-2 bg-destructive/5 rounded-lg">
                      <p className="text-sm font-medium text-destructive">
                        Impostos ({processedData.taxPercentage.toFixed(2)}%)
                      </p>
                      <p className="text-lg font-semibold text-destructive">
                        - {formatCurrency(processedData.taxAmount)}
                      </p>
                    </div>
                  </div>

                  {(processedData.totalExpenses > 0 || processedData.totalConsultantCommissions > 0) && (
                    <div className="border-t border-border pt-3">
                      <div 
                        className="flex items-center justify-between cursor-pointer hover:bg-destructive/10 p-3 rounded-lg transition-all bg-destructive/5"
                        onClick={() => setExpensesOpen(!expensesOpen)}
                      >
                        <div className="flex items-center gap-2">
                          {expensesOpen ? (
                            <ChevronUp className="h-4 w-4 text-destructive" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-destructive" />
                          )}
                          <p className="text-sm font-medium text-destructive">
                            Despesas Lance a Dois ({processedData.expensesCount + (processedData.consultantsCount > 0 ? 1 : 0)} categoria{processedData.expensesCount + (processedData.consultantsCount > 0 ? 1 : 0) !== 1 ? 's' : ''})
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-destructive">
                          - {formatCurrency(processedData.totalExpenses + processedData.totalConsultantCommissions)}
                        </p>
                      </div>
                      
                      {expensesOpen && (
                        <div className="mt-2 ml-6 space-y-3 bg-destructive/5 p-3 rounded-lg border border-destructive/20">
                          {/* Regular Expenses */}
                          {processedData.totalExpenses > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-destructive/70 mb-2">Despesas Gerais:</p>
                              {Object.entries(processedData.groupedExpenses)
                                .flatMap(([category, expenses]) =>
                                  expenses.map((expense) => ({
                                    ...expense,
                                    category
                                  }))
                                )
                                .sort((a, b) => b.amount - a.amount)
                                .map((expense) => (
                                  <div key={expense.id} className="flex items-center justify-between text-sm text-destructive/90 py-1">
                                    <span className="font-medium">{expense.category} ({expense.details})</span>
                                    <span className="font-semibold">{formatCurrency(expense.amount)}</span>
                                  </div>
                                ))
                              }
                            </div>
                          )}
                          
                          {/* Consultant Commissions */}
                          {processedData.totalConsultantCommissions > 0 && (
                            <div className="space-y-1 pt-3 border-t border-destructive/20">
                              <div 
                                className="flex items-center justify-between cursor-pointer hover:bg-destructive/10 p-2 rounded-lg transition-all"
                                onClick={() => setCommissionsOpen(!commissionsOpen)}
                              >
                                <div className="flex items-center gap-2">
                                  {commissionsOpen ? (
                                    <ChevronUp className="h-3 w-3 text-destructive" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 text-destructive" />
                                  )}
                                  <span className="text-xs font-semibold text-destructive/70">
                                    Comissões Consultoras (3%):
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-destructive">
                                  {formatCurrency(processedData.totalConsultantCommissions)}
                                </span>
                              </div>
                              
                              {commissionsOpen && (
                                <div className="ml-4 space-y-1">
                                  {Object.entries(processedData.consultantCommissions)
                                    .sort(([, a], [, b]) => b.commission - a.commission)
                                    .map(([name, data]) => (
                                      <div key={name} className="flex items-center justify-between text-sm text-destructive/90 py-1">
                                        <span className="font-medium">{name} ({data.records.length} venda{data.records.length !== 1 ? 's' : ''})</span>
                                        <span className="font-semibold">{formatCurrency(data.commission)}</span>
                                      </div>
                                    ))
                                  }
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t-2 border-success/30 pt-3">
                    <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                      <p className="text-sm font-medium text-success">Receitas Líquidas</p>
                      <p className="text-xl font-bold text-success">
                        {formatCurrency(processedData.revenueAfterTaxAndExpenses)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between p-2 bg-warning/5 rounded-lg">
                      <p className="text-sm font-medium text-warning">
                        Comissão Lance a Dois (10%)
                      </p>
                      <p className="text-lg font-semibold text-warning">
                        - {formatCurrency(processedData.lanceADoisCommission)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LanceADois;
