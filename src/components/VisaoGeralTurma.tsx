import { Fragment, useEffect, useMemo, useState } from 'react';
import { FinancialRecord } from '@/types/financial';
import { Pagina5Record } from '@/types/pagina5';
import { GoogleSheetsService } from '@/services/googleSheetsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import {
  computeContratos,
  computePagina2Turma,
  computePagina5Turma,
  type DRERecordLike,
  type Lancamento,
} from '@/utils/turma04Overview';
import { exportVisaoGeralTurmaPDF } from '@/utils/visaoGeralTurmaPdf';

interface Props {
  data: FinancialRecord[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SEM_MONTHS = [1, 2, 3, 4, 5, 6];
const SEM_YEAR = 2026;

const VisaoGeralTurma = ({ data }: Props) => {
  const [dre, setDre] = useState<DRERecordLike[]>([]);
  const [p5Data, setP5Data] = useState<Pagina5Record[]>([]);
  const [loading, setLoading] = useState(false);
  const [detKey, setDetKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dreRes, p5Res] = await Promise.all([
        GoogleSheetsService.fetchDREData().catch(() => []),
        GoogleSheetsService.fetchPagina5Data().catch(() => []),
      ]);
      setDre(dreRes as DRERecordLike[]);
      setP5Data(p5Res as Pagina5Record[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const contratos = useMemo(() => computeContratos(data), [data]);
  const { meses, total: totalP2 } = useMemo(() => computePagina2Turma(dre), [dre]);
  const p5 = useMemo(() => computePagina5Turma(p5Data, SEM_YEAR, SEM_MONTHS), [p5Data]);

  const toggleDet = (k: string) => setDetKey(prev => (prev === k ? null : k));

  const DetTable = ({ itens, titulo }: { itens: Lancamento[]; titulo: string }) => (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">{titulo}</div>
      {itens.length === 0 ? (
        <div className="text-xs text-muted-foreground">Sem lançamentos.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Data</TableHead>
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="text-right text-xs">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{l.data}</TableCell>
                <TableCell className="text-xs">{l.descricao}</TableCell>
                <TableCell className="text-right text-xs">{fmt(l.valor)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="text-xs font-semibold">Subtotal</TableCell>
              <TableCell className="text-right text-xs font-semibold">
                {fmt(itens.reduce((s, l) => s + l.valor, 0))}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );

  const clickCell = (k: string, valor: number) => (
    <TableCell
      className="cursor-pointer text-right underline decoration-dotted underline-offset-2 hover:bg-muted/60"
      onClick={() => toggleDet(k)}
    >
      {fmt(valor)}
    </TableCell>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Carregando...' : 'Atualizar bases'}
        </Button>
        <Button
          size="sm"
          onClick={() => exportVisaoGeralTurmaPDF({ contratos, meses, totalP2, p5 })}
        >
          <FileText className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Bloco 1 — Contratos */}
      <Card>
        <CardHeader className="rounded-t-lg bg-sky-100 dark:bg-sky-950/40">
          <CardTitle className="text-base">1. Contratos da turma (Página1)</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Alunos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Receita total contratada</TableCell>
                <TableCell className="text-right font-semibold">{fmt(contratos.totalContratado)}</TableCell>
                <TableCell className="text-right">{contratos.totalAlunos}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Valores recebidos</TableCell>
                <TableCell className="text-right text-green-600 dark:text-green-400">
                  {fmt(contratos.totalRecebido)}
                </TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Valores pendentes (em dia)</TableCell>
                <TableCell className="text-right text-blue-600 dark:text-blue-400">
                  {fmt(contratos.totalPendente)}
                </TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Valores vencidos</TableCell>
                <TableCell className="text-right text-red-600 dark:text-red-400">
                  {fmt(contratos.totalVencido)}
                </TableCell>
                <TableCell className="text-right">{contratos.alunosAtraso}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Distratos — recebido</TableCell>
                <TableCell className="text-right">{fmt(contratos.distratoRecebido)}</TableCell>
                <TableCell className="text-right">{contratos.alunosDistrato}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Distratos — perdido (aberto)</TableCell>
                <TableCell className="text-right text-red-600 dark:text-red-400">
                  {fmt(contratos.distratoPerdido)}
                </TableCell>
                <TableCell className="text-right">{contratos.alunosDistrato}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Já quitados</TableCell>
                <TableCell className="text-right text-green-600 dark:text-green-400">
                  {fmt(contratos.totalQuitado)}
                </TableCell>
                <TableCell className="text-right">{contratos.alunosQuitados}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Ticket médio por aluno</TableCell>
                <TableCell className="text-right">{fmt(contratos.ticketMedio)}</TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Parcelas pagas / total</TableCell>
                <TableCell className="text-right">
                  {contratos.parcelasPagas} de {contratos.parcelas}
                </TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bloco 2 — Página2 */}
      <Card>
        <CardHeader className="rounded-t-lg bg-sky-100 dark:bg-sky-950/40">
          <CardTitle className="text-base">2. Recebimentos ago–dez/2025 (Página2)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          <p className="text-xs text-muted-foreground">
            Impostos/taxas e comissões não vêm marcados por turma na Página2: são rateados pelo peso da
            receita bruta da turma no mês. Clique nos valores para ver o detalhamento.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Receita bruta</TableHead>
                <TableHead className="text-right">Impostos/Taxas</TableHead>
                <TableHead className="text-right">Com. vendedores</TableHead>
                <TableHead className="text-right">Com. Lance a Dois</TableHead>
                <TableHead className="text-right">Receita líquida</TableHead>
                <TableHead className="text-right">% turma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meses.map(m => (
                <Fragment key={m.month}>
                  <TableRow>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    {clickCell(`${m.month}-bruto`, m.bruto)}
                    {clickCell(`${m.month}-imp`, m.impostos)}
                    {clickCell(`${m.month}-vend`, m.comVendedor)}
                    {clickCell(`${m.month}-lad`, m.comLad)}
                    <TableCell className="text-right font-semibold">{fmt(m.liquido)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {(m.peso * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                  {detKey?.startsWith(`${m.month}-`) && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/20">
                        {detKey === `${m.month}-bruto` && (
                          <DetTable itens={m.receitas} titulo={`Recebimentos da Turma 04 — ${m.label}/2025`} />
                        )}
                        {detKey === `${m.month}-imp` && (
                          <DetTable
                            itens={m.impostosItens}
                            titulo={`Impostos/taxas rateados (${(m.peso * 100).toFixed(1)}% do mês) — ${m.label}/2025`}
                          />
                        )}
                        {detKey === `${m.month}-vend` && (
                          <DetTable
                            itens={m.comVendedorItens}
                            titulo={`Comissões de vendedores rateadas (${(m.peso * 100).toFixed(1)}%) — ${m.label}/2025`}
                          />
                        )}
                        {detKey === `${m.month}-lad` && (
                          <DetTable
                            itens={m.comLadItens}
                            titulo={`Comissões Lance a Dois rateadas (${(m.peso * 100).toFixed(1)}%) — ${m.label}/2025`}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold">{fmt(totalP2.bruto)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totalP2.impostos)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totalP2.comVendedor)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totalP2.comLad)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totalP2.liquido)}</TableCell>
                <TableCell className="text-right font-bold">{(totalP2.peso * 100).toFixed(1)}%</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Bloco 3 — Página5 */}
      <Card>
        <CardHeader className="rounded-t-lg bg-sky-100 dark:bg-sky-950/40">
          <CardTitle className="text-base">3. Resultado {p5.periodo} (Página5)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          <Table>
            <TableBody>
              {[
                ['Receita bruta', p5.bruto],
                ['Acréscimos (juros/multas)', p5.acrescimos],
                ['Taxas', p5.taxas],
                ['Receita líquida', p5.liquido],
                ['Impostos', p5.impostos],
                ['Comissão vendedores', p5.comVendedor],
                ['Comissão MKT (Lance a Dois)', p5.comMkt],
                ['Despesas de curso (coluna S / hands on)', p5.despCursos],
                ['Despesas totais', p5.despesasTotais],
              ].map(([label, valor]) => (
                <TableRow key={label as string}>
                  <TableCell>{label as string}</TableCell>
                  <TableCell className="text-right">{fmt(valor as number)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell className="font-bold">Resultado do semestre</TableCell>
                <TableCell
                  className={`text-right font-bold ${p5.resultado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {fmt(p5.resultado)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {p5.porMes.map(m => (
              <span key={m.label}>
                {m.label}: <strong className="text-foreground">{fmt(m.bruto)}</strong>
              </span>
            ))}
          </div>

          {p5.despesasItens.length > 0 && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => toggleDet('p5-desp')}>
                {detKey === 'p5-desp' ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Despesas diretas do semestre
              </Button>
              {detKey === 'p5-desp' && (
                <DetTable itens={p5.despesasItens} titulo="Despesas diretas (coluna S / hands on)" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco 4 — Consolidado */}
      <Card>
        <CardHeader className="rounded-t-lg bg-sky-100 dark:bg-sky-950/40">
          <CardTitle className="text-base">4. Consolidado da Turma 04</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Total contratado (Página1)</TableCell>
                <TableCell className="text-right font-semibold">{fmt(contratos.totalContratado)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Recebido até hoje (Página1)</TableCell>
                <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                  {fmt(contratos.totalRecebido)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Líquido apurado ago–dez/2025 (Página2)</TableCell>
                <TableCell className="text-right font-semibold">{fmt(totalP2.liquido)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Resultado {p5.periodo} (Página5)</TableCell>
                <TableCell
                  className={`text-right font-semibold ${p5.resultado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {fmt(p5.resultado)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Em aberto (em dia + vencido)</TableCell>
                <TableCell className="text-right font-semibold text-blue-600 dark:text-blue-400">
                  {fmt(contratos.totalPendente + contratos.totalVencido)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Perdido em distratos</TableCell>
                <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                  {fmt(contratos.distratoPerdido)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default VisaoGeralTurma;
