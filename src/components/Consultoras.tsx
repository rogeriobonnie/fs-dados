import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { formatCurrency } from '@/utils/financialCalculations';
import { Search, Filter, RefreshCw, Calendar, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConsultantRecord {
  id: string;
  consultantName: string;
  amount: number;
  month: string;
  year: string;
  date: string;
  description: string;
}

const Consultoras = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [consultantData, setConsultantData] = useState<ConsultantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

      {/* Summary Cards */}
      {hasSearched && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Stella Card */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/15">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Users className="h-5 w-5" />
                STELLA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total de Vendas</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(processedData.stella.total)}
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                  <p className="text-sm font-medium text-success">
                    Comissão (3%)
                  </p>
                  <p className="text-xl font-bold text-success">
                    {formatCurrency(processedData.stella.commission)}
                  </p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {processedData.stella.records.length} registro{processedData.stella.records.length !== 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>

          {/* Stephanie Card */}
          <Card className="border-secondary/30 bg-gradient-to-br from-secondary/5 via-secondary/10 to-secondary/15">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-secondary">
                <Users className="h-5 w-5" />
                STHEPHANIE
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total de Vendas</p>
                <p className="text-2xl font-bold text-secondary">
                  {formatCurrency(processedData.stephanie.total)}
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                  <p className="text-sm font-medium text-success">
                    Comissão (3%)
                  </p>
                  <p className="text-xl font-bold text-success">
                    {formatCurrency(processedData.stephanie.commission)}
                  </p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {processedData.stephanie.records.length} registro{processedData.stephanie.records.length !== 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Consultoras;
