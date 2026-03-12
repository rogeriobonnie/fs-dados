

## Plano: Aplicações/Rendimentos + Cursos Eduzz na aba Histórico

### 1. Aplicações/Rendimentos e Lucros Divididos (custoNum 7 e 21)

Após a matriz de despesas, adicionar um novo Card com tabela comparativa 2024 vs 2025:

- **07-Aplicação/Rendimento** (custoNum 7): soma `valorLiquido` por ano, com detalhamento por `descricao`
- **Lucros Divididos** (custoNum 21): soma `abs(valorLiquido)` por ano, com detalhamento por `descricao`

Tabela simples: Categoria | 2024 | 2025 | Variação — com subtotais por grupo e total geral.

### 2. Cursos Eduzz (Página6) — novo fetch + painel analítico

**a) Novo método no serviço** (`googleSheetsService.ts`):
- `fetchPagina6Data()`: busca `Página6!A:F`
- Parser retorna array de `{ date, curso, aluno, valor, valorLiquido, taxas, month, year }`

**b) Novo bloco no `HistoricoAnual.tsx`**:

Carregar dados da Página6 no `useEffect` junto com o fetch existente. Processar com `useMemo`:

- **Ranking de cursos**: agrupa por `curso`, soma valor/taxas, conta alunos únicos, ordena por valor total desc
- **Timeline**: agrupa por ano/mês para mostrar evolução
- **Totais**: valor bruto, taxas, líquido, qtd alunos

**Card "Cursos Eduzz — Análise de Vendas"** com:

```text
RESUMO
Total Vendido: R$ XX.XXX | Taxas: R$ X.XXX | Líquido: R$ XX.XXX | Alunos: XX

RANKING DE CURSOS (tabela)
Curso          | Vendas | Alunos | Valor Bruto | Taxas    | Líquido  | Melhor Mês
Curso ABC      | 45     | 38     | R$ 50.000   | R$ 5.000 | R$ 45.000| Mar/2024
Curso XYZ      | 22     | 20     | R$ 25.000   | R$ 2.500 | R$ 22.500| Jul/2025

VENDAS POR ANO/MÊS (matriz)     [2024] [2025]
Curso     | Jan | Fev | Mar | ... | Dez | TOTAL
Curso ABC | 3   | 5   | 8   | ... | 2   | 45
...

ÚLTIMAS VENDAS (lista colapsável)
Data | Curso | Aluno | Valor | Taxa | Líquido
```

### Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `src/services/googleSheetsService.ts` | Adicionar `fetchPagina6Data()` e parser |
| `src/components/HistoricoAnual.tsx` | Adicionar seção Aplicações/Lucros + Cursos Eduzz |

