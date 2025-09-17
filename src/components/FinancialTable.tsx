import { useState } from 'react';
import { FinancialRecord } from '@/types/financial';
import { formatCurrency, formatDate } from '@/utils/financialCalculations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface FinancialTableProps {
  data: FinancialRecord[];
}

type SortField = keyof FinancialRecord;
type SortDirection = 'asc' | 'desc';

export const FinancialTable = ({ data }: FinancialTableProps) => {
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status: FinancialRecord['status']) => {
    const variants = {
      'PAGO': { variant: 'default' as const, className: 'bg-success text-success-foreground' },
      'A PAGAR': { variant: 'secondary' as const, className: 'bg-warning text-warning-foreground' },
      'VENCIDO': { variant: 'destructive' as const, className: 'bg-danger text-danger-foreground' }
    };
    
    const config = variants[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {status}
      </Badge>
    );
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      className="h-auto p-0 font-semibold hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton field="studentName">Aluno</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="consultant">Consultor</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="installment">Parcela</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="dueDate">Vencimento</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="amount">Valor</SortButton>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Pagamento</TableHead>
              <TableHead>NF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">
                  {record.studentName}
                </TableCell>
                <TableCell>
                  {record.consultant || 'Venda Direta'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{record.installment}</Badge>
                </TableCell>
                <TableCell>
                  {formatDate(record.dueDate)}
                </TableCell>
                <TableCell className="font-semibold">
                  {formatCurrency(record.amount)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(record.status)}
                </TableCell>
                <TableCell>
                  {record.paymentDate ? formatDate(record.paymentDate) : '-'}
                </TableCell>
                <TableCell>
                  {record.invoice || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, sortedData.length)} de {sortedData.length} registros
        </p>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};