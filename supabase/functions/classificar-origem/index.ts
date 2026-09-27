import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const CATS = ['EDUZZ', 'PIX', 'BOLETO', 'PATROCINIO', 'NAO_IDENTIFICADO'] as const;

const Body = z.object({
  linhas: z.array(z.object({
    chave: z.string().min(1).max(200),
    descricao: z.string().max(500),
    detalhamento: z.string().max(500),
    valor: z.number(),
  })).min(1).max(150),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Requisição inválida' }, 400);

  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return json({ error: 'IA não configurada' }, 500);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const linhas = parsed.data.linhas;
  const { data: existentes } = await sb.from('origem_classificacao').select('chave').in('chave', linhas.map(l => l.chave));
  const ja = new Set((existentes ?? []).map(e => e.chave));
  const pend = linhas.filter(l => !ja.has(l.chave));
  if (pend.length === 0) return json({ classificados: 0 });

  const prompt = `Você classifica lançamentos de ENTRADA de uma escola de cursos de fisioterapia (fluxo de caixa, centro de custo 01-Cursos) pela ORIGEM do dinheiro.
Categorias:
- EDUZZ: repasses da plataforma Eduzz (inclui Galaxy Fundo, "liberação de dinheiro", vendas via plataforma online).
- PIX: pix recebido diretamente de aluno/pessoa ou empresa pagando o curso.
- BOLETO: boletos, cobranças recorrentes/mensalidades (Conta Azul, CobreFácil, Asaas, plano de recebimento), renovações parceladas.
- PATROCINIO: patrocínio/apoio de empresas (ex.: empresas de equipamentos pagando cota, monitoria patrocinada).
- NAO_IDENTIFICADO: quando realmente não dá para inferir.
Responda em json com a categoria de cada chave.

Lançamentos:
${pend.map(l => `${l.chave} | ${l.descricao} | ${l.detalhamento} | R$ ${l.valor.toFixed(2)}`).join('\n')}`;

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch' },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra',
      input: [{ role: 'user', content: prompt }],
      stream: true,
      store: false,
      reasoning: { effort: 'low', summary: 'auto' },
      include: ['reasoning.encrypted_content'],
      text: {
        format: {
          type: 'json_schema', name: 'classificacao', strict: true,
          schema: {
            type: 'object', additionalProperties: false, required: ['itens'],
            properties: {
              itens: {
                type: 'array',
                items: {
                  type: 'object', additionalProperties: false, required: ['chave', 'categoria'],
                  properties: { chave: { type: 'string' }, categoria: { type: 'string', enum: CATS } },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => '');
    let msg = 'Falha na IA';
    try { msg = JSON.parse(t).error?.message ?? JSON.parse(t).message ?? msg; } catch { /* */ }
    if (resp.status === 402) msg = 'Créditos de IA esgotados. Adicione créditos em Configurações → Planos e créditos.';
    if (resp.status === 429) msg = 'Muitas requisições. Tente novamente em alguns minutos.';
    return json({ error: msg }, resp.status);
  }

  // Consume SSE stream
  let text = '';
  let refused = false;
  const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const parts = buf.split('\n');
    buf = parts.pop() ?? '';
    for (const line of parts) {
      if (!line.startsWith('data:')) continue;
      const d = line.slice(5).trim();
      if (!d || d === '[DONE]') continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === 'response.output_text.delta') text += ev.delta;
        if (ev.type === 'response.refusal.delta') refused = true;
        if (ev.type === 'error' || ev.type === 'response.failed') return json({ error: ev.error?.message ?? 'Falha na IA' }, 502);
      } catch { /* ignore */ }
    }
  }
  if (refused || !text) return json({ error: 'A IA não retornou classificação.' }, 502);

  let itens: { chave: string; categoria: string }[] = [];
  try { itens = JSON.parse(text).itens ?? []; } catch { return json({ error: 'Resposta da IA inválida' }, 502); }
  const validas = new Set(pend.map(p => p.chave));
  const rows = itens
    .filter(i => validas.has(i.chave) && (CATS as readonly string[]).includes(i.categoria))
    .map(i => ({ chave: i.chave, categoria: i.categoria, fonte: 'IA' }));
  if (rows.length) {
    const { error } = await sb.from('origem_classificacao').upsert(rows, { onConflict: 'chave' });
    if (error) return json({ error: 'Falha ao salvar' }, 500);
  }
  return json({ classificados: rows.length });
});
