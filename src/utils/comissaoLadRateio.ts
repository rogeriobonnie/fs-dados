import { Pagina5Record } from '@/types/pagina5';

export const normLad = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export const isLadRecord = (r: Pagina5Record) => (r.mkt || '').toUpperCase().includes('LANCE');

/** Chave de agrupamento: cursos (01) pelo nome; demais receitas pelo centro de custo. */
export const ladGroupKey = (r: Pagina5Record) =>
  Math.floor(r.custoNum) === 1 ? (r.descricao || 'Sem descrição') : (r.custo || 'Outras receitas');

export interface LadCursoRateio {
  nome: string;
  bruto: number;
  liquido: number;
  peso: number;
  comissao: number;
}

export interface LadPeriodo {
  bruto: number;
  taxas: number;
  acrescimos: number;
  impostos: number;
  comVend: number;
  liquido: number;
  despesas: number;
  resultado: number;
  comissao: number;
  cursos: LadCursoRateio[];
  receitas: Pagina5Record[];
  despesasRecords: Pagina5Record[];
}

/** Calcula o resultado Lance a Dois de um conjunto de registros (um período) e rateia a comissão por curso. */
export function ladRateioPeriodo(records: Pagina5Record[]): LadPeriodo {
  const receitas = records.filter(
    r => ((r.custoNum >= 1 && r.custoNum <= 10) || r.custoNum === 97) && isLadRecord(r),
  );
  const despesasRecords = records.filter(
    r => r.custoNum >= 11 && r.custoNum <= 20 && isLadRecord(r),
  );

  const bruto = receitas.reduce((s, r) => s + r.valorBruto, 0);
  const taxas = receitas.reduce((s, r) => s + r.taxas, 0);
  const acrescimos = receitas.reduce((s, r) => s + r.acrescimos, 0);
  const impostos = receitas.reduce((s, r) => s + r.vrImposto, 0);
  const comVend = receitas.reduce((s, r) => s + r.vrVendedor, 0);
  const liquido = bruto - taxas + acrescimos - impostos - comVend;
  const despesas = despesasRecords.reduce((s, r) => s + r.valorLiquido, 0);
  const resultado = liquido + despesas;
  const comissao = Math.max(0, resultado * 0.1);

  const map = new Map<string, LadCursoRateio>();
  receitas.forEach(r => {
    const nome = ladGroupKey(r);
    const key = normLad(nome);
    if (!map.has(key)) map.set(key, { nome, bruto: 0, liquido: 0, peso: 0, comissao: 0 });
    const l = map.get(key)!;
    l.bruto += r.valorBruto;
    l.liquido += r.valorBruto - r.taxas + r.acrescimos - r.vrImposto - r.vrVendedor;
  });

  const baseRateio = Array.from(map.values()).reduce((s, l) => s + Math.max(0, l.liquido), 0);
  map.forEach(l => {
    l.peso = baseRateio > 0 ? Math.max(0, l.liquido) / baseRateio : 0;
    l.comissao = l.peso * comissao;
  });

  return {
    bruto, taxas, acrescimos, impostos, comVend, liquido,
    despesas, resultado, comissao,
    cursos: Array.from(map.values()).sort((a, b) => b.comissao - a.comissao),
    receitas,
    despesasRecords,
  };
}

/**
 * Comissão Lance a Dois rateada por curso, calculada mês a mês e somada.
 * Retorna um mapa com chave normalizada do curso/centro.
 */
export function ladComissaoPorCursoMensal(records: Pagina5Record[]): Map<string, number> {
  const porMes = new Map<string, Pagina5Record[]>();
  records.forEach(r => {
    const k = `${r.year}-${r.month}`;
    if (!porMes.has(k)) porMes.set(k, []);
    porMes.get(k)!.push(r);
  });

  const out = new Map<string, number>();
  porMes.forEach(regs => {
    const p = ladRateioPeriodo(regs);
    p.cursos.forEach(c => {
      const k = normLad(c.nome);
      out.set(k, (out.get(k) || 0) + c.comissao);
    });
  });
  return out;
}
