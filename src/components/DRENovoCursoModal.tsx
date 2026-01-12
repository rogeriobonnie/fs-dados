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
import { Calendar, User, CreditCard, DollarSign, Receipt } from 'lucide-react';

export interface DRENovoVenda {
  data: string;
  aluno: string;
  formaPagamento: string;
  valor: number;
}

export interface TaxaDetalhe {
  data: string;
  descricao: string;
  valor: number;
}

interface DRENovoCursoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cursoNome: string;
  vendas?: DRENovoVenda[];
  vendasEntrada?: DRENovoVenda[];
  vendasTransitar?: DRENovoVenda[];
  taxasDetalhadas?: TaxaDetalhe[];
  totalTaxas?: number;
  tipoTransitar?: boolean;
}

const DRENovoCursoModal: React.FC<DRENovoCursoModalProps> = ({
  isOpen,
  onClose,
  cursoNome,
  vendas,
  vendasEntrada = [],
  vendasTransitar = [],
  taxasDetalhadas = [],
  totalTaxas = 0,
  tipoTransitar = false,
}) => {
  // Support both old (vendas) and new (vendasEntrada/vendasTransitar) format
  const hasNewFormat = vendasEntrada.length > 0 || vendasTransitar.length > 0;
  const displayVendas = vendas || [];
  
  const totalEntrada = vendasEntrada.reduce((sum, v) => sum + v.valor, 0);
  const totalTransitar = vendasTransitar.reduce((sum, v) => sum + v.valor, 0);
  const totalVendas = hasNewFormat 
    ? totalEntrada + totalTransitar 
    : displayVendas.reduce((sum, v) => sum + v.valor, 0);

  const renderVendasTable = (vendasList: DRENovoVenda[], title?: string, total?: number, colorClass?: string) => (
    <div className="border rounded-lg overflow-hidden">
      {title && (
        <div className={`p-3 ${colorClass || 'bg-muted/50'} flex items-center justify-between font-semibold`}>
          <span className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {title} ({vendasList.length} venda{vendasList.length !== 1 ? 's' : ''})
          </span>
          {total !== undefined && (
            <span className="text-green-600">{formatCurrency(total)}</span>
          )}
        </div>
      )}
      <Table>
        {!title && (
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
        )}
        <TableBody>
          {title && (
            <TableRow className="bg-muted/30 text-xs text-muted-foreground">
              <TableCell className="py-1 font-medium">Data</TableCell>
              <TableCell className="py-1 font-medium">Aluno</TableCell>
              <TableCell className="py-1 font-medium">Forma Pgto</TableCell>
              <TableCell className="py-1 font-medium text-right">Valor</TableCell>
            </TableRow>
          )}
          {vendasList.map((venda, index) => (
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
    </div>
  );

  const renderTaxasTable = () => (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-3 bg-red-50 flex items-center justify-between font-semibold">
        <span className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-red-600" />
          🔴 TAXAS PLATAFORMA ({taxasDetalhadas.length} registro{taxasDetalhadas.length !== 1 ? 's' : ''})
        </span>
        <span className="text-red-600">-{formatCurrency(totalTaxas)}</span>
      </div>
      <Table>
        <TableBody>
          <TableRow className="bg-muted/30 text-xs text-muted-foreground">
            <TableCell className="py-1 font-medium">Data</TableCell>
            <TableCell className="py-1 font-medium">Descrição</TableCell>
            <TableCell className="py-1 font-medium text-right">Valor</TableCell>
          </TableRow>
          {taxasDetalhadas.map((taxa, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono text-sm">
                {taxa.data || '-'}
              </TableCell>
              <TableCell>{taxa.descricao || '-'}</TableCell>
              <TableCell className="text-right font-semibold text-red-600">
                -{formatCurrency(taxa.valor)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

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
                {hasNewFormat 
                  ? `${vendasEntrada.length + vendasTransitar.length} venda(s) encontrada(s)`
                  : `${displayVendas.length} venda${displayVendas.length !== 1 ? 's' : ''} encontrada${displayVendas.length !== 1 ? 's' : ''}`
                }
              </span>
            </div>
            <div className="text-lg font-bold text-primary">
              {formatCurrency(totalVendas)}
            </div>
          </div>

          {/* New format - separate Entrada, Transitar, and Taxas */}
          {hasNewFormat ? (
            <div className="space-y-4">
              {vendasEntrada.length > 0 && (
                renderVendasTable(vendasEntrada, '📗 ENTRADAS', totalEntrada, 'bg-green-50')
              )}
              
              {vendasTransitar.length > 0 && (
                renderVendasTable(vendasTransitar, '📙 TRANSITAR (Parceiro)', totalTransitar, 'bg-orange-50')
              )}

              {/* Taxas Plataforma */}
              {taxasDetalhadas.length > 0 && renderTaxasTable()}

              {/* Total Geral */}
              <div className="space-y-2 p-4 bg-muted/30 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Bruto</span>
                  <span className="font-semibold text-green-600">{formatCurrency(totalVendas)}</span>
                </div>
                {totalTaxas > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">(-) Taxas Plataforma</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(totalTaxas)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-semibold">LÍQUIDO (sem impostos)</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(totalVendas - totalTaxas)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Old format - single vendas list */
            displayVendas.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                {renderVendasTable(displayVendas)}

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
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DRENovoCursoModal;
