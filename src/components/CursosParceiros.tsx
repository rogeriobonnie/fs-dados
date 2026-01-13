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
  DollarSign, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Users,
  Percent,
  BookOpen
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interfaces
interface VendaDetalhe {
  data: string;
  aluno: string;
  valor: number;
  vendedor: string;
}

interface TaxaDetalhe {
  data: string;
  descricao: string;
  valor: number;
}

interface CursoParceiro {
  nome: string;
  vendas: VendaDetalhe[];
  valorBruto: number;
  taxasPlataforma: number;
  taxasDetalhadas: TaxaDetalhe[];
  aliquotaImposto: number;
  impostos: number;
  valorLiquido: number;
  comissaoStella: number;
  comissaoFS: number;
  valorFinal: number;
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

const monthNames: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
};

const STELLA_COMMISSION_RATE = 0.03; // 3% - Comissão Stella
const FS_COMMISSION_RATE = 0.10; // 10% - Comissão FS sobre líquido

const CursosParceiros: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [rawData, setRawData] = useState<RawDRERecord[]>([]);
  const [taxData, setTaxData] = useState<{ taxPercentage: number; month: string; year: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openCursos, setOpenCursos] = useState<Record<string, boolean>>({});
  
  const { toast } = useToast();

  // Load data from Google Sheets
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [dreData, taxInfo] = await Promise.all([
        GoogleSheetsService.fetchDREData(),
        GoogleSheetsService.fetchLanceADoisTaxData(),
      ]);
      
      console.log('Cursos Parceiros - DRE data loaded:', dreData.length, 'records');
      console.log('Tax data loaded:', taxInfo);
      
      setRawData(dreData);
      setTaxData(taxInfo || []);
      
      toast({
        title: "Dados carregados!",
        description: `${dreData.length} registros carregados`,
      });
    } catch (error) {
      console.error('Error loading Cursos Parceiros data:', error);
      setRawData([]);
      setTaxData([]);
      toast({
        title: "Erro ao carregar dados",
        description: "Falha ao conectar com a planilha.",
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

  // Helper to normalize text
  const normalize = (s?: string) => (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Available months and years from TRANSITAR records
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    rawData.forEach(record => {
      const st = normalize(record.sourceType);
      if (record.month && (st.includes('TRANSITAR') || st.includes('01-TRANSITAR'))) {
        months.add(record.month.padStart(2, '0'));
      }
    });
    return Array.from(months).sort();
  }, [rawData]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    rawData.forEach(record => {
      const st = normalize(record.sourceType);
      if (record.year && (st.includes('TRANSITAR') || st.includes('01-TRANSITAR'))) {
        years.add(record.year);
      }
    });
    return Array.from(years).sort().reverse();
  }, [rawData]);

  // Get tax percentage for selected month/year
  const getTaxPercentage = (month: string, year: string): number => {
    const taxRecord = taxData.find(t => t.month === month && t.year === year);
    return taxRecord?.taxPercentage || 6; // Default 6% if not found
  };

  // Process data into Cursos Parceiros structure
  const processedData = useMemo((): { cursos: CursoParceiro[], totais: {
    valorBruto: number;
    taxasPlataforma: number;
    impostos: number;
    valorLiquido: number;
    comissaoStella: number;
    comissaoFS: number;
    valorFinal: number;
  }} => {
    // Filter TRANSITAR records
    let transitarRecords = rawData.filter(record => {
      const st = normalize(record.sourceType);
      return st.includes('TRANSITAR') || st.includes('01-TRANSITAR');
    });

    // Filter TAXA records
    let taxaRecords = rawData.filter(record => {
      const st = normalize(record.sourceType);
      return st.includes('01.02') || st.includes('TAXA');
    });

    // Apply month/year filters
    if (selectedMonth !== 'all' || selectedYear !== 'all') {
      const filterByDate = (record: RawDRERecord) => {
        const monthMatches = selectedMonth === 'all' || record.month === selectedMonth;
        const yearMatches = selectedYear === 'all' || record.year === selectedYear;
        return monthMatches && yearMatches;
      };
      transitarRecords = transitarRecords.filter(filterByDate);
      taxaRecords = taxaRecords.filter(filterByDate);
    }

    console.log('Transitar records:', transitarRecords.length);
    console.log('Taxa records for matching:', taxaRecords.length);

    // Get tax percentage for the period
    const aliquotaImposto = selectedMonth !== 'all' && selectedYear !== 'all' 
      ? getTaxPercentage(selectedMonth, selectedYear)
      : 6; // Default 6%

    // Group transitar by course name (description)
    const cursosMap = new Map<string, CursoParceiro>();
    
    transitarRecords.forEach(record => {
      const key = record.description || 'Sem descrição';
      const existing = cursosMap.get(key);
      
      // Check if seller is STELLA (column I = extraDetail1 in some cases)
      const vendedor = (record.extraDetail1 || '').toUpperCase();
      
      if (existing) {
        existing.valorBruto += record.amount;
        existing.vendas.push({
          data: record.date,
          aluno: record.details || '',
          valor: record.amount,
          vendedor: vendedor,
        });
      } else {
        cursosMap.set(key, {
          nome: key,
          vendas: [{
            data: record.date,
            aluno: record.details || '',
            valor: record.amount,
            vendedor: vendedor,
          }],
          valorBruto: record.amount,
          taxasPlataforma: 0,
          taxasDetalhadas: [],
          aliquotaImposto: aliquotaImposto,
          impostos: 0,
          valorLiquido: 0,
          comissaoStella: 0,
          comissaoFS: 0,
          valorFinal: 0,
        });
      }
    });

    // Associate taxes with courses using flexible matching
    const normalizedKeyMap = new Map<string, string>();
    cursosMap.forEach((_, key) => {
      normalizedKeyMap.set(normalize(key), key);
    });

    taxaRecords.forEach(record => {
      const taxaDescNorm = normalize(record.description);
      
      // Try exact match first
      let originalKey = normalizedKeyMap.get(taxaDescNorm);
      
      // If not found, try partial match
      if (!originalKey) {
        for (const [normKey, origKey] of normalizedKeyMap) {
          if (normKey.includes(taxaDescNorm) || taxaDescNorm.includes(normKey)) {
            originalKey = origKey;
            break;
          }
        }
      }
      
      if (originalKey) {
        const curso = cursosMap.get(originalKey);
        if (curso) {
          curso.taxasPlataforma += Math.abs(record.amount);
          curso.taxasDetalhadas.push({
            data: record.date,
            descricao: record.details || record.extraDetail1 || 'Taxa plataforma',
            valor: Math.abs(record.amount),
          });
        }
      } else {
        console.warn('Taxa não associada a curso parceiro:', record.description, record.amount);
      }
    });

    // Calculate derived values for each course
    cursosMap.forEach((curso) => {
      // Impostos = bruto * alíquota
      curso.impostos = curso.valorBruto * (curso.aliquotaImposto / 100);
      
      // Valor Líquido = Bruto - Taxas - Impostos
      curso.valorLiquido = curso.valorBruto - curso.taxasPlataforma - curso.impostos;
      
      // Comissão Stella = 3% do bruto (se vendedor = STELLA)
      const vendasStella = curso.vendas.filter(v => v.vendedor.includes('STELLA'));
      const totalVendasStella = vendasStella.reduce((s, v) => s + v.valor, 0);
      curso.comissaoStella = totalVendasStella * STELLA_COMMISSION_RATE;
      
      // Comissão FS = 10% do líquido
      curso.comissaoFS = curso.valorLiquido * FS_COMMISSION_RATE;
      
      // Valor Final = Líquido - Comissão Stella - Comissão FS
      curso.valorFinal = curso.valorLiquido - curso.comissaoStella - curso.comissaoFS;
    });

    const cursos = Array.from(cursosMap.values()).sort((a, b) => b.valorBruto - a.valorBruto);

    // Calculate totals
    const totais = {
      valorBruto: cursos.reduce((s, c) => s + c.valorBruto, 0),
      taxasPlataforma: cursos.reduce((s, c) => s + c.taxasPlataforma, 0),
      impostos: cursos.reduce((s, c) => s + c.impostos, 0),
      valorLiquido: cursos.reduce((s, c) => s + c.valorLiquido, 0),
      comissaoStella: cursos.reduce((s, c) => s + c.comissaoStella, 0),
      comissaoFS: cursos.reduce((s, c) => s + c.comissaoFS, 0),
      valorFinal: cursos.reduce((s, c) => s + c.valorFinal, 0),
    };

    return { cursos, totais };
  }, [rawData, taxData, selectedMonth, selectedYear]);

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

  const toggleCurso = (cursoNome: string) => {
    setOpenCursos(prev => ({
      ...prev,
      [cursoNome]: !prev[cursoNome],
    }));
  };

  // Generate PDF for individual course
  const generateCursoPDF = (curso: CursoParceiro) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246); // Blue
    doc.text('RELATÓRIO FINANCEIRO', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(curso.nome, pageWidth / 2, 30, { align: 'center' });
    
    // Period
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const periodo = selectedMonth !== 'all' && selectedYear !== 'all' 
      ? `${monthNames[selectedMonth]} ${selectedYear}`
      : 'Todos os períodos';
    doc.text(`Período: ${periodo}`, pageWidth / 2, 38, { align: 'center' });
    
    // Sales table
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('VENDAS REALIZADAS', 14, 50);
    
    autoTable(doc, {
      startY: 55,
      head: [['Data', 'Aluno', 'Vendedor', 'Valor']],
      body: curso.vendas.map(v => [
        v.data,
        v.aluno.substring(0, 30),
        v.vendedor || '-',
        formatCurrency(v.valor),
      ]),
      foot: [['', '', 'TOTAL', formatCurrency(curso.valorBruto)]],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9 },
    });
    
    // Financial summary
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(12);
    doc.text('DEMONSTRATIVO FINANCEIRO', 14, finalY + 15);
    
    autoTable(doc, {
      startY: finalY + 20,
      head: [['Descrição', 'Valor']],
      body: [
        ['Valor Bruto (Vendas)', formatCurrency(curso.valorBruto)],
        ['(-) Taxas de Plataforma', `- ${formatCurrency(curso.taxasPlataforma)}`],
        [`(-) Impostos (${curso.aliquotaImposto}%)`, `- ${formatCurrency(curso.impostos)}`],
        ['= Valor Líquido do Curso', formatCurrency(curso.valorLiquido)],
        ['(-) Comissão Stella (3% do bruto)', `- ${formatCurrency(curso.comissaoStella)}`],
        ['(-) Comissão FS (10% do líquido)', `- ${formatCurrency(curso.comissaoFS)}`],
      ],
      foot: [['= VALOR FINAL DO CURSO', formatCurrency(curso.valorFinal)]],
      theme: 'plain',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
      footStyles: { 
        fillColor: curso.valorFinal >= 0 ? [34, 197, 94] : [239, 68, 68], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold' 
      },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 50, halign: 'right' },
      },
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em: ${formatCurrentDate()}`, 14, doc.internal.pageSize.getHeight() - 10);
    
    // Save
    const fileName = `${curso.nome.replace(/\s+/g, '_')}_${selectedMonth || 'todos'}_${selectedYear || 'todos'}.pdf`;
    doc.save(fileName);
    
    toast({
      title: "PDF gerado!",
      description: `Relatório de ${curso.nome} salvo com sucesso.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Cursos Parceiros (Transitar)
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
              <Badge variant="outline" className="flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Imposto: {selectedMonth !== 'all' && selectedYear !== 'all' 
                  ? `${processedData.cursos[0]?.aliquotaImposto || 6}%` 
                  : '6%'}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {hasSearched && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Vendas</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {formatCurrency(processedData.totais.valorBruto)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {processedData.cursos.length} curso(s)
                  </p>
                </div>
                <div className="p-3 bg-blue-200 rounded-full">
                  <BookOpen className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Valor Líquido</p>
                  <p className="text-2xl font-bold text-green-800">
                    {formatCurrency(processedData.totais.valorLiquido)}
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

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Comissão FS (10%)</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {formatCurrency(processedData.totais.comissaoFS)}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    Sobre o líquido
                  </p>
                </div>
                <div className="p-3 bg-purple-200 rounded-full">
                  <Percent className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-700">Valor Final</p>
                  <p className="text-2xl font-bold text-amber-800">
                    {formatCurrency(processedData.totais.valorFinal)}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Para os parceiros
                  </p>
                </div>
                <div className="p-3 bg-amber-200 rounded-full">
                  <DollarSign className="h-6 w-6 text-amber-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Individual Course Cards */}
      {hasSearched && processedData.cursos.map((curso) => (
        <Card key={curso.nome} className="overflow-hidden">
          <Collapsible open={openCursos[curso.nome]} onOpenChange={() => toggleCurso(curso.nome)}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    {curso.nome}
                    <Badge variant="secondary" className="ml-2">
                      {curso.vendas.length} venda(s)
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-purple-600 font-bold">
                      FS: {formatCurrency(curso.comissaoFS)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateCursoPDF(curso);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </Button>
                    {openCursos[curso.nome] ? (
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
                {/* Sales Table */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Vendas Realizadas
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Data</TableHead>
                          <TableHead>Aluno</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {curso.vendas.map((venda, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{venda.data}</TableCell>
                            <TableCell>{venda.aluno || '-'}</TableCell>
                            <TableCell>
                              {venda.vendedor ? (
                                <Badge variant={venda.vendedor.includes('STELLA') ? 'default' : 'secondary'}>
                                  {venda.vendedor}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(venda.valor)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Resumo Financeiro
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Valor Bruto (Vendas)</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(curso.valorBruto)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-red-50">
                          <TableCell className="text-red-700">(-) Taxas Plataforma</TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            - {formatCurrency(curso.taxasPlataforma)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-red-50">
                          <TableCell className="text-red-700">
                            (-) Impostos ({curso.aliquotaImposto}%)
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            - {formatCurrency(curso.impostos)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-green-50 border-t-2 border-green-200">
                          <TableCell className="font-semibold text-green-700">= Valor Líquido do Curso</TableCell>
                          <TableCell className="text-right font-mono font-bold text-green-600">
                            {formatCurrency(curso.valorLiquido)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-orange-50">
                          <TableCell className="text-orange-700">(-) Comissão Stella (3% do bruto)</TableCell>
                          <TableCell className="text-right font-mono text-orange-600">
                            - {formatCurrency(curso.comissaoStella)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-purple-50">
                          <TableCell className="text-purple-700">(-) Comissão FS (10% do líquido)</TableCell>
                          <TableCell className="text-right font-mono text-purple-600">
                            - {formatCurrency(curso.comissaoFS)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-amber-100 border-t-2 border-amber-300">
                          <TableCell className="font-bold text-amber-800">= VALOR FINAL DO CURSO</TableCell>
                          <TableCell className="text-right font-mono font-bold text-amber-700 text-lg">
                            {formatCurrency(curso.valorFinal)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

      {/* Totals Summary */}
      {hasSearched && processedData.cursos.length > 0 && (
        <Card className="border-2 border-slate-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              TOTAIS - TODOS OS CURSOS PARCEIROS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Total Vendas Brutas</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(processedData.totais.valorBruto)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-red-700">Total Taxas Plataforma</TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      - {formatCurrency(processedData.totais.taxasPlataforma)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-red-700">Total Impostos</TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      - {formatCurrency(processedData.totais.impostos)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-green-50">
                    <TableCell className="font-semibold text-green-700">Total Valor Líquido</TableCell>
                    <TableCell className="text-right font-mono font-bold text-green-600">
                      {formatCurrency(processedData.totais.valorLiquido)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-orange-700">Total Comissões Stella (3%)</TableCell>
                    <TableCell className="text-right font-mono text-orange-600">
                      - {formatCurrency(processedData.totais.comissaoStella)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-purple-50">
                    <TableCell className="font-semibold text-purple-700">Total Comissões FS (10%)</TableCell>
                    <TableCell className="text-right font-mono font-bold text-purple-600">
                      {formatCurrency(processedData.totais.comissaoFS)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-amber-100 border-t-2 border-amber-300">
                    <TableCell className="font-bold text-amber-800 text-lg">TOTAL VALOR FINAL (Para Parceiros)</TableCell>
                    <TableCell className="text-right font-mono font-bold text-amber-700 text-xl">
                      {formatCurrency(processedData.totais.valorFinal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {hasSearched && processedData.cursos.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum curso parceiro encontrado</h3>
            <p className="text-muted-foreground">
              Não foram encontrados registros de cursos em trânsito (TRANSITAR) para o período selecionado.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Initial state - before search */}
      {!hasSearched && (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Cursos Parceiros</h3>
            <p className="text-muted-foreground mb-4">
              Selecione o período e clique em "Consultar" para visualizar os cursos parceiros.
            </p>
            <ul className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-2">
              <li className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span><strong>Vendas:</strong> Total de vendas por curso</span>
              </li>
              <li className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-red-600" />
                <span><strong>Taxas + Impostos:</strong> Descontos aplicados</span>
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-600" />
                <span><strong>Comissão Stella:</strong> 3% do bruto (se aplicável)</span>
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span><strong>Comissão FS:</strong> 10% do valor líquido</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CursosParceiros;
