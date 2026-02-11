import { useMemo, useState } from 'react';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';

interface Props {
  data: Pagina5Record[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CursosTerceirosPainel = ({ data }: Props) => {
  const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({});
  const toggleCourse = (key: string) => setOpenCourses(prev => ({ ...prev, [key]: !prev[key] }));

  const terceiros = useMemo(() => {
    const items = data.filter(r => r.custo.toUpperCase().includes('08-TERCEIROS') || r.custoNum === 8);
    
    // Group by course name
    const map = new Map<string, {
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
    }>();

    items.forEach(r => {
      const key = r.descricao || 'Sem descrição';
      if (!map.has(key)) {
        map.set(key, {
          nome: key,
          valorBruto: 0, taxas: 0, acrescimos: 0, valorLiquido: 0,
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

    map.forEach(c => {
      c.valorFinal = c.valorLiquido - c.vrImposto - c.vrVendedor - c.vrMkt;
    });

    return Array.from(map.values()).sort((a, b) => b.valorBruto - a.valorBruto);
  }, [data]);

  const totalBruto = terceiros.reduce((s, c) => s + c.valorBruto, 0);
  const totalLiquido = terceiros.reduce((s, c) => s + c.valorLiquido, 0);
  const totalFinal = terceiros.reduce((s, c) => s + c.valorFinal, 0);

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
                    <span className="font-bold text-sm">{fmt(curso.valorFinal)}</span>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4">
                  {/* Financial breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-xs">
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Bruto</span>
                      <p className="font-bold">{fmt(curso.valorBruto)}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Taxas</span>
                      <p className="font-bold">-{fmt(curso.taxas)}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Líquido</span>
                      <p className="font-bold">{fmt(curso.valorLiquido)}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Imposto</span>
                      <p className="font-bold">-{fmt(curso.vrImposto)}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Comissão Vendedor</span>
                      <p className="font-bold">-{fmt(curso.vrVendedor)}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Comissão MKT</span>
                      <p className="font-bold">-{fmt(curso.vrMkt)}</p>
                    </div>
                    <div className="p-2 rounded bg-primary/10 col-span-2">
                      <span className="text-muted-foreground font-semibold">Valor Final</span>
                      <p className="font-bold text-primary">{fmt(curso.valorFinal)}</p>
                    </div>
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
