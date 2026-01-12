import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatCurrentDate } from '@/utils/dateUtils';
import { Search, Filter, RefreshCw, Calendar, Users, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const Consultoras = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [consultantData, setConsultantData] = useState<ConsultantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stellaOpen, setStellaOpen] = useState(false);
  const [stephanieOpen, setStephanieOpen] = useState(false);
  const { toast } = useToast();

  // Commission rate for consultants
  const COMMISSION_RATE = 0.03; // 3%

  // Load consultant data from Google Sheets
  const loadConsultantData = async () => {
    setIsLoading(true);
    try {
      const data = await GoogleSheetsService.fetchConsultantData();
      
      console.log('Consultant data loaded:', data);
      
      setConsultantData(data);
      
      toast({
        title: "Dados de consultoras carregados!",
        description: `${data.length} registros encontrados`,
      });
    } catch (error) {
      console.error('Error loading consultant data:', error);
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

  // Auto-load data when component mounts
  useEffect(() => {
    if (consultantData.length === 0) {
      loadConsultantData();
    }
  }, []);

  // Get available months and years
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    consultantData.forEach(record => {
      if (record.month) {
        const month = record.month.padStart(2, '0');
        months.add(month);
      }
    });
    return Array.from(months).sort();
  }, [consultantData]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    consultantData.forEach(record => {
      if (record.year) {
        years.add(record.year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [consultantData]);

  const monthNames: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  };

  // Filter and process data
  const processedData = useMemo(() => {
    let filteredData = consultantData;

    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      filteredData = consultantData.filter(record => {
        const monthMatches = selectedMonth === 'all' || record.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || record.year === selectedYear;
        return monthMatches && yearMatches;
      });
    }

    // Group by consultant name and calculate commissions
    const consultantSummary: { [key: string]: { total: number; commission: number; records: ConsultantRecord[] } } = {};
    
    filteredData.forEach(record => {
      const name = record.consultantName || 'Sem nome';
      if (!consultantSummary[name]) {
        consultantSummary[name] = { total: 0, commission: 0, records: [] };
      }
      consultantSummary[name].total += record.amount;
      consultantSummary[name].records.push(record);
    });

    // Calculate commissions (3% of total)
    Object.keys(consultantSummary).forEach(name => {
      consultantSummary[name].commission = consultantSummary[name].total * COMMISSION_RATE;
    });

    // Separate Stella and Stephanie
    const stella = consultantSummary['STELLA'] || { total: 0, commission: 0, records: [] };
    const stephanie = consultantSummary['STHEPHANIE'] || { total: 0, commission: 0, records: [] };

    return {
      stella,
      stephanie,
      allConsultants: consultantSummary,
      totalRecords: filteredData.length
    };
  }, [consultantData, selectedMonth, selectedYear]);

  const handleSearch = () => {
    setHasSearched(true);
    if (consultantData.length === 0) {
      loadConsultantData();
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
    doc.text('Relatório de Comissões - Consultoras', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Period info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodText = selectedMonth !== 'all' || selectedYear !== 'all' 
      ? `Período: ${selectedMonth !== 'all' ? monthNames[selectedMonth] : 'Todos os meses'} ${selectedYear !== 'all' ? selectedYear : ''}`
      : 'Período: Todos';
    doc.text(periodText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Stella Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246); // blue
    doc.text('STELLA', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Total de Vendas: ${formatCurrency(processedData.stella.total)}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Comissão (3%): ${formatCurrency(processedData.stella.commission)}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Registros: ${processedData.stella.records.length}`, 20, yPosition);
    yPosition += 10;

    // Stella records
    if (processedData.stella.records.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalhamento:', 25, yPosition);
      yPosition += 5;
      
      doc.setFont('helvetica', 'normal');
      processedData.stella.records.forEach((record, index) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`• ${record.date || 'Sem data'} | ${record.customerName} | ${record.product}`, 30, yPosition);
        yPosition += 4;
        doc.text(`  ${formatCurrency(record.amount)}`, 35, yPosition);
        yPosition += 6;
      });
    }

    yPosition += 10;

    // Stephanie Section
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(139, 92, 246); // purple
    doc.text('STHEPHANIE', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Total de Vendas: ${formatCurrency(processedData.stephanie.total)}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Comissão (3%): ${formatCurrency(processedData.stephanie.commission)}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Registros: ${processedData.stephanie.records.length}`, 20, yPosition);
    yPosition += 10;

    // Stephanie records
    if (processedData.stephanie.records.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalhamento:', 25, yPosition);
      yPosition += 5;
      
      doc.setFont('helvetica', 'normal');
      processedData.stephanie.records.forEach((record, index) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`• ${record.date || 'Sem data'} | ${record.customerName} | ${record.product}`, 30, yPosition);
        yPosition += 4;
        doc.text(`  ${formatCurrency(record.amount)}`, 35, yPosition);
        yPosition += 6;
      });
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text(`Gerado em ${formatCurrentDate()}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    doc.save(`comissoes_consultoras_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF gerado!",
      description: "O relatório foi baixado com sucesso.",
    });
  };

  const generateIndividualPDF = (consultantName: 'STELLA' | 'STHEPHANIE') => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    const data = consultantName === 'STELLA' ? processedData.stella : processedData.stephanie;
    const color: [number, number, number] = consultantName === 'STELLA' ? [59, 130, 246] : [139, 92, 246];

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório de Comissões - ${consultantName}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Period info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodText = selectedMonth !== 'all' || selectedYear !== 'all' 
      ? `Período: ${selectedMonth !== 'all' ? monthNames[selectedMonth] : 'Todos os meses'} ${selectedYear !== 'all' ? selectedYear : ''}`
      : 'Período: Todos';
    doc.text(periodText, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Summary box
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(15, yPosition - 5, pageWidth - 30, 30, 3, 3, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Total de Vendas: ${formatCurrency(data.total)}`, 20, yPosition + 5);
    doc.text(`Comissão (3%): ${formatCurrency(data.commission)}`, 20, yPosition + 13);
    doc.text(`Total de Registros: ${data.records.length}`, 20, yPosition + 21);
    yPosition += 35;

    // Group records by course/product
    const recordsByCourse: { [curso: string]: ConsultantRecord[] } = {};
    data.records.forEach(record => {
      const curso = record.product || 'Sem Curso';
      if (!recordsByCourse[curso]) {
        recordsByCourse[curso] = [];
      }
      recordsByCourse[curso].push(record);
    });

    // Sort courses alphabetically
    const sortedCourses = Object.keys(recordsByCourse).sort();

    // Generate table for each course
    sortedCourses.forEach((curso) => {
      const records = recordsByCourse[curso];
      
      // Check if we need a new page for the course title
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }

      // Course title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(`📚 ${curso}`, 15, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 3;

      // Table with autoTable
      autoTable(doc, {
        startY: yPosition,
        head: [['Data', 'Cliente', 'Valor']],
        body: records.map(r => [
          r.date || 'Sem data',
          r.customerName || 'Sem nome',
          formatCurrency(r.amount)
        ]),
        theme: 'striped',
        headStyles: { 
          fillColor: color,
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left'
        },
        bodyStyles: { 
          fontSize: 9,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 35, halign: 'right' }
        },
        margin: { left: 15, right: 15 },
        tableWidth: 'auto',
      });

      yPosition = (doc as any).lastAutoTable.finalY + 12;
    });

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text(`Gerado em ${formatCurrentDate()}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
    }

    doc.save(`comissao_${consultantName.toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF gerado!",
      description: `Relatório de ${consultantName} baixado com sucesso.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Consultoras
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

              {consultantData.length > 0 && (
                <Button variant="outline" onClick={loadConsultantData} disabled={isLoading}>
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
        <div className="flex justify-end gap-2">
          <Button onClick={generatePDF} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Gerar PDF Completo
          </Button>
          <Button onClick={() => generateIndividualPDF('STELLA')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
            <Download className="h-4 w-4" />
            PDF Stella
          </Button>
          <Button onClick={() => generateIndividualPDF('STHEPHANIE')} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
            <Download className="h-4 w-4" />
            PDF Stephanie
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      {hasSearched && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Stella Card */}
          <Card className="border-blue-300 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-900">
                  <Users className="h-5 w-5" />
                  STELLA
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStellaOpen(!stellaOpen)}
                  className="text-blue-900 hover:bg-blue-200"
                >
                  {stellaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-800">Total de Vendas</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency(processedData.stella.total)}
                </p>
              </div>
              <div className="border-t border-blue-300 pt-3">
                <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg border border-green-300">
                  <p className="text-sm font-medium text-green-800">
                    Comissão (3%)
                  </p>
                  <p className="text-xl font-bold text-green-900">
                    {formatCurrency(processedData.stella.commission)}
                  </p>
                </div>
              </div>
              <div className="text-xs text-blue-900 font-medium">
                {processedData.stella.records.length} registro{processedData.stella.records.length !== 1 ? 's' : ''}
              </div>

              {/* Stella Records Detail */}
              {stellaOpen && processedData.stella.records.length > 0 && (
                <div className="mt-4 space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-300 max-h-96 overflow-y-auto">
                  <p className="text-sm font-semibold text-blue-900 mb-3">Detalhamento:</p>
                  {(() => {
                    let accumulatedCommission = 0;
                    return processedData.stella.records
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((record) => {
                        const commission = record.amount * COMMISSION_RATE;
                        accumulatedCommission += commission;
                        return (
                          <div key={record.id} className="bg-white p-3 rounded-lg border border-blue-300 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex flex-col flex-1">
                                <span className="font-semibold text-blue-900">{record.customerName}</span>
                                <span className="text-sm text-blue-800 mt-1">{record.product}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-lg text-blue-900">{formatCurrency(record.amount)}</span>
                                <span className="text-xs text-green-800 font-semibold mt-1">Comissão 3%: {formatCurrency(commission)}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200">
                              {record.date && (
                                <div className="flex items-center gap-2 text-xs text-blue-800">
                                  <Calendar className="h-3 w-3" />
                                  <span>Data: {record.date}</span>
                                </div>
                              )}
                              <div className="text-xs font-semibold text-green-900 bg-green-100 px-2 py-1 rounded border border-green-300">
                                Acumulado: {formatCurrency(accumulatedCommission)}
                              </div>
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stephanie Card */}
          <Card className="border-purple-300 bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-900">
                  <Users className="h-5 w-5" />
                  STHEPHANIE
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStephanieOpen(!stephanieOpen)}
                  className="text-purple-900 hover:bg-purple-200"
                >
                  {stephanieOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-purple-800">Total de Vendas</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatCurrency(processedData.stephanie.total)}
                </p>
              </div>
              <div className="border-t border-purple-300 pt-3">
                <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg border border-green-300">
                  <p className="text-sm font-medium text-green-800">
                    Comissão (3%)
                  </p>
                  <p className="text-xl font-bold text-green-900">
                    {formatCurrency(processedData.stephanie.commission)}
                  </p>
                </div>
              </div>
              <div className="text-xs text-purple-900 font-medium">
                {processedData.stephanie.records.length} registro{processedData.stephanie.records.length !== 1 ? 's' : ''}
              </div>

              {/* Stephanie Records Detail */}
              {stephanieOpen && processedData.stephanie.records.length > 0 && (
                <div className="mt-4 space-y-3 bg-purple-50 p-4 rounded-lg border border-purple-300 max-h-96 overflow-y-auto">
                  <p className="text-sm font-semibold text-purple-900 mb-3">Detalhamento:</p>
                  {(() => {
                    let accumulatedCommission = 0;
                    return processedData.stephanie.records
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((record) => {
                        const commission = record.amount * COMMISSION_RATE;
                        accumulatedCommission += commission;
                        return (
                          <div key={record.id} className="bg-white p-3 rounded-lg border border-purple-300 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex flex-col flex-1">
                                <span className="font-semibold text-purple-900">{record.customerName}</span>
                                <span className="text-sm text-purple-800 mt-1">{record.product}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-lg text-purple-900">{formatCurrency(record.amount)}</span>
                                <span className="text-xs text-green-800 font-semibold mt-1">Comissão 3%: {formatCurrency(commission)}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-200">
                              {record.date && (
                                <div className="flex items-center gap-2 text-xs text-purple-800">
                                  <Calendar className="h-3 w-3" />
                                  <span>Data: {record.date}</span>
                                </div>
                              )}
                              <div className="text-xs font-semibold text-green-900 bg-green-100 px-2 py-1 rounded border border-green-300">
                                Acumulado: {formatCurrency(accumulatedCommission)}
                              </div>
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Consultoras;
