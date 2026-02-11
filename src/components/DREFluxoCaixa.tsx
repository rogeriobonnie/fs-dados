import { useMemo, useState } from 'react';
import { Pagina5Record, FluxoCaixaBanco } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Landmark } from 'lucide-react';

interface Props {
  data: Pagina5Record[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const DREFluxoCaixa = ({ data }: Props) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleCourse = (key: string) => setOpenCourses(prev => ({ ...prev, [key]: !prev[key] }));

  // Group data by cost center
  const grouped = useMemo(() => {
    const saldoInicial = data.filter(r => r.custo.toUpperCase().includes('0-SALDO'));
    const receitas: Record<string, Pagina5Record[]> = {};
    const despesas: Record<string, Pagina5Record[]> = {};
    const destinacoes: Record<string, Pagina5Record[]> = {};
    const resgates = data.filter(r => r.custo.toUpperCase().includes('98-RESGATE'));
    const transferencias = data.filter(r => r.custo.toUpperCase().includes('99-TRANSFER'));

    data.forEach(r => {
      if (r.custoNum >= 1 && r.custoNum <= 10) {
        if (!receitas[r.custo]) receitas[r.custo] = [];
        receitas[r.custo].push(r);
      } else if (r.custoNum >= 11 && r.custoNum <= 20) {
        if (!despesas[r.custo]) despesas[r.custo] = [];
        despesas[r.custo].push(r);
      } else if (r.custoNum >= 21 && r.custoNum <= 30) {
        if (!destinacoes[r.custo]) destinacoes[r.custo] = [];
        destinacoes[r.custo].push(r);
      }
    });

    return { saldoInicial, receitas, despesas, destinacoes, resgates, transferencias };
  }, [data]);

  // Compute totals
  const totals = useMemo(() => {
    const totalSaldoInicial = grouped.saldoInicial.reduce((s, r) => s + r.valorBruto, 0);
    
    let totalReceitas = 0;
    Object.values(grouped.receitas).forEach(items => {
      items.forEach(r => { totalReceitas += r.valorLiquido; });
    });

    let totalDespesas = 0;
    Object.values(grouped.despesas).forEach(items => {
      items.forEach(r => { totalDespesas += Math.abs(r.valorLiquido); });
    });

    let totalDestinacoes = 0;
    Object.values(grouped.destinacoes).forEach(items => {
      items.forEach(r => { totalDestinacoes += Math.abs(r.valorBruto); });
    });

    const totalResgates = grouped.resgates.reduce((s, r) => s + r.valorBruto, 0);
    const resultado = totalReceitas - totalDespesas;

    return { totalSaldoInicial, totalReceitas, totalDespesas, totalDestinacoes, totalResgates, resultado };
  }, [grouped]);

  // Cash flow by bank
  const fluxoBancos = useMemo(() => {
    const bancos = new Map<string, FluxoCaixaBanco>();
    const ensureBanco = (b: string) => {
      if (!b || b === 'PROVISAO') return;
      if (!bancos.has(b)) {
        bancos.set(b, { banco: b, saldoInicial: 0, receitas: 0, despesas: 0, destinacoes: 0, resgates: 0, transferencias: 0, saldoFinal: 0 });
      }
    };

    grouped.saldoInicial.forEach(r => {
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.saldoInicial += r.valorBruto;
    });

    Object.values(grouped.receitas).flat().forEach(r => {
      if (r.banco === 'PROVISAO') return;
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.receitas += r.valorLiquido;
    });

    Object.values(grouped.despesas).flat().forEach(r => {
      if (r.banco === 'PROVISAO') return;
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.despesas += Math.abs(r.valorLiquido);
    });

    Object.values(grouped.destinacoes).flat().forEach(r => {
      if (r.banco === 'PROVISAO') return;
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.destinacoes += Math.abs(r.valorBruto);
    });

    grouped.resgates.forEach(r => {
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.resgates += r.valorBruto;
    });

    grouped.transferencias.forEach(r => {
      ensureBanco(r.banco);
      const b = bancos.get(r.banco);
      if (b) b.transferencias += r.valorBruto;
    });

    bancos.forEach(b => {
      b.saldoFinal = b.saldoInicial + b.receitas - b.despesas - b.destinacoes + b.resgates + b.transferencias;
    });

    return Array.from(bancos.values()).sort((a, b) => a.banco.localeCompare(b.banco));
  }, [grouped]);

  const fluxoTotal = useMemo(() => {
    return fluxoBancos.reduce(
      (acc, b) => ({
        saldoInicial: acc.saldoInicial + b.saldoInicial,
        receitas: acc.receitas + b.receitas,
        despesas: acc.despesas + b.despesas,
        destinacoes: acc.destinacoes + b.destinacoes,
        resgates: acc.resgates + b.resgates,
        transferencias: acc.transferencias + b.transferencias,
        saldoFinal: acc.saldoFinal + b.saldoFinal,
      }),
      { saldoInicial: 0, receitas: 0, despesas: 0, destinacoes: 0, resgates: 0, transferencias: 0, saldoFinal: 0 }
    );
  }, [fluxoBancos]);

  // Group courses within a revenue cost center (01-CURSOS, 05-COMISSAO, etc.)
  const groupByCourse = (items: Pagina5Record[]) => {
    const map = new Map<string, Pagina5Record[]>();
    items.forEach(r => {
      const key = r.descricao || 'Sem descrição';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  };

  const renderSectionTotal = (items: Pagina5Record[], field: 'valorLiquido' | 'valorBruto' = 'valorLiquido') => {
    const total = items.reduce((s, r) => s + (field === 'valorBruto' ? Math.abs(r.valorBruto) : r.valorLiquido), 0);
    return fmt(total);
  };

  const renderCostCenterSection = (custo: string, items: Pagina5Record[], type: 'receita' | 'despesa' | 'destinacao') => {
    const isOpen = openSections[custo] ?? false;
    const isCurso = custo.includes('01-CURSOS') || custo.includes('08-TERCEIROS');
    const total = items.reduce((s, r) => s + (type === 'receita' ? r.valorLiquido : Math.abs(r.valorBruto)), 0);
    const provisionItems = items.filter(r => r.banco === 'PROVISAO');

    return (
      <Card key={custo} className="border-l-4" style={{ borderLeftColor: type === 'receita' ? 'hsl(var(--success))' : type === 'despesa' ? 'hsl(var(--destructive))' : 'hsl(var(--warning))' }}>
        <Collapsible open={isOpen} onOpenChange={() => toggleSection(custo)}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CardTitle className="text-sm font-semibold">{custo}</CardTitle>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  {provisionItems.length > 0 && (
                    <Badge variant="outline" className="text-xs border-warning text-warning">
                      {provisionItems.length} provisão
                    </Badge>
                  )}
                </div>
                <span className="font-bold text-sm">{fmt(total)}</span>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-4 pb-4">
              {isCurso ? renderCourseBreakdown(items) : renderItemList(items)}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  const renderCourseBreakdown = (items: Pagina5Record[]) => {
    const courses = groupByCourse(items);
    return (
      <div className="space-y-2">
        {Array.from(courses.entries()).map(([nome, vendas]) => {
          const isOpen = openCourses[nome] ?? false;
          const totalBruto = vendas.reduce((s, r) => s + r.valorBruto, 0);
          const totalTaxas = vendas.reduce((s, r) => s + r.taxas, 0);
          const totalAcresc = vendas.reduce((s, r) => s + r.acrescimos, 0);
          const totalLiquido = vendas.reduce((s, r) => s + r.valorLiquido, 0);
          const totalImposto = vendas.reduce((s, r) => s + r.vrImposto, 0);

          return (
            <Collapsible key={nome} open={isOpen} onOpenChange={() => toggleCourse(nome)}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="text-sm font-medium">{nome}</span>
                    <Badge variant="outline" className="text-xs">{vendas.length}</Badge>
                  </div>
                  <span className="text-sm font-semibold">{fmt(totalLiquido)}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-6 space-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-4 flex-wrap">
                    <span>Bruto: <strong className="text-foreground">{fmt(totalBruto)}</strong></span>
                    {totalTaxas !== 0 && <span>Taxas: <strong className="text-foreground">-{fmt(totalTaxas)}</strong></span>}
                    {totalAcresc !== 0 && <span>Acrésc: <strong className="text-foreground">+{fmt(totalAcresc)}</strong></span>}
                    <span>Líquido: <strong className="text-foreground">{fmt(totalLiquido)}</strong></span>
                    {totalImposto !== 0 && <span>Imposto: <strong className="text-foreground">{fmt(totalImposto)}</strong></span>}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1">Data</TableHead>
                        <TableHead className="text-xs py-1">Aluno</TableHead>
                        <TableHead className="text-xs py-1 text-right">Bruto</TableHead>
                        <TableHead className="text-xs py-1 text-right">Líquido</TableHead>
                        <TableHead className="text-xs py-1">Banco</TableHead>
                        <TableHead className="text-xs py-1">Vendedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendas.map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs py-1">{v.date}</TableCell>
                          <TableCell className="text-xs py-1">{v.detalhamento}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{fmt(v.valorBruto)}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{fmt(v.valorLiquido)}</TableCell>
                          <TableCell className="text-xs py-1">
                            {v.banco === 'PROVISAO' ? (
                              <Badge variant="outline" className="text-xs border-warning text-warning">PROVISÃO</Badge>
                            ) : v.banco}
                          </TableCell>
                          <TableCell className="text-xs py-1">{v.vendedor}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };

  const renderItemList = (items: Pagina5Record[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs py-1">Data</TableHead>
          <TableHead className="text-xs py-1">Descrição</TableHead>
          <TableHead className="text-xs py-1">Detalhe</TableHead>
          <TableHead className="text-xs py-1 text-right">Valor</TableHead>
          <TableHead className="text-xs py-1">Banco</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(r => (
          <TableRow key={r.id}>
            <TableCell className="text-xs py-1">{r.date}</TableCell>
            <TableCell className="text-xs py-1">{r.descricao}</TableCell>
            <TableCell className="text-xs py-1">{r.detalhamento}</TableCell>
            <TableCell className="text-xs py-1 text-right">{fmt(Math.abs(r.valorBruto))}</TableCell>
            <TableCell className="text-xs py-1">
              {r.banco === 'PROVISAO' ? (
                <Badge variant="outline" className="text-xs border-warning text-warning">PROVISÃO</Badge>
              ) : r.banco}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Nenhum dado encontrado para o período selecionado. Verifique a conexão com a planilha.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* SALDO INICIAL */}
      {grouped.saldoInicial.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">SALDO INICIAL</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {grouped.saldoInicial.map(r => (
                <div key={r.id} className="flex justify-between items-center p-2 rounded bg-muted/50">
                  <span className="text-xs font-medium">{r.banco || r.descricao}</span>
                  <span className="text-sm font-bold">{fmt(r.valorBruto)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center p-2 rounded bg-primary/10 col-span-full md:col-span-1">
                <span className="text-xs font-bold">TOTAL</span>
                <span className="text-sm font-bold text-primary">{fmt(totals.totalSaldoInicial)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RECEITAS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" style={{ color: 'hsl(var(--success))' }} />
          <h3 className="text-lg font-bold">RECEITAS</h3>
          <span className="font-bold" style={{ color: 'hsl(var(--success))' }}>{fmt(totals.totalReceitas)}</span>
        </div>
        {Object.entries(grouped.receitas)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([custo, items]) => renderCostCenterSection(custo, items, 'receita'))}
      </div>

      {/* DESPESAS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" style={{ color: 'hsl(var(--destructive))' }} />
          <h3 className="text-lg font-bold">DESPESAS</h3>
          <span className="font-bold" style={{ color: 'hsl(var(--destructive))' }}>{fmt(totals.totalDespesas)}</span>
        </div>
        {Object.entries(grouped.despesas)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([custo, items]) => renderCostCenterSection(custo, items, 'despesa'))}
      </div>

      {/* RESULTADO DRE */}
      <Card className={`border-2 ${totals.resultado >= 0 ? 'border-primary' : 'border-destructive'}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <span className="font-bold text-lg">RESULTADO (Receitas - Despesas)</span>
          <span className={`text-xl font-bold ${totals.resultado >= 0 ? 'text-primary' : ''}`} style={totals.resultado < 0 ? { color: 'hsl(var(--destructive))' } : {}}>
            {fmt(totals.resultado)}
          </span>
        </CardContent>
      </Card>

      {/* DESTINAÇÕES */}
      {Object.keys(grouped.destinacoes).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" style={{ color: 'hsl(var(--warning))' }} />
            <h3 className="text-lg font-bold">DESTINAÇÕES E UTILIZAÇÕES</h3>
            <span className="font-bold" style={{ color: 'hsl(var(--warning))' }}>{fmt(totals.totalDestinacoes)}</span>
          </div>
          {Object.entries(grouped.destinacoes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([custo, items]) => renderCostCenterSection(custo, items, 'destinacao'))}
        </div>
      )}

      {/* RESGATES */}
      {grouped.resgates.length > 0 && (
        <Card className="border-l-4 border-l-primary">
          <Collapsible open={openSections['98-RESGATE']} onOpenChange={() => toggleSection('98-RESGATE')}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {openSections['98-RESGATE'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <CardTitle className="text-sm font-semibold">98-RESGATE</CardTitle>
                    <Badge variant="secondary" className="text-xs">{grouped.resgates.length}</Badge>
                  </div>
                  <span className="font-bold text-sm">{fmt(totals.totalResgates)}</span>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 px-4 pb-4">
                {renderItemList(grouped.resgates)}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* FLUXO DE CAIXA POR BANCO */}
      {fluxoBancos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">FLUXO DE CAIXA</h3>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-bold">Descrição</TableHead>
                      {fluxoBancos.map(b => (
                        <TableHead key={b.banco} className="text-xs font-bold text-right">{b.banco}</TableHead>
                      ))}
                      <TableHead className="text-xs font-bold text-right bg-muted/50">TOTAL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs font-medium">Saldo Inicial</TableCell>
                      {fluxoBancos.map(b => <TableCell key={b.banco} className="text-xs text-right">{fmt(b.saldoInicial)}</TableCell>)}
                      <TableCell className="text-xs text-right font-bold bg-muted/50">{fmt(fluxoTotal.saldoInicial)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs font-medium">(+) Receitas</TableCell>
                      {fluxoBancos.map(b => <TableCell key={b.banco} className="text-xs text-right" style={{ color: 'hsl(var(--success))' }}>{fmt(b.receitas)}</TableCell>)}
                      <TableCell className="text-xs text-right font-bold bg-muted/50" style={{ color: 'hsl(var(--success))' }}>{fmt(fluxoTotal.receitas)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs font-medium">(-) Despesas</TableCell>
                      {fluxoBancos.map(b => <TableCell key={b.banco} className="text-xs text-right" style={{ color: 'hsl(var(--destructive))' }}>{fmt(-b.despesas)}</TableCell>)}
                      <TableCell className="text-xs text-right font-bold bg-muted/50" style={{ color: 'hsl(var(--destructive))' }}>{fmt(-fluxoTotal.despesas)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs font-medium">(-) Destinações</TableCell>
                      {fluxoBancos.map(b => <TableCell key={b.banco} className="text-xs text-right" style={{ color: 'hsl(var(--warning))' }}>{fmt(-b.destinacoes)}</TableCell>)}
                      <TableCell className="text-xs text-right font-bold bg-muted/50" style={{ color: 'hsl(var(--warning))' }}>{fmt(-fluxoTotal.destinacoes)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs font-medium">(+) Resgates</TableCell>
                      {fluxoBancos.map(b => <TableCell key={b.banco} className="text-xs text-right">{fmt(b.resgates)}</TableCell>)}
                      <TableCell className="text-xs text-right font-bold bg-muted/50">{fmt(fluxoTotal.resgates)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs font-medium">(±) Transferências</TableCell>
                      {fluxoBancos.map(b => <TableCell key={b.banco} className="text-xs text-right">{fmt(b.transferencias)}</TableCell>)}
                      <TableCell className="text-xs text-right font-bold bg-muted/50">{fmt(fluxoTotal.transferencias)}</TableCell>
                    </TableRow>
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-primary/5">
                      <TableCell className="text-xs font-bold">SALDO FINAL</TableCell>
                      {fluxoBancos.map(b => (
                        <TableCell key={b.banco} className="text-xs text-right font-bold">
                          {fmt(b.saldoFinal)}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs text-right font-bold bg-primary/10">{fmt(fluxoTotal.saldoFinal)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DREFluxoCaixa;
