import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';

export interface FilterState {
  status: 'all' | 'PAGO' | 'A PAGAR' | 'VENCIDO';
  consultant: string;
  studentName: string;
  monthFrom: string;
  yearFrom: string;
  monthTo: string;
  yearTo: string;
  amountMin: string;
  amountMax: string;
}

interface FinancialFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  consultants: string[];
}

export const FinancialFilters = ({ filters, onFiltersChange, consultants }: FinancialFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const months = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear - 2; year <= currentYear + 2; year++) {
    years.push({ value: year.toString(), label: year.toString() });
  }

  const updateFilters = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      status: 'all',
      consultant: 'all',
      studentName: '',
      monthFrom: 'all',
      yearFrom: 'all',
      monthTo: 'all',
      yearTo: 'all',
      amountMin: '',
      amountMax: ''
    });
  };

  const activeFiltersCount = [
    filters.status !== 'all',
    filters.consultant !== 'all',
    filters.studentName !== '',
    filters.monthFrom !== 'all',
    filters.yearFrom !== 'all',
    filters.monthTo !== 'all',
    filters.yearTo !== 'all',
    filters.amountMin !== '',
    filters.amountMax !== ''
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Toggle Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros Avançados
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" />
          )}
        </Button>
        
        {activeFiltersCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAllFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Expandable Filters */}
      {isExpanded && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros Avançados</CardTitle>
            <CardDescription>
              Use os filtros para refinar sua visualização dos dados financeiros
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
        {/* Row 1: Status and Consultant */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={filters.status} onValueChange={(value) => updateFilters('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="PAGO">Pagos</SelectItem>
                <SelectItem value="A PAGAR">A Pagar</SelectItem>
                <SelectItem value="VENCIDO">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consultant">Consultor</Label>
            <Select value={filters.consultant} onValueChange={(value) => updateFilters('consultant', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os consultores" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">Todos os consultores</SelectItem>
                <SelectItem value="direct">Vendas Diretas</SelectItem>
                {consultants
                  .filter(consultant => consultant)
                  .map(consultant => (
                    <SelectItem key={consultant} value={consultant}>
                      {consultant}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Student Name */}
        <div className="space-y-2">
          <Label htmlFor="studentName">Nome do Aluno</Label>
          <Input
            id="studentName"
            placeholder="Digite o nome do aluno..."
            value={filters.studentName}
            onChange={(e) => updateFilters('studentName', e.target.value)}
          />
        </div>

        {/* Row 3: Date Range */}
        <div className="space-y-4">
          <Label>Período de Vencimento</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Mês Inicial</Label>
              <Select value={filters.monthFrom} onValueChange={(value) => updateFilters('monthFrom', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">Todos</SelectItem>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Ano Inicial</Label>
              <Select value={filters.yearFrom} onValueChange={(value) => updateFilters('yearFrom', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">Todos</SelectItem>
                  {years.map(year => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Mês Final</Label>
              <Select value={filters.monthTo} onValueChange={(value) => updateFilters('monthTo', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">Todos</SelectItem>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Ano Final</Label>
              <Select value={filters.yearTo} onValueChange={(value) => updateFilters('yearTo', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">Todos</SelectItem>
                  {years.map(year => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Row 4: Amount Range */}
        <div className="space-y-4">
          <Label>Faixa de Valores</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountMin" className="text-sm text-muted-foreground">Valor Mínimo</Label>
              <Input
                id="amountMin"
                type="number"
                placeholder="0.00"
                value={filters.amountMin}
                onChange={(e) => updateFilters('amountMin', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountMax" className="text-sm text-muted-foreground">Valor Máximo</Label>
              <Input
                id="amountMax"
                type="number"
                placeholder="0.00"
                value={filters.amountMax}
                onChange={(e) => updateFilters('amountMax', e.target.value)}
              />
            </div>
          </div>
        </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};