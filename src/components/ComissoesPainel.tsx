import { useMemo } from 'react';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Megaphone, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  data: Pagina5Record[];
  selectedMonth?: string;
  selectedYear?: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const ComissoesPainel = ({ data, selectedMonth, selectedYear }: Props) => {
  const receitasComComissao = useMemo(() => {
    return data.filter(r => (r.custoNum >= 1 && r.custoNum <= 10) && (r.vrVendedor > 0 || r.vrMkt > 0));
  }, [data]);

  const porVendedor = useMemo(() => {
    const map = new Map<string, { total: number; vendas: Pagina5Record[] }>();
    receitasComComissao.forEach(r => {
      if (!r.vendedor || r.vrVendedor <= 0) return;
      const key = r.vendedor.toUpperCase();
      if (!map.has(key)) map.set(key, { total: 0, vendas: [] });
      const entry = map.get(key)!;
      entry.total += r.vrVendedor;
      entry.vendas.push(r);
    });
    return map;
  }, [receitasComComissao]);

  const porMkt = useMemo(() => {
    const map = new Map<string, { total: number; vendas: Pagina5Record[] }>();
    receitasComComissao.forEach(r => {
      if (!r.mkt || r.vrMkt <= 0) return;
      const key = r.mkt.toUpperCase();
      if (!map.has(key)) map.set(key, { total: 0, vendas: [] });
      const entry = map.get(key)!;
      entry.total += r.vrMkt;
      entry.vendas.push(r);
    });
    return map;
  }, [receitasComComissao]);

  const totalVendedor = Array.from(porVendedor.values()).reduce((s, v) => s + v.total, 0);
  const totalMkt = Array.from(porMkt.values()).reduce((s, v) => s + v.total, 0);

  const generatePDF = () => {
    const monthName = selectedMonth ? MONTH_NAMES[parseInt(selectedMonth) - 1] : '';
    const year = selectedYear || '';
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Relatório de Comissões - ${monthName} ${year}`, 14, y);
    y += 10;

    // Vendedores
    doc.setFontSize(12);
    doc.text('Comissões por Vendedor', 14, y);
    y += 6;

    const vendedorRows = Array.from(porVendedor.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([nome, { total, vendas }]) => [nome, String(vendas.length), fmt(total)]);
    vendedorRows.push(['TOTAL', '', fmt(totalVendedor)]);

    autoTable(doc, {
      startY: y, head: [['Vendedor', 'Qtd Vendas', 'Total Comissão']], body: vendedorRows,
      theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [66, 66, 66] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // MKT
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Comissões por MKT', 14, y);
    y += 6;

    const mktRows = Array.from(porMkt.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([nome, { total, vendas }]) => [nome, String(vendas.length), fmt(total)]);
    mktRows.push(['TOTAL', '', fmt(totalMkt)]);

    autoTable(doc, {
      startY: y, head: [['MKT', 'Qtd', 'Total Comissão']], body: mktRows,
      theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [66, 66, 66] },
    });

    doc.save(`Comissoes_${monthName}_${year}.pdf`);
  };

  return (
    <div className="space-y-6 mt-4">
      {/* PDF Button */}
      <div className="flex justify-end">
        <Button onClick={generatePDF} variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Gerar PDF
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Comissões Vendedores</p>
            <p className="text-lg font-bold text-primary">{fmt(totalVendedor)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Comissões MKT</p>
            <p className="text-lg font-bold text-primary">{fmt(totalMkt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Por Vendedor */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Comissões por Vendedor</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Vendedor</TableHead>
                <TableHead className="text-xs">Qtd Vendas</TableHead>
                <TableHead className="text-xs text-right">Total Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(porVendedor.entries())
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([nome, { total, vendas }]) => (
                  <TableRow key={nome}>
                    <TableCell className="text-xs font-medium">{nome}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary">{vendas.length}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold">{fmt(total)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="text-xs font-bold" colSpan={2}>TOTAL</TableCell>
                <TableCell className="text-xs text-right font-bold">{fmt(totalVendedor)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Por MKT */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Comissões por MKT</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">MKT</TableHead>
                <TableHead className="text-xs">Qtd</TableHead>
                <TableHead className="text-xs text-right">Total Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(porMkt.entries())
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([nome, { total, vendas }]) => (
                  <TableRow key={nome}>
                    <TableCell className="text-xs font-medium">{nome}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary">{vendas.length}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold">{fmt(total)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="text-xs font-bold" colSpan={2}>TOTAL</TableCell>
                <TableCell className="text-xs text-right font-bold">{fmt(totalMkt)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComissoesPainel;
