

## Plano: Reformular aba Histórico — Matriz de Despesas por Mês/Centro de Custo

### O que muda

1. **Remover os dois gráficos** (linhas 217-274) — BarChart e ComposedChart.

2. **Nova seção acima da tabela comparativa** — "Análise Detalhada 2024-2025" com duas partes:

   **a) Receitas Consolidadas por Centro de Custo** (sem abrir detalhes)
   - Filtra `custoNum 1-10` dos anos 2024 e 2025
   - Tabela simples: Centro de Custo | 2024 | 2025 | Variação
   - Uma linha por centro de custo, sem drill-down

   **b) Despesas por Centro de Custo × Mês** (formato matriz/pivot)
   - Filtra `custoNum 11-20` dos anos 2024 e 2025
   - Tabela pivot: linhas = centro de custo, colunas = meses (Jan-Dez)
   - Seletor de ano (2024/2025) acima da tabela
   - Cada célula mostra o total daquele centro naquele mês
   - Linha de TOTAL no final
   - Coluna TOTAL à direita
   - Ao clicar numa célula ou linha, expande detalhamento dos itens

### Layout visual

```text
RECEITAS POR CENTRO DE CUSTO
Centro de Custo          | 2024        | 2025        | Var %
01-Cursos FS             | R$ 280.000  | R$ 150.000  | -46%
05-Cursos Terceiros      | R$ 95.000   | R$ 48.000   | -49%
TOTAL                    | R$ 375.000  | R$ 198.000  | -47%

DESPESAS POR CENTRO DE CUSTO    [2024 ▼] [2025]
Centro Custo  | Jan    | Fev    | Mar   | ... | Dez   | TOTAL
11-Fixas      | 8.500  | 8.200  | 8.800 | ... | 9.100 | 102k
12-Variáveis  | 3.200  | 2.800  | 4.100 | ... | 3.500 | 40k
13-Impostos   | 1.500  | 1.200  | 1.800 | ... | 1.600 | 18k
TOTAL         | 13.200 | 12.200 | 14.700| ... | 14.200| 160k
```

### Alterações em `src/components/HistoricoAnual.tsx`

**1. Novo state**: `selectedDetailYear` (default 2025) para o seletor da matriz de despesas.

**2. Novo useMemo — `receitasPorCusto`**: Filtra anos 2024-2025, custoNum 1-10, agrupa por centro de custo e ano. Retorna array de `{ custo, total2024, total2025, variacao }`.

**3. Novo useMemo — `despesasMatriz`**: Filtra o `selectedDetailYear`, custoNum 11-20, agrupa por centro de custo e mês. Retorna `Map<custo, number[12]>` (array de 12 meses). Calcula totais por linha e coluna.

**4. JSX**: Remover bloco de gráficos (linhas 217-274). Inserir no mesmo local:
- Card "Receitas por Centro de Custo" — tabela com 4 colunas
- Card "Despesas por Centro de Custo" — botões 2024/2025 + tabela matriz 14 colunas (custo + 12 meses + total)
- Células clicáveis que expandem detalhamento inline

**5. Manter**: Year cards e tabela comparativa existentes abaixo.

