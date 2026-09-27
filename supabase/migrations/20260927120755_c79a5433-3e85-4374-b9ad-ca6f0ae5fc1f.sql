CREATE TABLE public.origem_classificacao (
  chave text PRIMARY KEY,
  categoria text NOT NULL,
  fonte text NOT NULL DEFAULT 'IA',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.origem_classificacao TO anon, authenticated;
GRANT ALL ON public.origem_classificacao TO service_role;
ALTER TABLE public.origem_classificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública das classificações" ON public.origem_classificacao FOR SELECT TO anon, authenticated USING (true);