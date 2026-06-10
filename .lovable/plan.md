
## Plano: Aba "Eventos" no Painel Financeiro

### 1. Ler coluna S (Evento) da planilha
- Em `googleSheetsService.ts`, mudar o range de `Página5!A:O` para `Página5!A:S` em `fetchPagina5Data`.
- No `parsePagina5Data`, ler `row[18]` como `evento` (trim, mantém case original) e ignorar colunas P/Q/R.
- Adicionar `evento: string` em `Pagina5Record` (`src/types/pagina5.ts`).

### 2. Criar componente `EventosPainel.tsx`
- Recebe `data: Pagina5Record[]`, `selectedMonth`, `selectedYear` (usar `allData` do ano todo, pois eventos atravessam meses — manter padrão dos outros painéis aceitando `allData` também).
- **Agrupar** registros com `evento` não-vazio por nome normalizado (uppercase + trim, sem acentos — reaproveitar padrão `normalizacao-chaves` já usado no projeto).
- **Tela 1 — Índice**: lista/tabela de eventos com:
  - Nome do evento
  - Nº de lançamentos
  - Receita Líquida total
  - Despesa total
  - Resultado (Receita − Despesa) colorido verde/vermelho
  - Clicar abre a Tela 2.
- **Tela 2 — Demonstrativo do evento** (modal ou view interna com botão "Voltar"):
  - Cabeçalho: nome do evento, período (primeira→última data), totais.
  - Bloco **Receitas** (custoNum 1–10): tabela com data, descrição, detalhamento, valor bruto, (−) impostos, (−) comissão vendedor, (−) comissão mkt, **valor líquido**.
  - Total Receita Líquida = Σ (valorLiquido − vrImposto − vrVendedor − vrMkt), seguindo a mesma fórmula já usada em `PainelFinanceiro.tsx` linhas 78–80.
  - Bloco **Despesas** (custoNum 11–20 e 21–30): tabela com data, descrição, detalhamento, banco, valor.
  - **Resultado do Evento** = Receita Líquida − Despesas.
  - Botão **"Exportar PDF"**.

### 3. Exportação PDF A4
- Usar `jspdf` + `jspdf-autotable` (já são padrão no projeto — mesmas libs do PDF do DRE em `DREFluxoCaixa.tsx`).
- Layout A4 retrato:
  - Cabeçalho com título "Demonstrativo de Evento — {NOME}", período e data de geração.
  - Seção Receitas (tabela) → subtotais (Bruto, Impostos, Comissões, Líquido).
  - Seção Despesas (tabela) → subtotal.
  - Caixa final destacada com **Resultado do Evento**.
  - Rodapé com numeração de página.
- Fonte legível, cores consistentes com o restante (verde p/ receitas, vermelho p/ despesas, cinza p/ cabeçalhos).

### 4. Integrar a aba
- Em `PainelFinanceiro.tsx`, adicionar `TabsTrigger value="eventos"` **antes de "ranking"** com ícone (ex.: `CalendarDays` do lucide).
- Trocar `grid-cols-4` por `grid-cols-5` no `TabsList`.
- Renderizar `<EventosPainel data={filteredData} allData={data} selectedMonth={selectedMonth} selectedYear={selectedYear} />`.

### 5. Decisão de escopo do filtro
Por padrão a aba respeitará o filtro de mês/ano do topo (igual às outras abas), com um **toggle "Ver ano todo"** dentro da aba para casos onde o evento atravessa vários meses.

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/types/pagina5.ts` | Adicionar campo `evento` |
| `src/services/googleSheetsService.ts` | Range A:S + parse coluna 18 |
| `src/components/EventosPainel.tsx` | Novo componente (índice + demonstrativo + PDF) |
| `src/components/PainelFinanceiro.tsx` | Adicionar aba "Eventos" antes de "Ranking" |
