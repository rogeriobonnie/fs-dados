import { useMemo } from 'react';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Megaphone } from 'lucide-react';

interface Props {
  data: Pagina5Record[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ComissoesPainel = ({ data }: Props) => {
  // Get records that have commission data (01-CURSOS + 08-TERCEIROS)
  const receitasComComissao = useMemo(() => {
    return data.filter(r => (r.custoNum === 1 || r.custoNum === 8) && (r.vrVendedor > 0 || r.vrMkt > 0));
  }, [data]);

  // Get paid commissions from 13-VENDAS
  const comissoesPagas = useMemo(() => {
    return data.filter(r => r.custo.includes('13-'));
  }, [data]);

  // Group by vendedor
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

  // Group by MKT
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
  const totalPago = comissoesPagas.reduce((s, r) => s + Math.abs(r.valorBruto), 0);

  return (
    <div className="space-y-6 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Pago (13-VENDAS)</p>
            <p className="text-lg font-bold" style={{ color: 'hsl(var(--success))' }}>{fmt(totalPago)}</p>
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

      {/* Comissões Pagas */}
      {comissoesPagas.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">Comissões Pagas (Despesa 13-VENDAS)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Detalhe</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs">Banco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comissoesPagas.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.date}</TableCell>
                    <TableCell className="text-xs">{r.descricao}</TableCell>
                    <TableCell className="text-xs">{r.detalhamento}</TableCell>
                    <TableCell className="text-xs text-right font-bold">{fmt(Math.abs(r.valorBruto))}</TableCell>
                    <TableCell className="text-xs">{r.banco}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="text-xs font-bold" colSpan={3}>TOTAL PAGO</TableCell>
                  <TableCell className="text-xs text-right font-bold">{fmt(totalPago)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComissoesPainel;
