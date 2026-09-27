import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Pagina5Record } from '@/types/pagina5';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import {
  OrigemCategoria, ORIGEM_LABEL, ORIGEM_ORDEM, classificarPorRegra, chaveOrigem,
} from '@/utils/classificarOrigemCursos';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const LOTE = 100;

export default function OrigemCursosBreakdown({ items }: { items: Pagina5Record[] }) {
  const { toast } = useToast();
  const [ia, setIa] = useState<Record<string, OrigemCategoria>>({});
  const [rodando, setRodando] = useState(false);
  const [aberto, setAberto] = useState<OrigemCategoria | null>(null);

  const linhas = useMemo(() => items.map(r => ({ r, chave: chaveOrigem(r), regra: classificarPorRegra(r) })), [items]);
  const semRegra = useMemo(() => linhas.filter(l => !l.regra), [linhas]);

  const carregar = async () => {
    const chaves = semRegra.map(l => l.chave);
    if (!chaves.length) return;
    const { data } = await supabase.from('origem_classificacao').select('chave,categoria').in('chave', chaves);
    const m: Record<string, OrigemCategoria> = {};
    (data ?? []).forEach(d => { m[d.chave] = d.categoria as OrigemCategoria; });
    setIa(m);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [semRegra]);

  const pendentes = semRegra.filter(l => !ia[l.chave]);

  const rodarIA = async () => {
    setRodando(true);
    try {
      for (let i = 0; i < pendentes.length; i += LOTE) {
        const lote = pendentes.slice(i, i + LOTE).map(l => ({
          chave: l.chave, descricao: l.r.descricao.slice(0, 500), detalhamento: l.r.detalhamento.slice(0, 500), valor: l.r.valorLiquido,
        }));
        const { data, error } = await supabase.functions.invoke('classificar-origem', { body: { linhas: lote } });
        if (error || data?.error) {
          let msg = data?.error;
          try { msg = msg ?? (await (error as any)?.context?.json())?.error; } catch { /* */ }
          throw new Error(msg || 'Falha ao classificar');
        }
      }
      await carregar();
      toast({ title: 'Classificação concluída' });
    } catch (e) {
      toast({ title: 'Erro na IA', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setRodando(false);
    }
  };

  const grupos = useMemo(() => {
    const g = new Map<OrigemCategoria, { r: Pagina5Record; fonte: 'Regra' | 'IA' | '—' }[]>();
    ORIGEM_ORDEM.forEach(c => g.set(c, []));
    linhas.forEach(l => {
      const cat = l.regra ?? ia[l.chave] ?? 'NAO_IDENTIFICADO';
      g.get(cat)!.push({ r: l.r, fonte: l.regra ? 'Regra' : ia[l.chave] ? 'IA' : '—' });
    });
    return g;
  }, [linhas, ia]);

  const total = items.reduce((s, r) => s + r.valorLiquido, 0);

  return (
    <div className="ml-8 mt-2 mb-3 rounded-md border bg-card p-3 space-y-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entradas por origem</p>
        {pendentes.length > 0 && (
          <Button size="sm" variant="outline" disabled={rodando} onClick={(e) => { e.stopPropagation(); rodarIA(); }} className="h-7 gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            {rodando ? 'Classificando...' : `Classificar com IA (${pendentes.length})`}
          </Button>
        )}
      </div>
      {ORIGEM_ORDEM.map(cat => {
        const lst = grupos.get(cat)!;
        if (!lst.length) return null;
        const soma = lst.reduce((s, x) => s + x.r.valorLiquido, 0);
        const open = aberto === cat;
        return (
          <div key={cat}>
            <button
              className="w-full flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50"
              onClick={(e) => { e.stopPropagation(); setAberto(open ? null : cat); }}
            >
              <span className="flex items-center gap-2 font-medium">
                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {ORIGEM_LABEL[cat]}
                <span className="text-xs text-muted-foreground">({lst.length})</span>
              </span>
              <span className="flex gap-4">
                <span className="text-xs text-muted-foreground">{total ? ((soma / total) * 100).toFixed(1) : '0.0'}%</span>
                <span className="font-bold text-primary">{fmt(soma)}</span>
              </span>
            </button>
            {open && (
              <div className="ml-6 max-h-72 overflow-auto">
                {lst.map((x, i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5 px-2">
                    <span className="flex gap-2 truncate">
                      <span className="text-muted-foreground">{x.r.date}</span>
                      <span className="truncate max-w-[260px]">{x.r.descricao}</span>
                      {x.r.detalhamento && <span className="text-muted-foreground truncate max-w-[140px]">· {x.r.detalhamento}</span>}
                      <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{x.fonte}</span>
                    </span>
                    <span className="font-medium">{fmt(x.r.valorLiquido)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex justify-between border-t pt-1 px-2 text-sm font-bold">
        <span>Total</span><span>{fmt(total)}</span>
      </div>
    </div>
  );
}
