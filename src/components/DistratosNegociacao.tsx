import { useMemo, useState } from 'react';
import { FinancialRecord } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StudentDetailModal } from '@/components/StudentDetailModal';
import { formatCurrency } from '@/utils/financialCalculations';
import { formatDateBR } from '@/utils/dateUtils';
import { UserX, Search, TrendingDown, DollarSign, Users, Handshake } from 'lucide-react';

interface Props {
  data: FinancialRecord[];
}

type Filter = 'AMBOS' | 'DISTRATO' | 'EM NEGOCIACAO';

interface StudentAgg {
  name: string;
  consultant: string;
  contractDate: string;
  status: 'DISTRATO' | 'EM NEGOCIACAO' | 'MISTO';
  totalContracted: number;
  totalReceived: number;
  totalLost: number;
  installmentsPaid: number;
  totalInstallments: number;
  records: FinancialRecord[];
}

const DistratosNegociacao = ({ data }: Props) => {
  const [filter, setFilter] = useState<Filter>('AMBOS');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StudentAgg | null>(null);

  // Alunos que possuem ao menos uma parcela com status DISTRATO ou EM NEGOCIACAO
  const students = useMemo<StudentAgg[]>(() => {
    const flaggedNames = new Set(
      data
        .filter(r => r.isDistrato || r.status === 'EM NEGOCIACAO')
        .map(r => r.studentName),
    );

    const map = new Map<string, StudentAgg>();
    data.forEach(r => {
      if (!flaggedNames.has(r.studentName)) return;
      if (!map.has(r.studentName)) {
        map.set(r.studentName, {
          name: r.studentName,
          consultant: r.consultant || 'Venda Direta',
          contractDate: r.contractDate,
          status: 'DISTRATO',
          totalContracted: 0,
          totalReceived: 0,
          totalLost: 0,
          installmentsPaid: 0,
          totalInstallments: 0,
          records: [],
        });
      }
      const s = map.get(r.studentName)!;
      s.records.push(r);
      s.totalInstallments++;
      const finalAmount = r.amount + (r.interest || 0) - (r.fees || 0);
      s.totalContracted += finalAmount;
      if (r.status === 'PAGO') {
        s.totalReceived += finalAmount;
        s.installmentsPaid++;
      } else {
        s.totalLost += finalAmount;
      }
    });

    // Determinar status agregado a partir da flag isDistrato (coluna P) + status
    map.forEach(s => {
      const hasDistrato = s.records.some(r => r.isDistrato);
      const hasNegoc = s.records.some(r => r.status === 'EM NEGOCIACAO');
      if (hasDistrato && hasNegoc) s.status = 'MISTO';
      else if (hasDistrato) s.status = 'DISTRATO';
      else s.status = 'EM NEGOCIACAO';
    });

    return Array.from(map.values());
  }, [data]);

  const filtered = useMemo(() => {
    let list = students;
    if (filter !== 'AMBOS') {
      list = list.filter(s => s.status === filter || s.status === 'MISTO');
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.totalLost - a.totalLost);
  }, [students, filter, search]);

  const summary = useMemo(() => {
    const calc = (st: 'DISTRATO' | 'EM NEGOCIACAO') => {
      const list = students.filter(s => s.status === st || s.status === 'MISTO');
      return {
        count: list.length,
        contracted: list.reduce((a, s) => a + s.totalContracted, 0),
        received: list.reduce((a, s) => a + s.totalReceived, 0),
        lost: list.reduce((a, s) => a + s.totalLost, 0),
      };
    };
    return { distrato: calc('DISTRATO'), negociacao: calc('EM NEGOCIACAO') };
  }, [students]);

  const renderSummary = (
    title: string,
    color: string,
    icon: JSX.Element,
    s: { count: number; contracted: number; received: number; lost: number },
  ) => (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Alunos</p>
          <p className="text-xl font-bold">{s.count}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Contratado</p>
          <p className="text-lg font-semibold">{formatCurrency(s.contracted)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Recebido</p>
          <p className="text-lg font-semibold text-success">{formatCurrency(s.received)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Deixou de receber</p>
          <p className="text-lg font-semibold text-destructive">{formatCurrency(s.lost)}</p>
        </div>
      </CardContent>
    </Card>
  );

  const statusBadge = (st: StudentAgg['status']) => {
    if (st === 'DISTRATO') return <Badge variant="destructive">Distrato</Badge>;
    if (st === 'EM NEGOCIACAO') return <Badge className="bg-warning text-warning-foreground">Em Negociação</Badge>;
    return <Badge variant="secondary">Misto</Badge>;
  };

  // Adaptar StudentAgg para o StudentDetailModal existente
  const modalStudent = selected && {
    name: selected.name,
    totalAmount: selected.totalContracted,
    paidAmount: selected.totalReceived,
    pendingAmount: selected.totalLost,
    overdueAmount: 0,
    paidPercentage:
      selected.totalContracted > 0 ? (selected.totalReceived / selected.totalContracted) * 100 : 0,
    status: 'current' as const,
    installmentsPaid: selected.installmentsPaid,
    totalInstallments: selected.totalInstallments,
    daysOverdue: 0,
    consultant: selected.consultant,
    contractDate: selected.contractDate,
    totalFees: selected.records.reduce((a, r) => a + (r.fees || 0), 0),
    totalInterest: selected.records.reduce((a, r) => a + (r.interest || 0), 0),
    records: selected.records,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderSummary('Distrato', 'hsl(var(--destructive))', <UserX className="h-4 w-4" />, summary.distrato)}
        {renderSummary('Em Negociação', 'hsl(var(--warning))', <Handshake className="h-4 w-4" />, summary.negociacao)}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Alunos ({filtered.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              {(['AMBOS', 'DISTRATO', 'EM NEGOCIACAO'] as Filter[]).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? 'default' : 'outline'}
                  onClick={() => setFilter(f)}
                >
                  {f === 'AMBOS' ? 'Ambos' : f === 'DISTRATO' ? 'Distrato' : 'Em Negociação'}
                </Button>
              ))}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar aluno..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 w-[220px]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Consultora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Parcelas</TableHead>
                <TableHead className="text-right">Contratado</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">A perder</TableHead>
                <TableHead>Contrato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    Nenhum aluno encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(s => (
                <TableRow
                  key={s.name}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(s)}
                >
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.consultant}</TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell className="text-center">
                    {s.installmentsPaid}/{s.totalInstallments}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(s.totalContracted)}</TableCell>
                  <TableCell className="text-right text-success">
                    {formatCurrency(s.totalReceived)}
                  </TableCell>
                  <TableCell className="text-right text-destructive font-semibold">
                    {formatCurrency(s.totalLost)}
                  </TableCell>
                  <TableCell>{s.contractDate ? formatDateBR(s.contractDate) : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

export default DistratosNegociacao;