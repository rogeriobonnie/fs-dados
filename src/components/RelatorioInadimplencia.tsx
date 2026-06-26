import { useMemo, useState } from 'react';
import { FinancialRecord } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StudentDetailModal } from '@/components/StudentDetailModal';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatDateBR } from '@/utils/dateUtils';
import {
  AlertTriangle,
  Handshake,
  UserX,
  Clock,
  CheckCircle2,
  FileDown,
} from 'lucide-react';
import { exportInadimplenciaPDF, ReportSummary } from '@/utils/inadimplenciaPdf';
import type { GroupKey, StudentAggregate } from './RelatorioInadimplencia.types';

interface Props {
  data: FinancialRecord[];
}

const GROUP_META: Record<
  GroupKey,
  { title: string; icon: JSX.Element; color: string; bg: string; text: string }
> = {
  VENCIDO: {
    title: 'Em Atraso',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'hsl(0 84% 50%)',
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-300',
  },
  EM_NEGOCIACAO: {
    title: 'Em Negociação / Acordo',
    icon: <Handshake className="h-4 w-4" />,
    color: 'hsl(25 95% 50%)',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-700 dark:text-orange-300',
  },
  DISTRATO: {
    title: 'Distratos',
    icon: <UserX className="h-4 w-4" />,
    color: 'hsl(240 5% 35%)',
    bg: 'bg-zinc-100 dark:bg-zinc-900/50',
    text: 'text-zinc-700 dark:text-zinc-300',
  },
  A_PAGAR: {
    title: 'A Pagar (em dia)',
    icon: <Clock className="h-4 w-4" />,
    color: 'hsl(217 91% 55%)',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-300',
  },
  PAGO: {
    title: 'Pagos / Adimplentes',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'hsl(142 71% 40%)',
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-700 dark:text-green-300',
  },
};

const ORDER: GroupKey[] = ['VENCIDO', 'EM_NEGOCIACAO', 'DISTRATO', 'A_PAGAR', 'PAGO'];

const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

const RelatorioInadimplencia = ({ data }: Props) => {
  const [selected, setSelected] = useState<StudentAggregate | null>(null);

  const { groups, summary, allStudents } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const map = new Map<string, StudentAggregate>();
    data.forEach(r => {
      if (!r.studentName) return;
      if (!map.has(r.studentName)) {
        map.set(r.studentName, {
          name: r.studentName,
          consultant: r.consultant || 'Venda Direta',
          contractDate: r.contractDate,
          totalContracted: 0,
          totalReceived: 0,
          totalOpen: 0,
          installmentsPaid: 0,
          totalInstallments: 0,
          maxDaysOverdue: 0,
          worstStatus: 'PAGO',
          hasOverdue: false,
          hasNegociacao: false,
          hasDistrato: false,
          records: [],
          observations: [],
          specialConditions: [],
        });
      }
      const s = map.get(r.studentName)!;
      s.records.push(r);
      const obs = (r.contractObservation || '').trim();
      if (obs && !s.observations.includes(obs)) s.observations.push(obs);
      const sc = (r.specialCondition || '').trim();
      if (sc && !s.specialConditions.includes(sc)) s.specialConditions.push(sc);
      s.totalInstallments++;
      const finalAmount = r.amount + (r.interest || 0) - (r.fees || 0);
      s.totalContracted += finalAmount;
      if (r.status === 'PAGO') {
        s.totalReceived += finalAmount;
        s.installmentsPaid++;
      } else {
        s.totalOpen += finalAmount;
      }
      if (r.status === 'VENCIDO') {
        s.hasOverdue = true;
        const due = new Date(r.dueDate);
        if (!isNaN(due.getTime())) {
          const d = daysBetween(today, due);
          if (d > s.maxDaysOverdue) s.maxDaysOverdue = d;
        }
      }
      if (r.status === 'EM NEGOCIACAO') s.hasNegociacao = true;
      if (r.isDistrato) s.hasDistrato = true;
    });

    // Decide worst status (priority: DISTRATO > VENCIDO > EM_NEGOCIACAO > A_PAGAR > PAGO)
    const list = Array.from(map.values());
    list.forEach(s => {
      if (s.hasDistrato) s.worstStatus = 'DISTRATO';
      else if (s.hasOverdue) s.worstStatus = 'VENCIDO';
      else if (s.hasNegociacao) s.worstStatus = 'EM_NEGOCIACAO';
      else if (s.totalOpen > 0) s.worstStatus = 'A_PAGAR';
      else s.worstStatus = 'PAGO';
    });

    const groups: Record<GroupKey, StudentAggregate[]> = {
      VENCIDO: [],
      EM_NEGOCIACAO: [],
      DISTRATO: [],
      A_PAGAR: [],
      PAGO: [],
    };
    list.forEach(s => groups[s.worstStatus].push(s));

    // Sorting per group
    groups.VENCIDO.sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue);
    groups.EM_NEGOCIACAO.sort((a, b) => b.totalOpen - a.totalOpen);
    groups.DISTRATO.sort((a, b) => b.totalOpen - a.totalOpen);
    groups.A_PAGAR.sort((a, b) => b.totalOpen - a.totalOpen);
    groups.PAGO.sort((a, b) => b.totalReceived - a.totalReceived);

    const sum = (arr: StudentAggregate[], k: keyof StudentAggregate) =>
      arr.reduce((a, s) => a + (s[k] as number), 0);

    const summary: ReportSummary = {
      totalContracted: sum(list, 'totalContracted'),
      totalReceived: sum(list, 'totalReceived'),
      totalOpen: sum(list, 'totalOpen'),
      totalOverdue: sum(groups.VENCIDO, 'totalOpen'),
      // Distrato considera valores pagos + em aberto (contratado total)
      totalLost: sum(groups.DISTRATO, 'totalContracted'),
      inadimplenciaPct: 0,
      byGroup: {
        VENCIDO: { count: groups.VENCIDO.length, total: sum(groups.VENCIDO, 'totalOpen') },
        EM_NEGOCIACAO: {
          count: groups.EM_NEGOCIACAO.length,
          total: sum(groups.EM_NEGOCIACAO, 'totalOpen'),
        },
        DISTRATO: { count: groups.DISTRATO.length, total: sum(groups.DISTRATO, 'totalContracted') },
        A_PAGAR: { count: groups.A_PAGAR.length, total: sum(groups.A_PAGAR, 'totalOpen') },
        PAGO: { count: groups.PAGO.length, total: sum(groups.PAGO, 'totalReceived') },
      },
    };
    summary.inadimplenciaPct =
      summary.totalContracted > 0
        ? ((summary.totalOverdue + summary.totalLost) / summary.totalContracted) * 100
        : 0;

    return { groups, summary, allStudents: list };
  }, [data]);

  const handleExport = () => exportInadimplenciaPDF(groups, summary);

  const modalStudent = selected && {
    name: selected.name,
    totalAmount: selected.totalContracted,
    paidAmount: selected.totalReceived,
    pendingAmount: selected.totalOpen,
    overdueAmount: selected.hasOverdue
      ? selected.records
          .filter(r => r.status === 'VENCIDO')
          .reduce((a, r) => a + r.amount + (r.interest || 0) - (r.fees || 0), 0)
      : 0,
    paidPercentage:
      selected.totalContracted > 0
        ? (selected.totalReceived / selected.totalContracted) * 100
        : 0,
    status:
      selected.worstStatus === 'PAGO'
        ? ('completed' as const)
        : selected.worstStatus === 'VENCIDO'
        ? ('overdue' as const)
        : ('current' as const),
    installmentsPaid: selected.installmentsPaid,
    totalInstallments: selected.totalInstallments,
    daysOverdue: selected.maxDaysOverdue,
    consultant: selected.consultant,
    contractDate: selected.contractDate,
    records: selected.records,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Relatório de Inadimplência</h2>
          <p className="text-sm text-muted-foreground">
            {allStudents.length} alunos · {data.length} parcelas analisadas
          </p>
        </div>
        <Button onClick={handleExport} className="gap-2">
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {ORDER.map(key => {
          const meta = GROUP_META[key];
          const s = summary.byGroup[key];
          return (
            <Card
              key={key}
              className={`border-l-4 ${meta.bg}`}
              style={{ borderLeftColor: meta.color }}
            >
              <CardHeader className="pb-2">
                <CardTitle className={`text-xs font-medium flex items-center gap-2 ${meta.text}`}>
                  {meta.icon}
                  {meta.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">alunos</p>
                <p className="text-sm font-semibold mt-1">{formatCurrency(s.total)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Consolidated bar */}
      <Card className="bg-slate-900 text-white">
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-4 py-4">
          {[
            ['Contratado', formatCurrency(summary.totalContracted), 'text-white'],
            ['Recebido', formatCurrency(summary.totalReceived), 'text-green-400'],
            ['Em aberto', formatCurrency(summary.totalOpen), 'text-blue-300'],
            ['Em atraso', formatCurrency(summary.totalOverdue), 'text-red-400'],
            ['Perdido', formatCurrency(summary.totalLost), 'text-zinc-400'],
            ['% Inadimplência', `${summary.inadimplenciaPct.toFixed(1)}%`, 'text-orange-400'],
          ].map(([label, value, cls]) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
              <p className={`text-lg font-bold ${cls}`}>{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sections */}
      {ORDER.map(key => {
        const list = groups[key];
        if (list.length === 0) return null;
        const meta = GROUP_META[key];
        const showObs = key === 'VENCIDO' || key === 'DISTRATO';
        const totals = {
          contracted: list.reduce((a, s) => a + s.totalContracted, 0),
          received: list.reduce((a, s) => a + s.totalReceived, 0),
          open: list.reduce((a, s) => a + s.totalOpen, 0),
        };
        return (
          <Card key={key} className="overflow-hidden">
            <CardHeader
              className="text-white"
              style={{ background: meta.color }}
            >
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  {meta.icon}
                  {meta.title}
                  <Badge variant="secondary" className="ml-2">
                    {list.length}
                  </Badge>
                </span>
                <span className="text-sm font-normal">
                  {key === 'PAGO'
                    ? `Recebido: ${formatCurrency(totals.received)}`
                    : key === 'DISTRATO'
                    ? `Total (pago + aberto): ${formatCurrency(totals.contracted)}`
                    : `Em aberto: ${formatCurrency(totals.open)}`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Consultora</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-right">Contratado</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead className="text-right">Em aberto</TableHead>
                    <TableHead className="text-center">Atraso</TableHead>
                    <TableHead>Contrato</TableHead>
                    {showObs && <TableHead>Observação</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map(s => (
                    <TableRow
                      key={s.name}
                      className={`cursor-pointer hover:bg-muted/50 ${
                        s.specialConditions.length > 0
                          ? 'bg-purple-50 dark:bg-purple-950/30 border-l-4 border-l-purple-500 font-medium'
                          : ''
                      }`}
                      onClick={() => setSelected(s)}
                    >
                      <TableCell className="font-medium">
                        {s.name}
                        {s.specialConditions.length > 0 && (
                          <Badge className="ml-2 text-[10px] bg-purple-600 hover:bg-purple-600 text-white">
                            {s.specialConditions.join(' · ')}
                          </Badge>
                        )}
                        {key !== 'VENCIDO' && s.hasOverdue && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            tem atraso
                          </Badge>
                        )}
                        {key !== 'EM_NEGOCIACAO' && s.hasNegociacao && (
                          <Badge className="ml-2 text-[10px] bg-orange-500">negoc.</Badge>
                        )}
                      </TableCell>
                      <TableCell>{s.consultant}</TableCell>
                      <TableCell className="text-center">
                        {s.installmentsPaid}/{s.totalInstallments}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(s.totalContracted)}
                      </TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400">
                        {formatCurrency(s.totalReceived)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 font-semibold">
                        {formatCurrency(s.totalOpen)}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.maxDaysOverdue > 0 ? (
                          <Badge variant="destructive">{s.maxDaysOverdue}d</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {s.contractDate ? formatDateBR(s.contractDate) : '-'}
                      </TableCell>
                      {showObs && (
                        <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                          {s.observations.length > 0 ? s.observations.join(' · ') : '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {modalStudent && (
        <StudentDetailModal
          student={modalStudent}
          isOpen={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default RelatorioInadimplencia;