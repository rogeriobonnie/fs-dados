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

  // Lance a Dois — período selecionado (rateio por curso no mesmo cálculo)
  const lad = useMemo(() => ladRateioPeriodo(data), [data]);

  const receitasLAD = lad.receitas;
  const despesasLAD = lad.despesasRecords;

  const receitasLADSorted = useMemo(() => {
    return [...receitasLAD].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
  }, [receitasLAD]);

  const totaisReceitaLAD = {
    bruto: lad.bruto,
    taxas: lad.taxas,
    acrescimos: lad.acrescimos,
    impostos: lad.impostos,
    comVend: lad.comVend,
    liquido: lad.liquido,
  };

  const totalReceitaLiquida = lad.liquido;
  const totalDespesasLAD = lad.despesas;
  const resultadoLiquido = lad.resultado;
  const comissaoLAD = lad.comissao;

  const totalVendedor = Array.from(porVendedor.values()).reduce((s, v) => s + v.total, 0);


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

  // Generate PDF for Lance a Dois
  const generateLADPDF = () => {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Comissão Lance a Dois', 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} ${year}`, 14, y);
    y += 10;

    // Receitas
    const receitaRows = receitasLAD.map(r => [
      r.date, r.descricao, r.detalhamento, fmt(r.valorBruto), fmt(r.taxas), fmt(r.acrescimos),
      fmt(r.vrImposto), fmt(r.vrVendedor),
      fmt(r.valorBruto - r.taxas + r.acrescimos - r.vrImposto - r.vrVendedor),
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Curso', 'Nome', 'Bruto', 'Taxas', 'Acrésc.', 'Impostos', 'Com.Vend.', 'Líquido']],
      body: receitaRows,
      theme: 'striped', styles: { fontSize: 7 },
      headStyles: { fillColor: [66, 66, 66] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    autoTable(doc, { startY: y, body: [['SUBTOTAL RECEITAS', fmt(totalReceitaLiquida)]], theme: 'grid', styles: { fontSize: 9, fontStyle: 'bold' }, columnStyles: { 1: { halign: 'right' } } });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Despesas
    const despesaRows = despesasLAD.map(r => [r.date, r.descricao, fmt(r.valorLiquido)]);
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Descrição', 'Valor']],
      body: despesaRows,
      theme: 'striped', styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    autoTable(doc, { startY: y, body: [['SUBTOTAL DESPESAS', fmt(totalDespesasLAD)]], theme: 'grid', styles: { fontSize: 9, fontStyle: 'bold' }, columnStyles: { 1: { halign: 'right' } } });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Resultado
    autoTable(doc, {
      startY: y,
      body: [
        ['RESULTADO LÍQUIDO', fmt(resultadoLiquido)],
        ['COMISSÃO 10%', fmt(comissaoLAD)],
      ],
      theme: 'grid', styles: { fontSize: 11, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      bodyStyles: { fillColor: [220, 255, 220] },
    });

    doc.save(`Comissao_Lance_a_Dois_${monthName}_${year}.pdf`);
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
            <p className="text-xs text-muted-foreground">Comissão Lance a Dois (10%)</p>
            <p className="text-lg font-bold text-primary">{fmt(comissaoLAD)}</p>
            <p className="text-[10px] text-muted-foreground">Resultado Líquido: {fmt(resultadoLiquido)}</p>
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

      {/* Lance a Dois */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Comissão Lance a Dois</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => generateLADPDF()}>
              <FileText className="h-3 w-3 mr-1" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-4">
          {/* Receitas */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">RECEITAS (Lance a Dois)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Curso</TableHead>
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs text-right">Bruto</TableHead>
                  <TableHead className="text-xs text-right">Taxas</TableHead>
                  <TableHead className="text-xs text-right">Acrésc.</TableHead>
                  <TableHead className="text-xs text-right">Impostos</TableHead>
                  <TableHead className="text-xs text-right">Com.Vend.</TableHead>
                  <TableHead className="text-xs text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receitasLADSorted.map((r, i) => {
                  const liq = r.valorBruto - r.taxas + r.acrescimos - r.vrImposto - r.vrVendedor;
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.date}</TableCell>
                      <TableCell className="text-xs">{r.descricao}</TableCell>
                      <TableCell className="text-xs">{r.detalhamento}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(r.valorBruto)}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(r.taxas)}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(r.acrescimos)}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(r.vrImposto)}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(r.vrVendedor)}</TableCell>
                      <TableCell className="text-xs text-right font-bold">{fmt(liq)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="text-xs font-bold" colSpan={3}>SUBTOTAL RECEITAS</TableCell>
                  <TableCell className="text-xs text-right font-bold">{fmt(totaisReceitaLAD.bruto)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{fmt(totaisReceitaLAD.taxas)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{fmt(totaisReceitaLAD.acrescimos)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{fmt(totaisReceitaLAD.impostos)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{fmt(totaisReceitaLAD.comVend)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{fmt(totaisReceitaLAD.liquido)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Despesas */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">DESPESAS (Lance a Dois)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesasLAD.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{r.date}</TableCell>
                    <TableCell className="text-xs">{r.descricao}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(r.valorLiquido)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="text-xs font-bold" colSpan={2}>SUBTOTAL DESPESAS</TableCell>
                  <TableCell className="text-xs text-right font-bold">{fmt(totalDespesasLAD)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Resultado */}
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Resultado Líquido</span>
              <span className="font-bold">{fmt(resultadoLiquido)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-primary">Comissão 10%</span>
              <span className="font-bold text-primary">{fmt(comissaoLAD)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComissoesPainel;
