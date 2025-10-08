import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { TrendingUp, Search, Filter, RefreshCw, Calendar, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface IgorRecord {
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

interface IgorExpense {
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

const Igor = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [igorData, setIgorData] = useState<IgorRecord[]>([]);
  const [igorExpenses, setIgorExpenses] = useState<IgorExpense[]>([]);
  const [taxData, setTaxData] = useState<{ taxPercentage: number; month: string; year: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openCategories, setOpenCategories] = useState<{ [key: string]: boolean }>({});
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [revenuesOpen, setRevenuesOpen] = useState(false);
  const { toast } = useToast();

  // Load Igor data from Google Sheets
  const loadIgorData = async () => {
    setIsLoading(true);
    try {
      const dreData = await GoogleSheetsService.fetchDREData();
      
      // Filter only rows with "IGOR" in column G (extraDetail1)
      const igorRows = dreData.filter((row: any) =>
        (row.extraDetail1 || '').toString().toUpperCase().includes('IGOR')
      );

      // Separate revenues (ENTRADAS) and expenses (SAÍDAS)
      const igorRevenues = igorRows
        .filter((r: any) => (r.type || '').toUpperCase() === 'RECEITA')
        .map((r: any) => ({
          id: r.id,
          description: r.description || 'Sem descrição',
          details: r.details || 'Sem detalhes',
          amount: Math.abs(r.amount) || 0,
          month: r.month || '',
          year: r.year || '',
          date: r.date || '',
          extraDetail1: r.extraDetail1 || '',
          extraDetail2: r.extraDetail2 || ''
        }));
      
      const igorExpensesFiltered = igorRows
        .filter((r: any) => (r.type || '').toUpperCase() === 'DESPESA' && !((r.sourceType || '').toUpperCase().includes('05-IMPOSTOS')))
        .map((r: any) => ({
          id: r.id,
          description: r.description || 'Sem descrição',
          details: r.details || 'Sem detalhes',
          amount: Math.abs(r.amount) || 0,
          month: r.month || '',
          year: r.year || '',
          date: r.date || '',
          extraDetail1: r.extraDetail1 || '',
          extraDetail2: r.extraDetail2 || ''
        }));
      
      // Try to get specific tax percentage for IGOR from DRE (row with 05-IMPOSTOS)
      let taxInfo: { taxPercentage: number; month: string; year: string } | null = null;
      const taxRow = igorRows.find((r: any) => (r.sourceType || '').toUpperCase().includes('05-IMPOSTOS'));
      if (taxRow) {
        taxInfo = {
          taxPercentage: Math.abs(taxRow.amount) || 12.89269,
          month: taxRow.month || '',
          year: taxRow.year || ''
        };
      }
      
      console.log('Igor revenues loaded:', igorRevenues);
      console.log('Igor expenses loaded:', igorExpensesFiltered);
      console.log('Tax (Igor) data:', taxInfo);
      
      setIgorData(igorRevenues);
      setIgorExpenses(igorExpensesFiltered);
      setTaxData(taxInfo);
      
      toast({
        title: "Dados Igor carregados!",
        description: `${igorRevenues.length} receitas e ${igorExpensesFiltered.length} despesas encontradas`,
      });
    } catch (error) {
      console.error('Error loading Igor data:', error);
      setIgorData([]);
      setIgorExpenses([]);
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
    loadIgorData();
  }, []);

  // Get available months and years
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    igorData.forEach(record => {
      if (record.month) {
        const month = record.month.padStart(2, '0');
        months.add(month);
      }
    });
    return Array.from(months).sort();
  }, [igorData]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    igorData.forEach(record => {
      if (record.year) {
        years.add(record.year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [igorData]);

  const monthNames: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  };

  // Filter and process data
  const processedData = useMemo(() => {
    let filteredData = igorData;

    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredData = igorData.filter(record => {
        const monthMatches = selectedMonth === 'all' || record.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || record.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }

    // Group by description
    const grouped: { [key: string]: IgorRecord[] } = {};
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
      }, {} as { [key: string]: IgorRecord[] });

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
    
    // Calculate Igor expenses (filtered by month/year)
    let filteredExpenses = igorExpenses;
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredExpenses = igorExpenses.filter(expense => {
        const monthMatches = selectedMonth === 'all' || expense.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || expense.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }
    
    // Group expenses by description (column B) and then by details (column C)
    const groupedExpenses: { [key: string]: IgorExpense[] } = {};
    filteredExpenses.forEach(expense => {
      const key = expense.description || 'Sem descrição';
      if (!groupedExpenses[key]) {
        groupedExpenses[key] = [];
      }
      groupedExpenses[key].push(expense);
    });
    
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Revenue after tax and expenses (NO consultant commissions)
    const revenueAfterTaxAndExpenses = total - taxAmount - totalExpenses;
    
    // Calculate Igor commission (3% of revenue after tax and expenses)
    const igorCommission = revenueAfterTaxAndExpenses * 0.03;

    return { 
      grouped: sortedGrouped, 
      total, 
      taxAmount, 
      taxPercentage, 
      totalExpenses,
      groupedExpenses,
      revenueAfterTaxAndExpenses,
      igorCommission,
      count: filteredData.length,
      expensesCount: filteredExpenses.length
    };
  }, [igorData, igorExpenses, selectedMonth, selectedYear, taxData]);

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
    if (igorData.length === 0) {
      loadIgorData();
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
    doc.text('Relatorio Igor', pageWidth / 2, yPosition, { align: 'center' });
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
    doc.text('RECEITAS BRUTAS IGOR', 20, yPosition);
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
    if (processedData.totalExpenses > 0) {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68); // red
      doc.text('DESPESAS IGOR', 20, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Total: ${formatCurrency(processedData.totalExpenses)}`, 25, yPosition);
      yPosition += 8;

      // Regular expenses
      doc.setFontSize(9);
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

    // Igor Commission
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 179, 8); // yellow
    doc.text('COMISSAO IGOR (3%)', 20, yPosition);
    yPosition += 7;

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(formatCurrency(processedData.igorCommission), 25, yPosition);

    // Save PDF
    const fileName = selectedMonth !== 'all' || selectedYear !== 'all'
      ? `relatorio-igor-${selectedMonth !== 'all' ? monthNames[selectedMonth] : 'todos'}-${selectedYear !== 'all' ? selectedYear : 'todos'}.pdf`
      : 'relatorio-igor-completo.pdf';
    doc.save(fileName);

    toast({
      title: "PDF Gerado!",
      description: `O relatório foi salvo como ${fileName}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Igor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>
                      {monthNames[month] || month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os anos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {isLoading ? 'Carregando...' : 'Buscar'}
              </Button>
              <Button onClick={handleClearFilters} variant="outline">
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {processedData.count > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Receitas Brutas Igor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(processedData.total)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {processedData.count} registro(s)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Impostos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(processedData.taxAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {processedData.taxPercentage.toFixed(2)}% do total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Despesas Igor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(processedData.totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {processedData.expensesCount} despesa(s)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Receitas Líquidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(processedData.revenueAfterTaxAndExpenses)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Igor Commission Card */}
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-yellow-600" />
                  Comissão Igor (3%)
                </div>
                <Button onClick={generatePDF} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Gerar PDF
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {formatCurrency(processedData.igorCommission)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Calculado sobre as receitas líquidas após impostos e despesas
              </p>
            </CardContent>
          </Card>

          {/* Detailed Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Revenues Section */}
              <div className="space-y-2">
                <button
                  onClick={() => setRevenuesOpen(!revenuesOpen)}
                  className="w-full flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-700">Receitas por Categoria</span>
                    <Badge variant="secondary">{Object.keys(processedData.grouped).length}</Badge>
                  </div>
                  {revenuesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                {revenuesOpen && (
                  <div className="pl-4 space-y-3 border-l-2 border-green-200">
                    {Object.entries(processedData.grouped).map(([category, records]) => {
                      const categoryTotal = records.reduce((sum, r) => sum + r.amount, 0);
                      const isOpen = openCategories[category];
                      
                      return (
                        <div key={category} className="space-y-2">
                          <button
                            onClick={() => toggleCategory(category)}
                            className="w-full flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{category}</span>
                              <Badge variant="outline" className="text-xs">
                                {records.length}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-green-600">
                                {formatCurrency(categoryTotal)}
                              </span>
                              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </div>
                          </button>
                          
                          {isOpen && (
                            <div className="pl-4 space-y-1">
                              {records.map((record, index) => (
                                <div key={index} className="flex justify-between items-center text-sm py-1 px-2 hover:bg-gray-50 rounded">
                                  <span className="text-muted-foreground">{record.details}</span>
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
              </div>

              {/* Expenses Section */}
              {processedData.totalExpenses > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => setExpensesOpen(!expensesOpen)}
                    className="w-full flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-red-700">Despesas</span>
                      <Badge variant="secondary">
                        {processedData.expensesCount}
                      </Badge>
                    </div>
                    {expensesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  
                  {expensesOpen && (
                    <div className="pl-4 space-y-3 border-l-2 border-red-200">
                      <div className="space-y-2">
                        {Object.entries(processedData.groupedExpenses)
                          .flatMap(([category, expenses]) =>
                            expenses.map((expense, index) => ({
                              ...expense,
                              category,
                              key: `${category}-${index}`
                            }))
                          )
                          .sort((a, b) => b.amount - a.amount)
                          .map((expense) => (
                            <div key={expense.key} className="flex justify-between items-center text-sm py-1 px-2 hover:bg-gray-50 rounded">
                              <span className="text-muted-foreground">
                                {expense.category} - {expense.details}
                              </span>
                              <span className="font-medium text-red-600">{formatCurrency(expense.amount)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {processedData.count === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro com "Igor" encontrado para os filtros selecionados.</p>
              <p className="text-xs mt-2">Certifique-se de que há receitas ou despesas com "Igor" no nome na planilha.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50 animate-spin" />
              <p>Carregando dados Igor...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Igor;
