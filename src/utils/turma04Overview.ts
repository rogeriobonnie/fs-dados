import { FinancialRecord } from '@/types/financial';
import { Pagina5Record } from '@/types/pagina5';
import { ladComissaoPorCursoMensal, normLad } from '@/utils/comissaoLadRateio';

export const norm = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Identifica a Turma 04 pela descrição (coluna B da Página2 / Página5). */
export const isTurma04 = (descricao: string) => {
  const n = norm(descricao);
  return n.includes('TURMA IV') || n.includes('TURMA 04') || n.includes('TURMA 4');
};

// ───────────────────────── Bloco 1 — Página1 (contratos) ─────────────────────────

export interface ContratosResumo {
  totalContratado: number;
  totalRecebido: number;
  totalPendente: number;
  totalVencido: number;
  totalAlunos: number;
  alunosDistrato: number;
  distratoRecebido: number;
  distratoPerdido: number;
  alunosAtraso: number;
  alunosQuitados: number;
  totalQuitado: number;
  parcelas: number;
  parcelasPagas: number;
  ticketMedio: number;
}

const valorParcela = (r: FinancialRecord) => r.amount + (r.interest || 0) - (r.fees || 0);

export function computeContratos(data: FinancialRecord[]): ContratosResumo {
  interface Aluno {
    contratado: number;
    recebido: number;
    aberto: number;
    vencido: number;
    distrato: boolean;
    atraso: boolean;
  }
  const map = new Map<string, Aluno>();

  data.forEach(r => {
    if (!r.studentName) return;
    if (!map.has(r.studentName))
      map.set(r.studentName, { contratado: 0, recebido: 0, aberto: 0, vencido: 0, distrato: false, atraso: false });
    const a = map.get(r.studentName)!;
    const v = valorParcela(r);
    a.contratado += v;
    if (r.status === 'PAGO') a.recebido += v;
    else a.aberto += v;
    if (r.status === 'VENCIDO') {
      a.vencido += v;
      a.atraso = true;
    }
    if (r.isDistrato) a.distrato = true;
  });

  const alunos = Array.from(map.values());
  const sum = (f: (a: Aluno) => number) => alunos.reduce((s, a) => s + f(a), 0);

  const distratos = alunos.filter(a => a.distrato);
  const totalContratado = sum(a => a.contratado);
  const totalRecebido = sum(a => a.recebido);
  const totalVencido = alunos.filter(a => !a.distrato).reduce((s, a) => s + a.vencido, 0);
  const distratoPerdido = distratos.reduce((s, a) => s + a.aberto, 0);
  const totalAberto = sum(a => a.aberto);
  const quitados = alunos.filter(a => !a.distrato && a.aberto <= 0.01);

  return {
    totalContratado,
    totalRecebido,
    totalPendente: totalAberto - totalVencido - distratoPerdido,
    totalVencido,
    totalAlunos: alunos.length,
    alunosDistrato: distratos.length,
    distratoRecebido: distratos.reduce((s, a) => s + a.recebido, 0),
    distratoPerdido,
    alunosAtraso: alunos.filter(a => a.atraso && !a.distrato).length,
    alunosQuitados: quitados.length,
    totalQuitado: quitados.reduce((s, a) => s + a.recebido, 0),
    parcelas: data.length,
    parcelasPagas: data.filter(r => r.status === 'PAGO').length,
    ticketMedio: alunos.length ? totalContratado / alunos.length : 0,
  };
}

// ───────────────── Recebimentos mensais (Página1) ─────────────────

export interface RecebidoMes {
  key: string;
  label: string;
  valor: number;
  parcelas: number;
}

const parseAnyDate = (s?: string): { y: number; m: number } | null => {
  if (!s) return null;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const y = Number(br[3]);
    return { y: y < 100 ? 2000 + y : y, m: Number(br[2]) };
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})/);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]) };
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : { y: d.getFullYear(), m: d.getMonth() + 1 };
};

/** Soma das parcelas PAGAS da Página1 agrupadas por mês de pagamento. */
export function computeRecebidoPorMes(data: FinancialRecord[]): RecebidoMes[] {
  const map = new Map<string, RecebidoMes>();
  data.forEach(r => {
    if (r.status !== 'PAGO') return;
    const d = parseAnyDate(r.paymentDate) || parseAnyDate(r.dueDate);
    if (!d) return;
    const key = `${d.y}-${String(d.m).padStart(2, '0')}`;
    if (!map.has(key))
      map.set(key, { key, label: `${MONTH_SHORT[d.m - 1]}/${String(d.y).slice(2)}`, valor: 0, parcelas: 0 });
    const e = map.get(key)!;
    e.valor += valorParcela(r);
    e.parcelas += 1;
  });
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

// ───────────────────── Bloco 2 — Página2 (ago–dez/2025) ─────────────────────


export interface DRERecordLike {
  id: string;
  description: string;
  details: string;
  amount: number;
  month: string;
  year: string;
  date: string;
  extraDetail3?: string;
  vendedor?: string;
  sourceType?: string;
}

export interface Lancamento {
  data: string;
  descricao: string;
  valor: number;
}

export interface MesTurma {
  month: number;
  label: string;
  bruto: number;
  brutoGeral: number;
  peso: number;
  impostos: number;
  comVendedor: number;
  comLad: number;
  liquido: number;
  receitas: Lancamento[];
  impostosItens: Lancamento[];
  comVendedorItens: Lancamento[];
  comLadItens: Lancamento[];
}

export const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Comissão das consultoras na Página2 (3%), mesma regra das abas Consultoras/Lance a Dois. */
const COMISSAO_VENDEDOR = 0.03;


const isEntrada = (t: string) => {
  const n = norm(t);
  return n.includes('ENTRADA') || n.includes('TRANSITAR');
};
const isImposto = (r: DRERecordLike) => {
  const n = `${norm(r.sourceType || '')} ${norm(r.description)}`;
  return n.includes('IMPOSTO') || n.includes('TAXA');
};
const isComissaoVend = (r: DRERecordLike) => {
  const vend = norm(r.vendedor || '');
  if (!vend) return false;
  const n = `${norm(r.sourceType || '')} ${norm(r.description)}`;
  return !isEntrada(r.sourceType || '') && (n.includes('COMISSAO') || n.includes('VENDA'));
};
const isComissaoLad = (r: DRERecordLike) => {
  if (isEntrada(r.sourceType || '')) return false;
  const n = `${norm(r.extraDetail3 || '')} ${norm(r.description)} ${norm(r.details)}`;
  return n.includes('LANCE A DOIS');
};

const toLanc = (r: DRERecordLike, valor: number): Lancamento => ({
  data: r.date || '',
  descricao: [r.description, r.details].filter(Boolean).join(' — ') || 'Sem descrição',
  valor,
});

/**
 * Recebimentos da Turma 04 na Página2, mês a mês.
 * Impostos/taxas e comissões não vêm marcados por turma: são rateados
 * proporcionalmente (peso = receita bruta da turma ÷ receita bruta total do mês).
 */
export function computePagina2Turma(
  records: DRERecordLike[],
  year = 2025,
  months = [8, 9, 10, 11, 12],
): { meses: MesTurma[]; total: Omit<MesTurma, 'month' | 'label' | 'peso'> & { peso: number } } {
  const doAno = records.filter(r => parseInt(r.year) === year);

  const meses: MesTurma[] = months.map(m => {
    const mStr = String(m).padStart(2, '0');
    const doMes = doAno.filter(r => r.month === mStr);
    const entradas = doMes.filter(r => isEntrada(r.sourceType || '') && r.amount > 0);
    const daTurma = entradas.filter(r => isTurma04(r.description) || isTurma04(r.details));

    const bruto = daTurma.reduce((s, r) => s + r.amount, 0);
    const brutoGeral = entradas.reduce((s, r) => s + r.amount, 0);
    const peso = brutoGeral > 0 ? bruto / brutoGeral : 0;

    const impostosRecs = doMes.filter(isImposto);
    const comLadRecs = doMes.filter(isComissaoLad);

    const impostos = impostosRecs.reduce((s, r) => s + r.amount, 0) * peso;
    const comLad = comLadRecs.reduce((s, r) => s + r.amount, 0) * peso;

    // Comissão de vendedores: 3% direto sobre as entradas da turma que têm vendedor (coluna I).
    // Se a Página2 tiver linhas explícitas de comissão, elas entram rateadas.
    const comVendRecs = doMes.filter(isComissaoVend);
    const comVendLancado = comVendRecs.reduce((s, r) => s + r.amount, 0) * peso;
    const comTurmaRecs = daTurma.filter(r => norm(r.vendedor || '').length > 0);
    const comVendCalc = comTurmaRecs.reduce((s, r) => s + r.amount * COMISSAO_VENDEDOR, 0);
    const comVendedor = comVendLancado > 0 ? comVendLancado : comVendCalc;
    const comVendedorItens =
      comVendLancado > 0
        ? comVendRecs.map(r => toLanc(r, r.amount * peso))
        : comTurmaRecs.map(r => ({
            data: r.date || '',
            descricao: `${r.vendedor} — ${[r.description, r.details].filter(Boolean).join(' — ')} (3%)`,
            valor: r.amount * COMISSAO_VENDEDOR,
          }));

    return {
      month: m,
      label: MONTH_SHORT[m - 1],
      bruto,
      brutoGeral,
      peso,
      impostos,
      comVendedor,
      comLad,
      liquido: bruto - impostos - comVendedor - comLad,
      receitas: daTurma.map(r => toLanc(r, r.amount)).sort((a, b) => b.valor - a.valor),
      impostosItens: impostosRecs.map(r => toLanc(r, r.amount * peso)),
      comVendedorItens,
      comLadItens: comLadRecs.map(r => toLanc(r, r.amount * peso)),

    };
  });

  const acc = meses.reduce(
    (a, m) => ({
      bruto: a.bruto + m.bruto,
      brutoGeral: a.brutoGeral + m.brutoGeral,
      impostos: a.impostos + m.impostos,
      comVendedor: a.comVendedor + m.comVendedor,
      comLad: a.comLad + m.comLad,
      liquido: a.liquido + m.liquido,
      receitas: [...a.receitas, ...m.receitas],
      impostosItens: [...a.impostosItens, ...m.impostosItens],
      comVendedorItens: [...a.comVendedorItens, ...m.comVendedorItens],
      comLadItens: [...a.comLadItens, ...m.comLadItens],
    }),
    {
      bruto: 0, brutoGeral: 0, impostos: 0, comVendedor: 0, comLad: 0, liquido: 0,
      receitas: [] as Lancamento[], impostosItens: [] as Lancamento[],
      comVendedorItens: [] as Lancamento[], comLadItens: [] as Lancamento[],
    },
  );

  return {
    meses,
    total: { ...acc, peso: acc.brutoGeral > 0 ? acc.bruto / acc.brutoGeral : 0 },
  };
}

// ─────────────────── Bloco 3 — Página5 (resultado semestral) ───────────────────

const RATEAVEIS = [11, 12, 14, 17, 18];
const RATEIO_LABELS: { cn: number; label: string }[] = [
  { cn: 11, label: '11-Administrativo' },
  { cn: 12, label: '12-Marketing' },
  { cn: 14, label: '14-Plataformas' },
  { cn: 17, label: '17-Congresso' },
  { cn: 18, label: '18-Desp. Cursos' },
];

const isHandsOn = (r: Pagina5Record) =>
  [r.custo, r.descricao, r.detalhamento, r.evento].some(v => norm(v).includes('HANDS ON'));

export interface Pagina5TurmaResultado {
  periodo: string;
  qtd: number;
  bruto: number;
  acrescimos: number;
  taxas: number;
  liquido: number;
  impostos: number;
  comVendedor: number;
  comMkt: number;
  despCursos: number;
  rateio: number;
  rateioCols: { label: string; valor: number }[];
  despesasTotais: number;
  resultado: number;
  peso: number;
  porMes: { label: string; bruto: number }[];
  despesasItens: Lancamento[];
}

/** Resultado da Turma 04 na Página5 para um semestre, seguindo as mesmas regras da aba Semestral. */
export function computePagina5Turma(
  allData: Pagina5Record[],
  year: number,
  months: number[],
): Pagina5TurmaResultado {
  const semData = allData.filter(r => r.year === year && months.includes(r.month));

  const receitasCursos = semData.filter(r => Math.floor(r.custoNum) === 1);
  const daTurma = receitasCursos.filter(r => isTurma04(r.descricao));


  const bruto = daTurma.reduce((s, r) => s + r.valorBruto, 0);
  const acrescimos = daTurma.reduce((s, r) => s + (r.acrescimos || 0), 0);
  const taxas = daTurma.reduce((s, r) => s + r.taxas, 0);
  const liquido = daTurma.reduce((s, r) => s + r.valorLiquido, 0);
  const impostos = daTurma.reduce((s, r) => s + r.vrImposto, 0);
  const comVendedor = daTurma.reduce((s, r) => s + (r.vendedor ? r.vrVendedor : 0), 0);

  // Despesas diretas: 15-CURSOS "hands on" + linhas cuja coluna S aponta para a turma
  const despesasItens: Lancamento[] = [];
  let despCursos = 0;
  semData.forEach(r => {
    const cn = Math.floor(r.custoNum);
    if (cn !== 15) return;
    if ((r.banco || '').toUpperCase() === 'PAGO') return;
    const evt = norm(r.evento);
    const direto = isHandsOn(r) || (evt && isTurma04(evt));
    if (!direto) return;
    const valor = Math.abs(r.valorLiquido);
    despCursos += valor;
    despesasItens.push({ data: r.date, descricao: r.descricao || r.custo, valor });
  });

  // Comissão MKT (Lance a Dois) rateada por curso, mesmo cálculo da aba Comissões
  const ladPorCurso = ladComissaoPorCursoMensal(semData);
  const comMkt = Array.from(
    new Set(daTurma.map(r => normLad(r.descricao || 'Sem descrição'))),
  ).reduce((s, k) => s + (ladPorCurso.get(k) || 0), 0);

  // A Turma 04 não entra no rateio proporcional das despesas comuns (regra da aba Semestral)
  const rateioCols = RATEIO_LABELS.map(c => ({ label: c.label, valor: 0 }));
  const rateio = 0;
  const peso = 0;


  const despesasTotais = taxas + impostos + comVendedor + comMkt + despCursos + rateio;
  const resultado = liquido - impostos - comVendedor - comMkt - despCursos - rateio;

  return {
    periodo: `${MONTH_SHORT[months[0] - 1]} a ${MONTH_SHORT[months[months.length - 1] - 1]}/${year}`,
    qtd: daTurma.length,
    bruto,
    acrescimos,
    taxas,
    liquido,
    impostos,
    comVendedor,
    comMkt,
    despCursos,
    rateio,
    rateioCols,
    despesasTotais,
    resultado,
    peso,
    porMes: months.map(m => ({
      label: MONTH_SHORT[m - 1],
      bruto: daTurma.filter(r => r.month === m).reduce((s, r) => s + r.valorBruto, 0),
    })),
    despesasItens: despesasItens.sort((a, b) => b.valor - a.valor),
  };
}

export const RATEAVEIS_CENTROS = RATEAVEIS;
