

## Painel Historico Anual - Nova Aba "Historico"

Uma nova aba principal no sistema que puxa dados da aba "FLUXO DE CAIXA" da planilha, consolida por ano, e apresenta um painel sensacional com visao macro da empresa desde 2022.

---

### O que sera construido

Uma pagina com 3 niveis de detalhe:

**Nivel 1 - Visao Macro (cards anuais)**
- Cards grandes por ano (2022, 2023, 2024, 2025...) mostrando:
  - Receita Total, Despesa Total, Resultado, Distribuicao de Lucros
  - Margem operacional (%)
  - Barra de progresso visual comparando receita vs despesa

**Nivel 2 - Ao clicar no ano, expande:**
- Tabela comparativa anual com colunas: Ano | Receitas | Despesas | Resultado | Dist. Lucros | Margem
- Grafico de barras empilhadas (Recharts) comparando todos os anos
- Grafico de linha mostrando evolucao do resultado ao longo dos anos

**Nivel 3 - Ao clicar em uma linha do ano, expande:**
- Breakdown por centro de custo (01-Cursos FS, 05-Cursos Terceiros, 11-Fixas, 12-Variaveis, etc.)
- Lista de itens individuais agrupados por categoria

---

### Estrutura tecnica

**1. Novo metodo no servico** (`src/services/googleSheetsService.ts`)
- `fetchFluxoCaixaHistorico()`: busca dados da aba `FLUXO DE CAIXA!A:O`
- Reutiliza o parser `parsePagina5Data` (mesma estrutura de colunas)

**2. Novo componente** (`src/components/HistoricoAnual.tsx`)
- Busca dados ao montar via `GoogleSheetsService.fetchFluxoCaixaHistorico()`
- Agrupa por ano usando o campo `year` dos registros
- Para cada ano calcula:
  - Receitas: custoNum 1-10, soma de valorLiquido
  - Despesas: custoNum 11-20, soma de abs(valorLiquido)
  - Resultado: Receitas - Despesas
  - Distribuicoes: custoNum 21, soma de abs(valorLiquido)
  - Margem: (Resultado / Receitas) * 100
- Renderiza cards clicaveis por ano com Collapsible
- Dentro de cada ano, sub-agrupamento por centro de custo com Collapsible
- Graficos comparativos usando Recharts (BarChart + LineChart)

**3. Nova aba principal** (`src/pages/Index.tsx`)
- Adicionar 4a aba "Historico" com icone `TrendingUp` ao lado de "Painel Financeiro"
- Grid de 4 colunas no TabsList

---

### Layout visual da pagina

```text
+--------------------------------------------------+
|  HISTORICO FINANCEIRO           [Atualizar]       |
|  Evolucao anual da empresa desde 2022             |
+--------------------------------------------------+

+----------+ +----------+ +----------+ +----------+
| 2022     | | 2023     | | 2024     | | 2025     |
| Rec 120k | | Rec 250k | | Rec 380k | | Rec 200k |
| Desp 80k | | Desp 150k| | Desp 220k| | Desp 110k|
| Res +40k | | Res +100k| | Res +160k| | Res +90k |
| Dist 20k | | Dist 50k | | Dist 80k | | Dist 40k |
| Mg 33.3% | | Mg 40.0% | | Mg 42.1% | | Mg 45.0% |
+----------+ +----------+ +----------+ +----------+

[========= GRAFICO COMPARATIVO ANUAL =========]
[  Barras: Receitas vs Despesas por ano        ]
[  Linha: Evolucao do Resultado                ]
[=============================================]

+--------------------------------------------------+
| TABELA COMPARATIVA                                |
| Ano | Receitas | Despesas | Result | Dist | Marg  |
| 2022| R$120k   | R$80k    | +R$40k | R$20k| 33.3%|
|  v  (clica para expandir por centro de custo)     |
|     01-Cursos FS:        R$ 90.000               |
|     05-Cursos Terceiros: R$ 30.000               |
|     11-Fixas:           -R$ 50.000               |
|     12-Variaveis:       -R$ 30.000               |
|     21-Distribuicoes:   -R$ 20.000               |
+--------------------------------------------------+
```

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| `src/services/googleSheetsService.ts` | Adicionar `fetchFluxoCaixaHistorico()` |
| `src/components/HistoricoAnual.tsx` | Criar componente completo |
| `src/pages/Index.tsx` | Adicionar 4a aba "Historico" |

