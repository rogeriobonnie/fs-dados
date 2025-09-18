import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FilterState } from './FinancialFilters';
import { CheckCircle, Clock, AlertTriangle, Users, Calendar, DollarSign, X } from 'lucide-react';

interface QuickFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalRecords: number;
}

export const QuickFilters = ({ filters, onFiltersChange, totalRecords }: QuickFiltersProps) => {
  const currentDate = new Date();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const currentYear = currentDate.getFullYear().toString();
  const lastMonth = String(currentDate.getMonth() === 0 ? 12 : currentDate.getMonth()).padStart(2, '0');
  const lastMonthYear = currentDate.getMonth() === 0 ? (parseInt(currentYear) - 1).toString() : currentYear;

  const quickFilterOptions = [
    {
      label: 'Pagos',
      icon: CheckCircle,
      color: 'bg-success/10 text-success border-success/20 hover:bg-success/20',
      filters: { status: 'PAGO' as const },
    },
    {
      label: 'A Pagar',
      icon: Clock,
      color: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20',
      filters: { status: 'A PAGAR' as const },
    },
    {
      label: 'Vencidos',
      icon: AlertTriangle,
      color: 'bg-danger/10 text-danger border-danger/20 hover:bg-danger/20',
      filters: { status: 'VENCIDO' as const },
    },
    {
      label: 'Mês Atual',
      icon: Calendar,
      color: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20',
      filters: { monthFrom: currentMonth, yearFrom: currentYear, monthTo: currentMonth, yearTo: currentYear },
    },
    {
      label: 'Mês Passado',
      icon: Calendar,
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20',
      filters: { monthFrom: lastMonth, yearFrom: lastMonthYear, monthTo: lastMonth, yearTo: lastMonthYear },
    },
    {
      label: 'Vendas Diretas',
      icon: Users,
      color: 'bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20',
      filters: { consultant: 'direct' },
    },
    {
      label: 'Valores Altos',
      icon: DollarSign,
      color: 'bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20',
      filters: { amountMin: '5000' },
    },
  ];

  const applyQuickFilter = (quickFilters: Partial<FilterState>) => {
    onFiltersChange({
      status: 'all',
      consultant: 'all',
      studentName: '',
      monthFrom: '',
      yearFrom: '',
      monthTo: '',
      yearTo: '',
      amountMin: '',
      amountMax: '',
      ...quickFilters,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      status: 'all',
      consultant: 'all',
      studentName: '',
      monthFrom: '',
      yearFrom: '',
      monthTo: '',
      yearTo: '',
      amountMin: '',
      amountMax: '',
    });
  };

  const hasActiveFilters = 
    filters.status !== 'all' ||
    filters.consultant !== 'all' ||
    filters.studentName !== '' ||
    filters.monthFrom !== '' ||
    filters.yearFrom !== '' ||
    filters.monthTo !== '' ||
    filters.yearTo !== '' ||
    filters.amountMin !== '' ||
    filters.amountMax !== '';

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Filtros Rápidos</CardTitle>
            <CardDescription>
              {totalRecords} registros encontrados
            </CardDescription>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs"
            >
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {quickFilterOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.label}
                variant="outline"
                size="sm"
                onClick={() => applyQuickFilter(option.filters)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 h-auto ${option.color}`}
              >
                <Icon className="h-3 w-3" />
                {option.label}
              </Button>
            );
          })}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              Filtros ativos:
            </div>
            <div className="flex flex-wrap gap-1">
              {filters.status !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  Status: {filters.status}
                </Badge>
              )}
              {filters.consultant !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  Consultor: {filters.consultant === 'direct' ? 'Vendas Diretas' : filters.consultant}
                </Badge>
              )}
              {filters.studentName && (
                <Badge variant="secondary" className="text-xs">
                  Aluno: {filters.studentName}
                </Badge>
              )}
              {(filters.monthFrom || filters.yearFrom) && (
                <Badge variant="secondary" className="text-xs">
                  De: {filters.monthFrom}/{filters.yearFrom}
                </Badge>
              )}
              {(filters.monthTo || filters.yearTo) && (
                <Badge variant="secondary" className="text-xs">
                  Até: {filters.monthTo}/{filters.yearTo}
                </Badge>
              )}
              {filters.amountMin && (
                <Badge variant="secondary" className="text-xs">
                  Min: R$ {filters.amountMin}
                </Badge>
              )}
              {filters.amountMax && (
                <Badge variant="secondary" className="text-xs">
                  Max: R$ {filters.amountMax}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};