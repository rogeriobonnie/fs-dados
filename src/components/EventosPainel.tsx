import { useMemo, useState } from 'react';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileDown, CalendarDays } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EventosPainelProps {
  data: Pagina5Record[];
  allData: Pagina5Record[];
  selectedMonth: string;
  selectedYear: string;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

interface EventoAgrupado {
  key: string;
  nome: string;
  registros: Pagina5Record[];
  receitaLiquida: number;
  despesas: number;
  resultado: number;
  periodo: string;
}

const EventosPainel = ({ data, allData, selectedMonth, selectedYear }: EventosPainelProps) => {
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const baseData = allData;

  const eventos = useMemo<EventoAgrupado[]>(() => {
    const map = new Map<string, EventoAgrupado>();
    for (const r of baseData) {
      if (!r.evento || !r.evento.trim()) continue;
      const key = normalize(r.evento);
      if (!map.has(key)) {
        map.set(key, {
          key,
          nome: r.evento.trim(),
          registros: [],
          receitaLiquida: 0,
          despesas: 0,
          resultado: 0,
          periodo: '',
        });
      }
      map.get(key)!.registros.push(r);
    }

    const parseDate = (d: string) => {
      const [dd, mm, yy] = d.split('/');
      return new Date(parseInt(yy), parseInt(mm) - 1, parseInt(dd)).getTime();
    };

    const result = Array.from(map.values()).map((e) => {
      let receitaLiquida = 0;
      let despesas = 0;
      for (const r of e.registros) {
        if (r.custoNum >= 1 && r.custoNum <= 10) {
          receitaLiquida += r.valorLiquido - r.vrImposto - r.vrVendedor - r.vrMkt;
        } else if (r.custoNum >= 11 && r.custoNum <= 30) {
          despesas += Math.abs(r.valorLiquido);
        }
      }
      const datas = e.registros.map((r) => r.date).filter(Boolean);
      const sorted = [...datas].sort((a, b) => parseDate(a) - parseDate(b));
      const periodo = sorted.length
        ? sorted.length === 1
          ? sorted[0]
          : `${sorted[0]} → ${sorted[sorted.length - 1]}`
        : '—';
      return {
        ...e,
        receitaLiquida,
        despesas,
        resultado: receitaLiquida - despesas,
        periodo,
      };
    });

    return result.sort((a, b) => b.resultado - a.resultado);
  }, [baseData]);

  const eventoAtual = useMemo(
    () => eventos.find((e) => e.key === selecionado) || null,
    [eventos, selecionado],
  );

  const receitasDoEvento = useMemo(() => {
    if (!eventoAtual) return [];
    return eventoAtual.registros
      .filter((r) => r.custoNum >= 1 && r.custoNum <= 10)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [eventoAtual]);

  const despesasDoEvento = useMemo(() => {
    if (!eventoAtual) return [];
    return eventoAtual.registros
      .filter((r) => r.custoNum >= 11 && r.custoNum <= 30)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [eventoAtual]);

  const totaisReceita = useMemo(() => {
    return receitasDoEvento.reduce(
      (acc, r) => ({
        bruto: acc.bruto + r.valorBruto,
        impostos: acc.impostos + r.vrImposto,
        comVend: acc.comVend + r.vrVendedor,
        comMkt: acc.comMkt + r.vrMkt,
        liquido: acc.liquido + (r.valorLiquido - r.vrImposto - r.vrVendedor - r.vrMkt),
      }),
      { bruto: 0, impostos: 0, comVend: 0, comMkt: 0, liquido: 0 },
    );
  }, [receitasDoEvento]);

  const totalDespesas = useMemo(
    () => despesasDoEvento.reduce((s, r) => s + Math.abs(r.valorLiquido), 0),
    [despesasDoEvento],
  );

  const exportPDF = () => {
    if (!eventoAtual) return;
    const doc = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 14;

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Demonstrativo de Evento', marginX, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(eventoAtual.nome.toUpperCase(), marginX, 19);
    doc.setFontSize(9);
    doc.text(`Período: ${eventoAtual.periodo}`, marginX, 24);
    doc.text(
      `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
      pageWidth - marginX,
      24,
      { align: 'right' },
    );

    doc.setTextColor(0, 0, 0);
    let y = 36;

    // Receitas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(22, 101, 52);
    doc.text('Receitas', marginX, y);
    y += 2;

    autoTable(doc, {
      startY: y + 2,
      head: [['Data', 'Descrição', 'Detalhamento', 'Bruto', 'Impostos', 'Vend.', 'Mkt', 'Líquido']],
      body: receitasDoEvento.map((r) => [
        r.date,
        r.descricao,
        r.detalhamento,
        fmt(r.valorBruto),
        fmt(r.vrImposto),
        fmt(r.vrVendedor),
        fmt(r.vrMkt),
        fmt(r.valorLiquido - r.vrImposto - r.vrVendedor - r.vrMkt),
      ]),
      foot: [[
        'TOTAL', '', '',
        fmt(totaisReceita.bruto),
        fmt(totaisReceita.impostos),
        fmt(totaisReceita.comVend),
        fmt(totaisReceita.comMkt),
        fmt(totaisReceita.liquido),
      ]],
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      footStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold' },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
      },
      margin: { left: marginX, right: marginX },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Despesas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(153, 27, 27);
    doc.text('Despesas', marginX, y);

    autoTable(doc, {
      startY: y + 2,
      head: [['Data', 'Descrição', 'Detalhamento', 'Centro de Custo', 'Banco', 'Valor']],
      body: (() => {
        const groupsMap = new Map<string, { nome: string; itens: typeof despesasDoEvento; total: number }>();
        for (const r of despesasDoEvento) {
          const key = normalize(r.descricao || '(sem descrição)');
          if (!groupsMap.has(key)) {
            groupsMap.set(key, { nome: (r.descricao || '(sem descrição)').trim(), itens: [], total: 0 });
          }
          const g = groupsMap.get(key)!;
          g.itens.push(r);
          g.total += Math.abs(r.valorLiquido);
        }
        const grupos = Array.from(groupsMap.values()).sort((a, b) => b.total - a.total);
        const rows: any[] = [];
        subtotalRowsIdx.clear();
        let idx = 0;
        for (const g of grupos) {
          const itens = [...g.itens].sort((a, b) => a.date.localeCompare(b.date));
          for (const r of itens) {
            rows.push([r.date, r.descricao, r.detalhamento, r.custo, r.banco, fmt(Math.abs(r.valorLiquido))]);
            idx++;
          }
          rows.push([
            { content: `Subtotal — ${g.nome} (${itens.length} lanç.)`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: fmt(g.total), styles: { halign: 'right', fontStyle: 'bold' } },
          ]);
          subtotalRowsIdx.add(idx);
          idx++;
        }
        return rows;
      })(),
      foot: [['TOTAL', '', '', '', '', fmt(totalDespesas)]],
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [153, 27, 27], textColor: 255 },
      footStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold' },
      columnStyles: { 5: { halign: 'right' } },
      margin: { left: marginX, right: marginX },
      showHead: 'everyPage',
      didParseCell: (data) => {
        if (data.section === 'body' && subtotalRowsIdx.has(data.row.index)) {
          data.cell.styles.fillColor = [243, 244, 246];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Resultado box
    const resultado = totaisReceita.liquido - totalDespesas;
    const positivo = resultado >= 0;
    doc.setFillColor(positivo ? 22 : 153, positivo ? 101 : 27, positivo ? 52 : 27);
    doc.rect(marginX, y, pageWidth - marginX * 2, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('RESULTADO DO EVENTO', marginX + 4, y + 7);
    doc.setFontSize(16);
    doc.text(fmt(resultado), pageWidth - marginX - 4, y + 12, { align: 'right' });

    // Footer page numbers
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pages}`,
        pageWidth - marginX,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'right' },
      );
    }

    doc.save(`evento-${normalize(eventoAtual.nome).replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  if (eventoAtual) {
    const resultado = totaisReceita.liquido - totalDespesas;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setSelecionado(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <Button onClick={exportPDF} size="sm">
            <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {eventoAtual.nome}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Período: {eventoAtual.periodo}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-md bg-success/10 border border-success/20">
                <p className="text-xs text-muted-foreground">Receita Líquida</p>
                <p className="text-lg font-bold text-success">{fmt(totaisReceita.liquido)}</p>
              </div>
              <div className="p-3 rounded-md bg-danger/10 border border-danger/20">
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="text-lg font-bold text-danger">{fmt(totalDespesas)}</p>
              </div>
              <div className={`p-3 rounded-md border ${resultado >= 0 ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
                <p className="text-xs text-muted-foreground">Resultado</p>
                <p className={`text-lg font-bold ${resultado >= 0 ? 'text-success' : 'text-danger'}`}>
                  {fmt(resultado)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-success">Receitas</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Detalhamento</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Impostos</TableHead>
                  <TableHead className="text-right">Vend.</TableHead>
                  <TableHead className="text-right">Mkt</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receitasDoEvento.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.descricao}</TableCell>
                    <TableCell>{r.detalhamento}</TableCell>
                    <TableCell className="text-right">{fmt(r.valorBruto)}</TableCell>
                    <TableCell className="text-right">{fmt(r.vrImposto)}</TableCell>
                    <TableCell className="text-right">{fmt(r.vrVendedor)}</TableCell>
                    <TableCell className="text-right">{fmt(r.vrMkt)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt(r.valorLiquido - r.vrImposto - r.vrVendedor - r.vrMkt)}
                    </TableCell>
                  </TableRow>
                ))}
                {receitasDoEvento.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Sem receitas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-danger">Despesas</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Detalhamento</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesasDoEvento.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.descricao}</TableCell>
                    <TableCell>{r.detalhamento}</TableCell>
                    <TableCell>{r.custo}</TableCell>
                    <TableCell>{r.banco}</TableCell>
                    <TableCell className="text-right">{fmt(Math.abs(r.valorLiquido))}</TableCell>
                  </TableRow>
                ))}
                {despesasDoEvento.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Sem despesas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Mostrando todos os eventos da planilha (sem filtro de mês/ano)
        </span>
        <span className="text-xs text-muted-foreground">
          {eventos.length} evento(s) encontrado(s)
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Índice de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Lançamentos</TableHead>
                <TableHead className="text-right">Receita Líquida</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.map((e) => (
                <TableRow
                  key={e.key}
                  className="cursor-pointer"
                  onClick={() => setSelecionado(e.key)}
                >
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{e.periodo}</TableCell>
                  <TableCell className="text-right">{e.registros.length}</TableCell>
                  <TableCell className="text-right text-success">
                    {fmt(e.receitaLiquida)}
                  </TableCell>
                  <TableCell className="text-right text-danger">{fmt(e.despesas)}</TableCell>
                  <TableCell
                    className={`text-right font-bold ${e.resultado >= 0 ? 'text-success' : 'text-danger'}`}
                  >
                    {fmt(e.resultado)}
                  </TableCell>
                </TableRow>
              ))}
              {eventos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum evento cadastrado na coluna S (Evento) para o período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventosPainel;