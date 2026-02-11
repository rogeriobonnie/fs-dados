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

  const monthName = selectedMonth ? MONTH_NAMES[parseInt(selectedMonth) - 1] : '';
  const year = selectedYear || '';

  // Generate individual PDF per vendedor
  const generateVendedorPDF = (nome: string, entry: { total: number; vendas: Pagina5Record[] }) => {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Comissões - ${nome}`, 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} ${year}`, 14, y);
    y += 10;

    // Summary
    autoTable(doc, {
      startY: y,
      body: [
        ['Quantidade de Vendas', String(entry.vendas.length)],
        ['Total Comissão', fmt(entry.total)],
      ],
      theme: 'grid', styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Detail table
    const rows = entry.vendas.map(v => [v.date, v.descricao, v.detalhamento, fmt(v.valorBruto), fmt(v.vrVendedor)]);
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Curso', 'Aluno', 'Valor Venda', 'Comissão']],
      body: rows,
      theme: 'striped', styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Total footer
    autoTable(doc, {
      startY: y,
      body: [['TOTAL COMISSÃO', fmt(entry.total)]],
      theme: 'grid', styles: { fontSize: 11, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      bodyStyles: { fillColor: [220, 255, 220] },
    });

    doc.save(`Comissao_${nome.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`);
  };

  // Generate individual PDF for MKT
  const generateMktPDF = (nome: string, entry: { total: number; vendas: Pagina5Record[] }) => {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Comissões MKT - ${nome}`, 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} ${year}`, 14, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      body: [
        ['Quantidade de Vendas', String(entry.vendas.length)],
        ['Total Comissão MKT', fmt(entry.total)],
      ],
      theme: 'grid', styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    const rows = entry.vendas.map(v => [v.date, v.descricao, v.detalhamento, fmt(v.valorBruto), fmt(v.vrMkt)]);
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Curso', 'Aluno', 'Valor Venda', 'Com. MKT']],
      body: rows,
      theme: 'striped', styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    autoTable(doc, {
      startY: y,
      body: [['TOTAL COMISSÃO MKT', fmt(entry.total)]],
      theme: 'grid', styles: { fontSize: 11, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      bodyStyles: { fillColor: [220, 255, 220] },
    });

    doc.save(`Comissao_MKT_${nome.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`);
  };

  return (
    <div className="space-y-6 mt-4">
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
                <TableHead className="text-xs text-right">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(porVendedor.entries())
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([nome, entry]) => (
                  <TableRow key={nome}>
                    <TableCell className="text-xs font-medium">{nome}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary">{entry.vendas.length}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold">{fmt(entry.total)}</TableCell>
                    <TableCell className="text-xs text-right">
                      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => generateVendedorPDF(nome, entry)}>
                        <FileText className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="text-xs font-bold" colSpan={2}>TOTAL</TableCell>
                <TableCell className="text-xs text-right font-bold">{fmt(totalVendedor)}</TableCell>
                <TableCell />
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
                <TableHead className="text-xs text-right">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(porMkt.entries())
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([nome, entry]) => (
                  <TableRow key={nome}>
                    <TableCell className="text-xs font-medium">{nome}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary">{entry.vendas.length}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold">{fmt(entry.total)}</TableCell>
                    <TableCell className="text-xs text-right">
                      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => generateMktPDF(nome, entry)}>
                        <FileText className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="text-xs font-bold" colSpan={2}>TOTAL</TableCell>
                <TableCell className="text-xs text-right font-bold">{fmt(totalMkt)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComissoesPainel;
