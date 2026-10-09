import { Pagina5Record } from '@/types/pagina5';

export type OrigemCategoria = 'EDUZZ' | 'PIX' | 'BOLETO' | 'PATROCINIO' | 'NAO_IDENTIFICADO';

export const ORIGEM_LABEL: Record<OrigemCategoria, string> = {
  EDUZZ: 'Eduzz',
  PIX: 'Pix',
  BOLETO: 'Boleto',
  PATROCINIO: 'Patrocínio',
  NAO_IDENTIFICADO: 'Não identificado',
};

export const ORIGEM_ORDEM: OrigemCategoria[] = ['EDUZZ', 'PIX', 'BOLETO', 'PATROCINIO', 'NAO_IDENTIFICADO'];

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toUpperCase();

// Order matters: Eduzz repasses arrive as "PIX RECEBIDO ... GALAXY", so Eduzz is checked before Pix.
const REGRAS: [OrigemCategoria, string[]][] = [
  ['PATROCINIO', ['PATROCIN', 'APOIO']],
  ['EDUZZ', ['EDUZZ', 'EDDUZZ', 'GALAXY']],
  ['BOLETO', ['BOLETO', 'COBREFACIL', 'CONTAAZUL', 'ASAAS', 'PLANODERECEBIMENTO']],
  ['PIX', ['PIX']],
];

export function classificarPorRegra(r: Pagina5Record): OrigemCategoria | null {
  const t = norm(`${r.descricao} ${r.detalhamento}`);
  // Página5 (2026) informa o banco: recebimentos no banco EDUZZ são Eduzz, salvo patrocínio
  if (norm(r.banco) === 'EDUZZ' && !['PATROCIN', 'APOIO'].some(p => t.includes(p))) return 'EDUZZ';
  for (const [cat, palavras] of REGRAS) if (palavras.some(p => t.includes(p))) return cat;
  return null;
}

export function chaveOrigem(r: Pagina5Record): string {
  const s = `${r.date}|${norm(r.descricao)}|${norm(r.detalhamento)}|${r.valorLiquido.toFixed(2)}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `o${(h >>> 0).toString(36)}${s.length.toString(36)}`;
}
