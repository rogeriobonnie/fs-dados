import { useMemo, useState } from 'react';
import { Pagina5Record } from '@/types/pagina5';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, FileText, LayoutGrid, List } from 'lucide-react';
import { exportResultadoCursosPDF, type CursoLinhaPDF } from '@/utils/semestralCursosPdf';
import { ladComissaoPorCursoMensal, normLad } from '@/utils/comissaoLadRateio';


interface Props {
  semData: Pagina5Record[];
  months: number[];
  year: number;
  semNum: number;
}

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const norm = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

const isTurmaAntiga = (descricao: string) => {
  const n = norm(descricao);
  return n.includes('TURMA IV') || n.includes('TURMA III');
};

const isHandsOn = (r: Pagina5Record) =>
  [r.custo, r.descricao, r.detalhamento, r.evento].some(v => norm(v).includes('HANDS ON'));

// Despesas rateáveis por receita
const RATEAVEIS = [11, 12, 14, 17, 18];
// Colunas de rateio detalhadas (15 = despesas de curso sem curso definido)
const RATEIO_COLS: { cn: number; label: string }[] = [
  { cn: 11, label: '11-Adm' },
  { cn: 12, label: '12-Mkt' },
  { cn: 14, label: '14-Plataf.' },
  { cn: 17, label: '17-Congr.' },
  { cn: 18, label: '18-Desp.Cur.' },
];

interface Linha {
  nome: string;
  qtd: number;
  bruto: number;
  taxas: number;
  acrescimos: number;
  impostos: number;
  comVendedor: number;
  comMkt: number;
  despDireta: number;
  rateio: number;
  rateioCols: Record<number, number>;
  liquido: number;
  resultado: number;
  porMes: number[];
  vendas: Pagina5Record[];
  despesas: Pagina5Record[];
}

const emptyLinha = (nome: string, nMeses: number): Linha => ({
  nome, qtd: 0, bruto: 0, taxas: 0, acrescimos: 0, impostos: 0, comVendedor: 0, comMkt: 0,
  despDireta: 0, rateio: 0, rateioCols: {}, liquido: 0, resultado: 0, porMes: Array(nMeses).fill(0), vendas: [], despesas: [],
});

const totalize = (linhas: Linha[]) =>
  linhas.reduce(
    (a, l) => ({
      qtd: a.qtd + l.qtd,
      bruto: a.bruto + l.bruto,
      taxas: a.taxas + l.taxas,
      impostos: a.impostos + l.impostos,
      comVendedor: a.comVendedor + l.comVendedor,
      comMkt: a.comMkt + l.comMkt,
      despDireta: a.despDireta + l.despDireta,
      rateio: a.rateio + l.rateio,
      rateioCols: RATEIO_COLS.reduce((acc, c) => {
        acc[c.cn] = (a.rateioCols[c.cn] || 0) + (l.rateioCols[c.cn] || 0);
        return acc;
      }, {} as Record<number, number>),
      liquido: a.liquido + l.liquido,
      resultado: a.resultado + l.resultado,
    }),
    { qtd: 0, bruto: 0, taxas: 0, impostos: 0, comVendedor: 0, comMkt: 0, despDireta: 0, rateio: 0, rateioCols: {} as Record<number, number>, liquido: 0, resultado: 0 },
  );


const SemestralResultadoCursos = ({ semData, months, year, semNum }: Props) => {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'lista' | 'meses'>('lista');
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const calc = useMemo(() => {
    const mIdx = (m: number) => months.indexOf(m);

    const addVenda = (map: Map<string, Linha>, key: string, r: Pagina5Record) => {
      if (!map.has(key)) map.set(key, emptyLinha(key, months.length));
      const l = map.get(key)!;
      l.qtd += 1;
      l.bruto += r.valorBruto;
      l.taxas += r.taxas;
      l.acrescimos += r.acrescimos;
      l.liquido += r.valorLiquido;
      l.impostos += r.vrImposto;
      l.comVendedor += r.vendedor ? r.vrVendedor : 0;
      // Com. MKT (L2) é preenchida depois, pelo rateio mensal da comissão Lance a Dois
      const i = mIdx(r.month);
      if (i >= 0) l.porMes[i] += r.valorBruto;
      l.vendas.push(r);
    };

    const cursos = new Map<string, Linha>();
    const turmas = new Map<string, Linha>();
    const outras = new Map<string, Linha>();

    semData.forEach(r => {
      const cn = r.custoNum;
      if (cn === 1) {
        if (isTurmaAntiga(r.descricao)) addVenda(turmas, r.descricao || 'Sem descrição', r);
        else addVenda(cursos, r.descricao || 'Sem descrição', r);
      } else if (cn === 2 || cn === 3 || cn === 5) {
        addVenda(outras, r.custo || 'Outras receitas', r);
      }
    });

    // ── Despesas ──
    const brutoCursos = Array.from(cursos.values()).reduce((s, l) => s + l.bruto, 0);
    const cursosNormMap = new Map<string, Linha>();
    cursos.forEach(l => cursosNormMap.set(norm(l.nome), l));
    // Column S (evento) can also point to Turma III/IV or other revenue lines
    const alvoNormMap = new Map<string, Linha>(cursosNormMap);
    [turmas, outras].forEach(m => m.forEach(l => alvoNormMap.set(norm(l.nome), l)));

    const rateaveis: Pagina5Record[] = [];
    const quinzeSobra: Pagina5Record[] = [];

    semData.forEach(r => {
      const cn = Math.floor(r.custoNum);
      if (cn < 11 || cn > 20) return;
      if ((r.banco || '').toUpperCase() === 'PAGO') return;
      if (cn === 13) return; // comissões de venda já contabilizadas por curso

      if (cn === 15) {
        if (isHandsOn(r)) {
          // abate na Turma IV
          const alvo = Array.from(turmas.values()).find(l => norm(l.nome).includes('TURMA IV'));
          if (alvo) {
            alvo.despDireta += Math.abs(r.valorLiquido);
            alvo.despesas.push(r);
          }
          return;
        }
        const evt = norm(r.evento);
        if (evt) {
          const direto =
            alvoNormMap.get(evt) ||
            Array.from(alvoNormMap.entries()).find(([k]) => k.includes(evt) || evt.includes(k))?.[1];
          if (direto) {
            direto.despDireta += Math.abs(r.valorLiquido);
            direto.despesas.push(r);
            return;
          }
        }
        quinzeSobra.push(r);
        return;
      }

      if (RATEAVEIS.includes(cn)) rateaveis.push(r);
    });

    const totalRateio = rateaveis.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
    const totalQuinzeSobra = quinzeSobra.reduce((s, r) => s + Math.abs(r.valorLiquido), 0);
    const totalPorCentro: Record<number, number> = {};
    RATEIO_COLS.forEach(c => { totalPorCentro[c.cn] = 0; });
    rateaveis.forEach(r => {
      const cn = Math.floor(r.custoNum);
      totalPorCentro[cn] = (totalPorCentro[cn] || 0) + Math.abs(r.valorLiquido);
    });

    cursos.forEach(l => {
      const peso = brutoCursos > 0 ? l.bruto / brutoCursos : 0;
      l.rateio = peso * totalRateio;
      l.despDireta += peso * totalQuinzeSobra;
      l.rateioCols = RATEIO_COLS.reduce((acc, c) => {
        acc[c.cn] = peso * (totalPorCentro[c.cn] || 0);
        return acc;
      }, {} as Record<number, number>);
    });

    // Comissão Lance a Dois rateada por curso (mês a mês, mesmo cálculo da aba Comissões)
    const ladPorCurso = ladComissaoPorCursoMensal(semData);
    const totalComMkt = Array.from(ladPorCurso.values()).reduce((s, v) => s + v, 0);
    [cursos, turmas, outras].forEach(m =>
      m.forEach(l => { l.comMkt = ladPorCurso.get(normLad(l.nome)) || 0; }),
    );

    const finish = (m: Map<string, Linha>) => {
      const arr = Array.from(m.values());
      arr.forEach(l => {
        l.resultado = l.liquido - l.impostos - l.comVendedor - l.comMkt - l.despDireta - l.rateio;
      });
      return arr.sort((a, b) => b.bruto - a.bruto);
    };


    return {
      cursos: finish(cursos),
      turmas: finish(turmas),
      outras: finish(outras),
      totalRateio,
      totalPorCentro,
      rateaveis,
      totalComMkt,
    };
  }, [semData, months]);


  const blocos = [
    { key: 'cursos', titulo: 'Cursos (01-CURSOS — vendas novas)', cor: [16, 185, 129] as [number, number, number], linhas: calc.cursos },
    { key: 'turmas', titulo: 'Recebimentos Turma III e Turma IV', cor: [37, 99, 235] as [number, number, number], linhas: calc.turmas },
    { key: 'outras', titulo: 'Outras receitas (patrocínios, exames, comissões)', cor: [124, 58, 237] as [number, number, number], linhas: calc.outras },
  ];

  const geral = totalize([...calc.cursos, ...calc.turmas, ...calc.outras]);

  const matriz = useMemo(
    () => [...calc.cursos, ...calc.turmas, ...calc.outras].map(l => ({
      nome: l.nome,
      meses: l.porMes,
      total: l.porMes.reduce((s, v) => s + v, 0),
    })),
    [calc],
  );

  const handlePDF = () => {
    const toPdf = (l: Linha): CursoLinhaPDF => ({
      nome: l.nome,
      qtd: l.qtd,
      bruto: l.bruto,
      medio: l.qtd > 0 ? l.bruto / l.qtd : 0,
      taxas: l.taxas,
      impostos: l.impostos,
      comVendedor: l.comVendedor,
      comMkt: l.comMkt,
      despDireta: l.despDireta,
      rateio: l.rateio,
      rateioCols: RATEIO_COLS.map(c => l.rateioCols[c.cn] || 0),
      liquido: l.liquido,
      resultado: l.resultado,
    });
    exportResultadoCursosPDF({
      periodo: `${year}/${semNum}`,
      blocos: blocos.map(b => ({ titulo: b.titulo, cor: b.cor, linhas: b.linhas.map(toPdf) })),
      rateioLabels: RATEIO_COLS.map(c => c.label),
      matriz,
      mesesLabels: months.map(m => MONTH_SHORT[m - 1]),
      resultadoSemestre: geral.resultado,
      liquidoSemestre: geral.liquido,
    });
  };

  const renderBloco = (bloco: typeof blocos[number]) => {
    if (bloco.linhas.length === 0) return null;
    const t = totalize(bloco.linhas);
    return (
      <Card key={bloco.key}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{bloco.titulo}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Curso / Receita</TableHead>
                  <TableHead className="text-xs text-center">Qtd</TableHead>
                  <TableHead className="text-xs text-right">Bruto</TableHead>
                  <TableHead className="text-xs text-right">Vlr médio</TableHead>
                  <TableHead className="text-xs text-right">Taxas</TableHead>
                  <TableHead className="text-xs text-right">Impostos</TableHead>
                  <TableHead className="text-xs text-right">Com. Vend.</TableHead>
                  <TableHead className="text-xs text-right">Com. MKT (L2)</TableHead>
                  <TableHead className="text-xs text-right">Desp. Cursos</TableHead>
                  {RATEIO_COLS.map(c => (
                    <TableHead key={c.cn} className="text-xs text-right whitespace-nowrap">{c.label}</TableHead>
                  ))}
                  <TableHead className="text-xs text-right">Despesas totais</TableHead>

                  <TableHead className="text-xs text-right">Líquido</TableHead>
                  <TableHead className="text-xs text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bloco.linhas.map(l => {
                  const isOpen = !!open[bloco.key + l.nome];
                  return (
                    <>
                      <TableRow
                        key={bloco.key + l.nome}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggle(bloco.key + l.nome)}
                      >
                        <TableCell className="text-xs font-medium">
                          <div className="flex items-center gap-1">
                            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {l.nome}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-center">{l.qtd}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(l.bruto)}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(l.qtd > 0 ? l.bruto / l.qtd : 0)}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{l.taxas ? `-${fmt(l.taxas)}` : '-'}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{l.impostos ? `-${fmt(l.impostos)}` : '-'}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{l.comVendedor ? `-${fmt(l.comVendedor)}` : '-'}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{l.comMkt ? `-${fmt(l.comMkt)}` : '-'}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{l.despDireta ? `-${fmt(l.despDireta)}` : '-'}</TableCell>
                        {RATEIO_COLS.map(c => (
                          <TableCell key={c.cn} className="text-xs text-right text-red-500">
                            {l.rateioCols[c.cn] ? `-${fmt(l.rateioCols[c.cn])}` : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-xs text-right font-semibold text-red-600">{l.despDireta + l.rateio ? `-${fmt(l.despDireta + l.rateio)}` : '-'}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">{fmt(l.liquido)}</TableCell>
                        <TableCell className={`text-xs text-right font-bold ${l.resultado >= 0 ? 'text-primary' : 'text-red-600'}`}>{fmt(l.resultado)}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={bloco.key + l.nome + '-det'} className="bg-muted/20">
                          <TableCell colSpan={12 + RATEIO_COLS.length} className="p-0">

                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Mês</TableHead>
                                  <TableHead className="text-xs text-center">Qtd</TableHead>
                                  <TableHead className="text-xs text-right">Bruto</TableHead>
                                  <TableHead className="text-xs text-right">Taxas</TableHead>
                                  <TableHead className="text-xs text-right">Impostos</TableHead>
                                  <TableHead className="text-xs text-right">Comissões</TableHead>
                                  <TableHead className="text-xs text-right">Líquido</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {months.map(m => {
                                  const vs = l.vendas.filter(v => v.month === m);
                                  if (vs.length === 0) return null;
                                  const bruto = vs.reduce((s, v) => s + v.valorBruto, 0);
                                  const taxas = vs.reduce((s, v) => s + v.taxas, 0);
                                  const imp = vs.reduce((s, v) => s + v.vrImposto, 0);
                                  const com = vs.reduce((s, v) => s + (v.vendedor ? v.vrVendedor : 0) + (v.mkt ? v.vrMkt : 0), 0);
                                  const liq = vs.reduce((s, v) => s + v.valorLiquido, 0);
                                  return (
                                    <TableRow key={m}>
                                      <TableCell className="pl-8 text-xs">{MONTH_SHORT[m - 1]}</TableCell>
                                      <TableCell className="text-xs text-center">{vs.length}</TableCell>
                                      <TableCell className="text-xs text-right">{fmt(bruto)}</TableCell>
                                      <TableCell className="text-xs text-right text-red-600">{taxas ? `-${fmt(taxas)}` : '-'}</TableCell>
                                      <TableCell className="text-xs text-right text-red-600">{imp ? `-${fmt(imp)}` : '-'}</TableCell>
                                      <TableCell className="text-xs text-right text-red-600">{com ? `-${fmt(com)}` : '-'}</TableCell>
                                      <TableCell className="text-xs text-right font-semibold">{fmt(liq)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                                {l.despesas.length > 0 && l.despesas.map(d => (
                                  <TableRow key={d.id} className="bg-red-50/50">
                                    <TableCell className="pl-8 text-xs" colSpan={6}>
                                      Despesa direta · {d.date} · {d.descricao} {d.detalhamento ? `— ${d.detalhamento}` : ''}
                                    </TableCell>
                                    <TableCell className="text-xs text-right text-red-600">-{fmt(Math.abs(d.valorLiquido))}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="text-xs font-bold">TOTAL</TableCell>
                  <TableCell className="text-xs text-center font-bold">{t.qtd}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{fmt(t.bruto)}</TableCell>
                  <TableCell className="text-xs text-right">-</TableCell>
                  <TableCell className="text-xs text-right font-bold text-red-600">-{fmt(t.taxas)}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-red-600">-{fmt(t.impostos)}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-red-600">-{fmt(t.comVendedor)}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-red-600">-{fmt(t.comMkt)}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-red-600">-{fmt(t.despDireta)}</TableCell>
                  {RATEIO_COLS.map(c => (
                    <TableCell key={c.cn} className="text-xs text-right font-bold text-red-500">
                      {t.rateioCols[c.cn] ? `-${fmt(t.rateioCols[c.cn])}` : '-'}
                    </TableCell>
                  ))}
                  <TableCell className="text-xs text-right font-bold text-red-600">-{fmt(t.despDireta + t.rateio)}</TableCell>

                  <TableCell className="text-xs text-right font-bold">{fmt(t.liquido)}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-primary">{fmt(t.resultado)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Rateio por receita bruta — total <strong>{fmt(calc.totalRateio)}</strong>:{' '}
          {RATEIO_COLS.map(c => `${c.label} ${fmt(calc.totalPorCentro[c.cn] || 0)}`).join(' · ')}. Com. MKT (L2) = comissão Lance a Dois do mês (10% do resultado líquido L2) rateada por curso pela receita líquida — total do semestre <strong>{fmt(calc.totalComMkt)}</strong>; 13-Vendas fora (já em Com. Vend.).

        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setView(v => (v === 'lista' ? 'meses' : 'lista'))}>
            {view === 'lista' ? <LayoutGrid className="mr-1 h-4 w-4" /> : <List className="mr-1 h-4 w-4" />}
            {view === 'lista' ? 'Meses em colunas' : 'Lista de cursos'}
          </Button>
          <Button size="sm" onClick={handlePDF}>
            <FileText className="mr-1 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {view === 'lista' ? (
        <div className="space-y-4">{blocos.map(renderBloco)}</div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Receita bruta por mês</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Curso / Receita</TableHead>
                    {months.map(m => (
                      <TableHead key={m} className="text-xs text-right">{MONTH_SHORT[m - 1]}</TableHead>
                    ))}
                    <TableHead className="text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matriz.map(row => (
                    <TableRow key={row.nome}>
                      <TableCell className="text-xs font-medium">{row.nome}</TableCell>
                      {row.meses.map((v, i) => (
                        <TableCell key={i} className="text-xs text-right">{v ? fmt(v) : '-'}</TableCell>
                      ))}
                      <TableCell className="text-xs text-right font-semibold">{fmt(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="text-xs font-bold">TOTAL</TableCell>
                    {months.map((_, i) => (
                      <TableCell key={i} className="text-xs text-right font-bold">
                        {fmt(matriz.reduce((s, r) => s + r.meses[i], 0))}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs text-right font-bold">
                      {fmt(matriz.reduce((s, r) => s + r.total, 0))}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900 text-white">
        <CardContent className="grid grid-cols-2 gap-4 p-4">
          <div>
            <div className="text-xs text-slate-300">Receita líquida do semestre</div>
            <div className="text-xl font-bold">{fmt(geral.liquido)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-300">Resultado do semestre</div>
            <div className="text-xl font-bold">{fmt(geral.resultado)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SemestralResultadoCursos;
