import { useMemo, useState } from 'react';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, BookOpen, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  data: Pagina5Record[];
  selectedMonth?: string;
  selectedYear?: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface CursoTerceiro {
  nome: string;
  valorBruto: number;
  taxas: number;
  acrescimos: number;
  valorLiquido: number;
  vrImposto: number;
  vrVendedor: number;
  vrMkt: number;
  valorFinal: number;
  vendas: Pagina5Record[];
}

const CursosTerceirosPainel = ({ data, selectedMonth, selectedYear }: Props) => {
  const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({});
  const toggleCourse = (key: string) => setOpenCourses(prev => ({ ...prev, [key]: !prev[key] }));

  const monthName = selectedMonth ? MONTH_NAMES[parseInt(selectedMonth) - 1] : '';
  const year = selectedYear || '';

  const terceiros = useMemo(() => {
    const items = data.filter(r => r.custoNum === 97);

    const map = new Map<string, CursoTerceiro>();

    items.forEach(r => {
      const key = r.descricao || 'Sem descrição';
      if (!map.has(key)) {
        map.set(key, {
          nome: key, valorBruto: 0, taxas: 0, acrescimos: 0, valorLiquido: 0,
          vrImposto: 0, vrVendedor: 0, vrMkt: 0, valorFinal: 0, vendas: [],
        });
      }
      const c = map.get(key)!;
      c.valorBruto += r.valorBruto;
      c.taxas += r.taxas;
      c.acrescimos += r.acrescimos;
      c.valorLiquido += r.valorLiquido;
      c.vrImposto += r.vrImposto;
      c.vrVendedor += r.vrVendedor;
      c.vrMkt += r.vrMkt;
      c.vendas.push(r);
    });

    map.forEach(c => { c.valorFinal = c.valorLiquido - c.vrImposto - c.vrVendedor - c.vrMkt; });
    return Array.from(map.values()).sort((a, b) => b.valorBruto - a.valorBruto);
  }, [data]);

  const totalBruto = terceiros.reduce((s, c) => s + c.valorBruto, 0);
  const totalLiquido = terceiros.reduce((s, c) => s + c.valorLiquido, 0);
  const totalFinal = terceiros.reduce((s, c) => s + c.valorFinal, 0);

  // Generate individual PDF per curso
  const generateCursoPDF = (curso: CursoTerceiro) => {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Curso de Terceiro - ${curso.nome}`, 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} ${year}`, 14, y);
    y += 10;

    // Demonstrativo
    autoTable(doc, {
      startY: y,
      head: [['DEMONSTRATIVO', 'Valor']],
      body: [
        ['Receita Bruta (' + curso.vendas.length + ' vendas)', fmt(curso.valorBruto)],
        ['(-) Taxas de Plataforma', `-${fmt(curso.taxas)}`],
        ['(+) Acréscimos', fmt(curso.acrescimos)],
        ['= Valor Líquido', fmt(curso.valorLiquido)],
        ['', ''],
        ['(-) Impostos', `-${fmt(curso.vrImposto)}`],
        ['(-) Comissão Vendedor', `-${fmt(curso.vrVendedor)}`],
        ['(-) Comissão MKT', `-${fmt(curso.vrMkt)}`],
        ['= VALOR FINAL', fmt(curso.valorFinal)],
      ],
      theme: 'grid', styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body' && (data.row.index === 3 || data.row.index === 8)) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = data.row.index === 8 ? [220, 255, 220] : [240, 240, 240];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Vendas individuais
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Vendas Individuais', 14, y);
    y += 6;

    const rows = curso.vendas.map(v => [
      v.date, v.detalhamento, fmt(v.valorBruto), fmt(v.taxas), fmt(v.valorLiquido),
      v.vendedor || '-', v.vrVendedor > 0 ? fmt(v.vrVendedor) : '-', v.banco,
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Aluno', 'Bruto', 'Taxas', 'Líquido', 'Vendedor', 'Com.Vend', 'Banco']],
      body: rows,
      theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [100, 100, 100] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 6: { halign: 'right' } },
    });

    doc.save(`CursoTerceiro_${curso.nome.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`);
  };

  if (terceiros.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="p-8 text-center text-muted-foreground">
          Nenhum curso de terceiros encontrado no período.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Bruto</p>
            <p className="text-lg font-bold text-primary">{fmt(totalBruto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Líquido</p>
            <p className="text-lg font-bold">{fmt(totalLiquido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valor Final (- imp - comissões)</p>
            <p className="text-lg font-bold" style={{ color: 'hsl(var(--success))' }}>{fmt(totalFinal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Courses */}
      {terceiros.map(curso => {
        const isOpen = openCourses[curso.nome] ?? false;
        return (
          <Card key={curso.nome} className="border-l-4" style={{ borderLeftColor: 'hsl(var(--chart-5))' }}>
            <Collapsible open={isOpen} onOpenChange={() => toggleCourse(curso.nome)}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <BookOpen className="h-4 w-4" />
                      <CardTitle className="text-sm font-semibold">{curso.nome}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{curso.vendas.length} vendas</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{fmt(curso.valorFinal)}</span>
                      <Button
                        variant="ghost" size="sm" className="h-6 px-2"
                        onClick={(e) => { e.stopPropagation(); generateCursoPDF(curso); }}
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4">
                  {/* Demonstrativo vertical */}
                  <div className="rounded-lg border bg-muted/30 p-4 mb-4 space-y-1 text-sm">
                    <p className="text-xs font-bold text-muted-foreground mb-2">RECEITA</p>
                    <div className="flex justify-between"><span className="text-xs">Valor Bruto ({curso.vendas.length} vendas)</span><span className="text-xs font-semibold">{fmt(curso.valorBruto)}</span></div>
                    <div className="flex justify-between"><span className="text-xs">(-) Taxas de Plataforma</span><span className="text-xs font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(curso.taxas)}</span></div>
                    <div className="flex justify-between"><span className="text-xs">(+) Acréscimos</span><span className="text-xs font-semibold" style={{ color: 'hsl(var(--success))' }}>{fmt(curso.acrescimos)}</span></div>
                    <div className="border-t my-2" />
                    <div className="flex justify-between font-bold"><span className="text-xs">= Valor Líquido</span><span className="text-xs">{fmt(curso.valorLiquido)}</span></div>

                    <div className="mt-3" />
                    <p className="text-xs font-bold text-muted-foreground mb-2">DEDUÇÕES</p>
                    <div className="flex justify-between"><span className="text-xs">(-) Impostos</span><span className="text-xs font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(curso.vrImposto)}</span></div>
                    <div className="flex justify-between"><span className="text-xs">(-) Comissão Vendedor</span><span className="text-xs font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(curso.vrVendedor)}</span></div>
                    <div className="flex justify-between"><span className="text-xs">(-) Comissão MKT</span><span className="text-xs font-semibold" style={{ color: 'hsl(var(--destructive))' }}>-{fmt(curso.vrMkt)}</span></div>
                    <div className="border-t my-2" />
                    <div className="flex justify-between font-bold text-sm"><span>= VALOR FINAL</span><span className="text-primary">{fmt(curso.valorFinal)}</span></div>
                  </div>

                  {/* Individual sales */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1">Data</TableHead>
                        <TableHead className="text-xs py-1">Aluno</TableHead>
                        <TableHead className="text-xs py-1 text-right">Bruto</TableHead>
                        <TableHead className="text-xs py-1 text-right">Líquido</TableHead>
                        <TableHead className="text-xs py-1">Vendedor</TableHead>
                        <TableHead className="text-xs py-1 text-right">Com. Vend.</TableHead>
                        <TableHead className="text-xs py-1">MKT</TableHead>
                        <TableHead className="text-xs py-1 text-right">Com. MKT</TableHead>
                        <TableHead className="text-xs py-1">Banco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {curso.vendas.map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs py-1">{v.date}</TableCell>
                          <TableCell className="text-xs py-1">{v.detalhamento}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{fmt(v.valorBruto)}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{fmt(v.valorLiquido)}</TableCell>
                          <TableCell className="text-xs py-1">{v.vendedor}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{v.vrVendedor > 0 ? fmt(v.vrVendedor) : '-'}</TableCell>
                          <TableCell className="text-xs py-1">{v.mkt}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{v.vrMkt > 0 ? fmt(v.vrMkt) : '-'}</TableCell>
                          <TableCell className="text-xs py-1">{v.banco}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
};

export default CursosTerceirosPainel;
