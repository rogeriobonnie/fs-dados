export interface Pagina5Record {
  id: string;
  date: string;
  descricao: string;
  detalhamento: string;
  custo: string;
  custoNum: number;
  valorBruto: number;
  taxas: number;
  acrescimos: number;
  valorLiquido: number;
  banco: string;
  impAliq: number;
  vrImposto: number;
  vendedor: string;
  vrVendedor: number;
  mkt: string;
  vrMkt: number;
  month: number;
  year: number;
  evento: string;
}

export interface CursoAgrupado {
  nome: string;
  valorBruto: number;
  taxas: number;
  acrescimos: number;
  valorLiquido: number;
  vrImposto: number;
  vrVendedor: number;
  vrMkt: number;
  banco: string;
  vendas: Pagina5Record[];
}

export interface CentroCustoAgrupado {
  custo: string;
  custoNum: number;
  total: number;
  items: Pagina5Record[];
}

export interface FluxoCaixaBanco {
  banco: string;
  saldoInicial: number;
  receitas: number;
  despesas: number;
  destinacoes: number;
  resgates: number;
  transferencias: number;
  saldoFinal: number;
}
