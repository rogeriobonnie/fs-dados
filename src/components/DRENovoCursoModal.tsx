import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/utils/financialCalculations';
import { Calendar, User, CreditCard, DollarSign } from 'lucide-react';

export interface DRENovoVenda {
  data: string;
  aluno: string;
  formaPagamento: string;
  valor: number;
}

interface DRENovoCursoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cursoNome: string;
  vendas: DRENovoVenda[];
  tipoTransitar?: boolean;
}

const DRENovoCursoModal: React.FC<DRENovoCursoModalProps> = ({
  isOpen,
  onClose,
  cursoNome,
  vendas,
  tipoTransitar = false,
}) => {
  const totalVendas = vendas.reduce((sum, v) => sum + v.valor, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Detalhamento: {cursoNome}
            {tipoTransitar && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Parceiro)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {vendas.length} venda{vendas.length !== 1 ? 's' : ''} encontrada{vendas.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-lg font-bold text-primary">
              {formatCurrency(totalVendas)}
            </div>
          </div>

          {/* Tabela de vendas */}
          {vendas.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[120px]">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Data
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Aluno
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        Forma Pgto
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <DollarSign className="h-3 w-3" />
                        Valor
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendas.map((venda, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">
                        {venda.data || '-'}
                      </TableCell>
                      <TableCell>{venda.aluno || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {venda.formaPagamento || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(venda.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Total */}
              <div className="flex items-center justify-between p-4 bg-muted/30 border-t">
                <span className="font-semibold">TOTAL</span>
                <span className="text-lg font-bold text-green-600">
                  {formatCurrency(totalVendas)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum detalhamento disponível para este curso.</p>
              <p className="text-sm mt-1">
                Os dados de vendas individuais não estão disponíveis na planilha.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DRENovoCursoModal;
