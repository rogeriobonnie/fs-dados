import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterState } from '@/components/FinancialFilters';
import { AlertTriangle, Clock, CheckCircle, Calendar, DollarSign, Users, X } from 'lucide-react';

interface QuickFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalRecords: number;
}

export const QuickFilters = ({ filters, onFiltersChange, totalRecords }: QuickFiltersProps) => {
  const today = new Date();
  const currentMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const formatDate = (date: Date) => {
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
  };

  const quickFilters = [
    // Status Filters
    {
      icon: AlertTriangle,
      label: 'Vencidos',
      description: 'Pagamentos em atraso',
      variant: 'destructive' as const,
      count: 0, // Will be calculated
      action: () => onFiltersChange({
        ...filters,
        status: 'VENCIDO',
        dateFrom: '',
        dateTo: ''
      })
    },
    {
      icon: Clock,
      label: 'Próximos 30 dias',
      description: 'Vencimentos próximos',
      variant: 'secondary' as const,
      count: 0,
      action: () => onFiltersChange({
        ...filters,
        status: 'A PAGAR',
        dateFrom: formatDate(today),
        dateTo: formatDate(next30Days)
      })
    },
    {
      icon: CheckCircle,
      label: 'Pagos este mês',
      description: 'Recebimentos atuais',
      variant: 'default' as const,
      count: 0,
      action: () => onFiltersChange({
        ...filters,
        status: 'PAGO',
        dateFrom: currentMonth + '-01',
        dateTo: currentMonth + '-31'
      })
    },
    {
      icon: Calendar,
      label: 'Últimos 30 dias',
      description: 'Atividade recente',
      variant: 'outline' as const,
      count: 0,
      action: () => onFiltersChange({
        ...filters,
        status: 'all',
        dateFrom: formatDate(last30Days),
        dateTo: formatDate(today)
      })
    },
    // Value Filters
    {
      icon: DollarSign,
      label: 'Acima R$ 1.000',
      description: 'Valores altos',
      variant: 'outline' as const,
      count: 0,
      action: () => onFiltersChange({
        ...filters,
        amountMin: '1000',
        amountMax: ''
      })
    },
    {
      icon: DollarSign,
      label: 'Acima R$ 5.000',
      description: 'Valores muito altos',
      variant: 'outline' as const,
      count: 0,
      action: () => onFiltersChange({
        ...filters,
        amountMin: '5000',
        amountMax: ''
      })
    },
    // Consultant Filters
    {
      icon: Users,
      label: 'Stephanie',
      description: 'Vendas da Stephanie',
      variant: 'outline' as const,
      count: 0,
      action: () => onFiltersChange({
        ...filters,
        consultant: 'STHEPHANIE'
      })
    },
    {
      icon: Users,
      label: 'Rafaela',
      description: 'Vendas da Rafaela',
      variant: 'outline' as const,
      count: 0,
      action: () => onFiltersChange({
        ...filters,
        consultant: 'RAFAELA'
      })
    }
  ];

  const clearAllFilters = () => {
    onFiltersChange({
      status: 'all',
      consultant: 'all',
      studentName: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: ''
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => 
    value !== '' && value !== 'all'
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filtros Rápidos</h3>
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAllFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar todos
          </Button>
        )}
      </div>

      {/* Primary Quick Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickFilters.slice(0, 4).map((filter, index) => {
          const Icon = filter.icon;
          const isActive = 
            (filter.label === 'Vencidos' && filters.status === 'VENCIDO') ||
            (filter.label === 'Próximos 30 dias' && filters.status === 'A PAGAR' && filters.dateFrom && filters.dateTo) ||
            (filter.label === 'Pagos este mês' && filters.status === 'PAGO' && filters.dateFrom?.includes(currentMonth)) ||
            (filter.label === 'Últimos 30 dias' && filters.dateFrom && filters.dateTo && filters.status === 'all');

          return (
            <Button
              key={index}
              variant={isActive ? "default" : filter.variant}
              onClick={filter.action}
              className={`h-auto p-4 flex flex-col items-center gap-2 text-center transition-all ${
                isActive ? 'ring-2 ring-primary/20' : ''
              }`}
            >
              <Icon className="h-5 w-5" />
              <div className="space-y-1">
                <div className="font-medium text-sm">{filter.label}</div>
                <div className="text-xs opacity-80">{filter.description}</div>
              </div>
            </Button>
          );
        })}
      </div>

      {/* Secondary Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground font-medium">Filtros adicionais:</span>
        {quickFilters.slice(4).map((filter, index) => {
          const Icon = filter.icon;
          const isActive = 
            (filter.label === 'Acima R$ 1.000' && filters.amountMin === '1000') ||
            (filter.label === 'Acima R$ 5.000' && filters.amountMin === '5000') ||
            (filter.label === 'Stephanie' && filters.consultant === 'STHEPHANIE') ||
            (filter.label === 'Rafaela' && filters.consultant === 'RAFAELA');

          return (
            <Button
              key={index + 4}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={filter.action}
              className="h-8 px-3 text-xs flex items-center gap-1.5"
            >
              <Icon className="h-3 w-3" />
              {filter.label}
              {isActive && <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">✓</Badge>}
            </Button>
          );
        })}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium">Filtros ativos:</span>
          <div className="flex flex-wrap gap-1">
            {filters.status && filters.status !== 'all' && (
              <Badge variant="outline" className="text-xs">
                Status: {filters.status}
              </Badge>
            )}
            {filters.consultant && filters.consultant !== 'all' && (
              <Badge variant="outline" className="text-xs">
                {filters.consultant === 'direct' ? 'Vendas Diretas' : filters.consultant}
              </Badge>
            )}
            {filters.studentName && (
              <Badge variant="outline" className="text-xs">
                Aluno: {filters.studentName}
              </Badge>
            )}
            {filters.amountMin && (
              <Badge variant="outline" className="text-xs">
                Min: R$ {filters.amountMin}
              </Badge>
            )}
            {filters.amountMax && (
              <Badge variant="outline" className="text-xs">
                Max: R$ {filters.amountMax}
              </Badge>
            )}
            {filters.dateFrom && (
              <Badge variant="outline" className="text-xs">
                De: {new Date(filters.dateFrom).toLocaleDateString('pt-BR')}
              </Badge>
            )}
            {filters.dateTo && (
              <Badge variant="outline" className="text-xs">
                Até: {new Date(filters.dateTo).toLocaleDateString('pt-BR')}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {totalRecords} registro{totalRecords !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};