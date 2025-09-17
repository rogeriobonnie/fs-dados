import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Filter } from 'lucide-react';

export interface FilterState {
  status: string;
  consultant: string;
  studentName: string;
  dateFrom: string;
  dateTo: string;
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

  const updateFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: '',
      consultant: '',
      studentName: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: ''
    });
  };

  const activeFiltersCount = Object.values(filters).filter(value => value !== '').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/20">
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                <SelectItem value="PAGO">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success"></div>
                    Pago
                  </div>
                </SelectItem>
                <SelectItem value="A PAGAR">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning"></div>
                    A Pagar
                  </div>
                </SelectItem>
                <SelectItem value="VENCIDO">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-danger"></div>
                    Vencido
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Consultor</label>
            <Select value={filters.consultant} onValueChange={(value) => updateFilter('consultant', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os consultores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os consultores</SelectItem>
                {consultants.map(consultant => (
                  <SelectItem key={consultant} value={consultant}>
                    {consultant === '' ? 'Vendas Diretas' : consultant}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nome do Aluno</label>
            <Input
              placeholder="Digite o nome..."
              value={filters.studentName}
              onChange={(e) => updateFilter('studentName', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Valor Mínimo</label>
            <Input
              type="number"
              placeholder="R$ 0,00"
              value={filters.amountMin}
              onChange={(e) => updateFilter('amountMin', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data Inicial</label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data Final</label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Valor Máximo</label>
            <Input
              type="number"
              placeholder="R$ 99.999,00"
              value={filters.amountMax}
              onChange={(e) => updateFilter('amountMax', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};