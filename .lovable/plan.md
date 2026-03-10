

## Plano: Nova aba "Ranking de Produtos" no Painel Financeiro

### Objetivo
Criar uma 4a aba dentro do Painel Financeiro que analisa os cursos/produtos vendidos, mostrando ranking por faturamento, quantidade de vendas, margem líquida, e evolução acumulada ao longo dos meses.

### Fonte de dados
Os registros de receita (custoNum 1-10) da Página5 contêm o campo `descricao` que identifica o curso/produto. Usaremos `allData` (todos os meses) para comparações e acumulados, e `filteredData` para o mês selecionado.

### Layout da aba

```text
+--------------------------------------------------+
| RANKING DE PRODUTOS                               |
+--------------------------------------------------+

[Cards resumo - Top 3 produtos do mês]
+------------+ +------------+ +------------+
| #1 Curso X | | #2 Curso Y | | #3 Curso Z |
| 15 vendas  | | 10 vendas  | | 8 vendas   |
| R$ 45k bruto| R$ 30k     | | R$ 24k     |
| Margem 62% | | Margem 55% | | Margem 48% |
+------------+ +------------+ +------------+

[Toggle: Mês atual / Acumulado ano]

[Tabela ranking completa - ordenável]
Produto | Qtd Vendas | Bruto | Taxas | Impostos | Líquido | Margem%

[Gráfico barras horizontais - Top 10 por faturamento]
[Gráfico pizza - Participação % no faturamento total]
```

### Estrutura técnica

**1. Novo componente: `src/components/RankingProdutos.tsx`**

Props: `data: Pagina5Record[]`, `allData: Pagina5Record[]`, `selectedMonth: string`, `selectedYear: string`

Lógica:
- Filtrar receitas (custoNum 1-10) e agrupar por `descricao` (nome do curso)
- Para cada produto calcular:
  - Quantidade de vendas (count de registros)
  - Valor Bruto (soma valorBruto)
  - Taxas (soma taxas)
  - Impostos (soma vrImposto)
  - Comissões (soma vrVendedor + vrMkt)
  - Valor Líquido (valorLiquido - impostos - comissões)
  - Margem % = (Líquido / Bruto) * 100
- Toggle "Mês atual" vs "Acumulado ano" filtra dados do mês ou do ano inteiro
- Tabela ordenável por qualquer coluna (default: valor bruto desc)
- Gráfico de barras horizontais (Recharts BarChart layout="vertical") com top 10
- Gráfico de pizza (Recharts PieChart) com participação %
- Cards destacando os 3 melhores produtos com medalhas visuais

**2. Modificar `src/components/PainelFinanceiro.tsx`**
- Adicionar 4a aba "Ranking" com ícone `Trophy`
- Grid de tabs passa de 3 para 4 colunas
- Passar `allData={data}` para o novo componente

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/RankingProdutos.tsx` | Criar |
| `src/components/PainelFinanceiro.tsx` | Adicionar 4a aba |

