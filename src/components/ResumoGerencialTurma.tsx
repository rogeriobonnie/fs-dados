import { useMemo } from 'react';
import { FinancialRecord } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/utils/financialCalculations';
import {
  Users,
  UserX,
  AlertTriangle,
  Handshake,
  CheckCircle2,
  Clock,
  Wallet,
  TrendingUp,
} from 'lucide-react';

interface Props {
  data: FinancialRecord[];
}

type Bucket = 'VENCIDO' | 'EM_NEGOCIACAO' | 'DISTRATO' | 'A_PAGAR' | 'PAGO';

interface Agg {
  name: string;
  consultant: string;
  totalContracted: number;
  totalReceived: number;
  totalOpen: number;
  hasOverdue: boolean;
  hasNegociacao: boolean;
  hasDistrato: boolean;
  overdueAmount: number;
  bucket: Bucket;
}

const ResumoGerencialTurma = ({ data }: Props) => {
  const resumo = useMemo(() => {
    const map = new Map<string, Agg>();
    data.forEach(r => {
      if (!r.studentName) return;
      if (!map.has(r.studentName)) {
        map.set(r.studentName, {
          name: r.studentName,
          consultant: r.consultant || 'Venda Direta',
          totalContracted: 0,
          totalReceived: 0,
          totalOpen: 0,
          hasOverdue: false,
          hasNegociacao: false,
          hasDistrato: false,
          overdueAmount: 0,
          bucket: 'PAGO',
        });
      }
      const s = map.get(r.studentName)!;
      const valor = r.amount + (r.interest || 0) - (r.fees || 0);
      s.totalContracted += valor;
      if (r.status === 'PAGO') s.totalReceived += valor;
      else s.totalOpen += valor;
      if (r.status === 'VENCIDO') {
        s.hasOverdue = true;
        s.overdueAmount += valor;
      }
      if (r.status === 'EM NEGOCIACAO') s.hasNegociacao = true;
      if (r.isDistrato) s.hasDistrato = true;
    });

    const alunos = Array.from(map.values());
    alunos.forEach(s => {
      if (s.hasDistrato) s.bucket = 'DISTRATO';
      else if (s.hasOverdue) s.bucket = 'VENCIDO';
      else if (s.hasNegociacao) s.bucket = 'EM_NEGOCIACAO';
      else if (s.totalOpen > 0) s.bucket = 'A_PAGAR';
      else s.bucket = 'PAGO';
    });

    const by = (b: Bucket) => alunos.filter(a => a.bucket === b);
    const sum = (arr: Agg[], k: keyof Agg) =>
      arr.reduce((t, a) => t + (a[k] as number), 0);

    const distratos = by('DISTRATO');
    const atrasados = by('VENCIDO');
    const negociacao = by('EM_NEGOCIACAO');
    const emDia = by('A_PAGAR');
    const quitados = by('PAGO');

    const totalContratado = sum(alunos, 'totalContracted');
    const totalRecebido = sum(alunos, 'totalReceived');
    const totalAberto = sum(alunos, 'totalOpen');
    const totalVencido = sum(alunos, 'overdueAmount');
    const perdidoDistrato = sum(distratos, 'totalOpen');
    const aReceber = totalAberto - perdidoDistrato - totalVencido;

    // Consultoras
    const consultMap = new Map<string, { nome: string; alunos: number; contratado: number; recebido: number; aberto: number }>();
    alunos.forEach(a => {
      const key = a.consultant;
      if (!consultMap.has(key))
        consultMap.set(key, { nome: key, alunos: 0, contratado: 0, recebido: 0, aberto: 0 });
      const c = consultMap.get(key)!;
      c.alunos++;
      c.contratado += a.totalContracted;
      c.recebido += a.totalReceived;
      c.aberto += a.totalOpen;
    });

    return {
      alunos,
      distratos,
      atrasados,
      negociacao,
      emDia,
      quitados,
      totalContratado,
      totalRecebido,
      totalAberto,
      totalVencido,
      perdidoDistrato,
      aReceber,
      consultoras: Array.from(consultMap.values()).sort((a, b) => b.recebido - a.recebido),
      ticketMedio: alunos.length ? totalContratado / alunos.length : 0,
      parcelas: data.length,
      parcelasPagas: data.filter(r => r.status === 'PAGO').length,
    };
  }, [data]);

  const pctRecebido = resumo.totalContratado
    ? (resumo.totalRecebido / resumo.totalContratado) * 100
    : 0;

  const cards = [
    {
      label: 'Alunos no curso',
      value: String(resumo.alunos.length),
      sub: `${resumo.parcelas} parcelas • ${resumo.parcelasPagas} pagas`,
      icon: Users,
      className: 'text-primary',
    },
    {
      label: 'Alunos quitados',
      value: String(resumo.quitados.length),
      sub: formatCurrency(resumo.quitados.reduce((t, a) => t + a.totalReceived, 0)),
      icon: CheckCircle2,
      className: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Em dia (a pagar)',
      value: String(resumo.emDia.length),
      sub: formatCurrency(resumo.emDia.reduce((t, a) => t + a.totalOpen, 0)) + ' a receber',
      icon: Clock,
      className: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Alunos em atraso',
      value: String(resumo.atrasados.length),
      sub: formatCurrency(resumo.totalVencido) + ' vencido',
      icon: AlertTriangle,
      className: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Em negociação',
      value: String(resumo.negociacao.length),
      sub: formatCurrency(resumo.negociacao.reduce((t, a) => t + a.totalOpen, 0)) + ' em aberto',
      icon: Handshake,
      className: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Distratos',
      value: String(resumo.distratos.length),
      sub: formatCurrency(resumo.perdidoDistrato) + ' perdido',
      icon: UserX,
      className: 'text-zinc-600 dark:text-zinc-300',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-sky-100 dark:bg-sky-950/40 rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resumo Gerencial — FS Turma IV
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map(c => (
              <div key={c.label} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                  <c.icon className={`h-4 w-4 ${c.className}`} />
                </div>
                <div className={`text-2xl font-bold mt-1 ${c.className}`}>{c.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Total contratado</div>
              <div className="text-xl font-bold">{formatCurrency(resumo.totalContratado)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Total recebido</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(resumo.totalRecebido)}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">A receber (em dia)</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(resumo.aReceber)}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Vencido + distratos</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(resumo.totalVencido + resumo.perdidoDistrato)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Recebido sobre o contratado
              </span>
              <span className="font-semibold">{pctRecebido.toFixed(1)}%</span>
            </div>
            <Progress value={pctRecebido} className="h-3" />
            <div className="text-xs text-muted-foreground">
              Ticket médio por aluno: {formatCurrency(resumo.ticketMedio)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desempenho por consultora</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultora</TableHead>
                <TableHead className="text-right">Alunos</TableHead>
                <TableHead className="text-right">Contratado</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
                <TableHead className="text-right">% Recebido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.consultoras.map(c => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right">{c.alunos}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.contratado)}</TableCell>
                  <TableCell className="text-right text-green-600 dark:text-green-400">
                    {formatCurrency(c.recebido)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(c.aberto)}</TableCell>
                  <TableCell className="text-right">
                    {c.contratado ? ((c.recebido / c.contratado) * 100).toFixed(1) : '0.0'}%
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{resumo.alunos.length}</TableCell>
                <TableCell className="text-right">{formatCurrency(resumo.totalContratado)}</TableCell>
                <TableCell className="text-right">{formatCurrency(resumo.totalRecebido)}</TableCell>
                <TableCell className="text-right">{formatCurrency(resumo.totalAberto)}</TableCell>
                <TableCell className="text-right">{pctRecebido.toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumoGerencialTurma;
