

## Plano: Drill-down hierárquico nos Cursos Eduzz (Curso → Ano → Mês → Detalhe)

### O que muda

**1. Ranking de Cursos — drill-down em 3 níveis:**

Ao clicar num curso no ranking, em vez de mostrar lista flat de alunos, agora mostra:

- **Nível 1**: Linhas por ano (2024, 2025, etc.) com totais consolidados (vendas, valor bruto, taxas, líquido)
- **Nível 2**: Ao clicar no ano, expande colunas por mês (Jan-Dez) com valores consolidados
- **Nível 3**: Ao clicar no mês, expande lista de alunos com data, valor, taxa, líquido

**2. Nova sub-aba "Vendas por Ano/Mês" dentro do card Eduzz:**

Adicionar tabs internos no Card Eduzz: "Ranking" | "Vendas Ano/Mês"

- **Aba "Ranking"**: mantém o ranking atual com o novo drill-down hierárquico
- **Aba "Vendas Ano/Mês"**: tabela pivot com linhas = cursos, colunas = ano/mês, mostrando valores brutos consolidados. Destaca o mês mais vendido de cada curso. Inclui totais por linha e coluna.

### States adicionais

- `expandedEduzzCursoYear: string | null` (ex: "Curso ABC-2024")
- `expandedEduzzCursoMonth: string | null` (ex: "Curso ABC-2024-3")
- `eduzzTab: 'ranking' | 'vendas'` (default 'ranking')

### Layout do drill-down no Ranking

```text
🥇 Curso ABC | 45 vendas | 38 alunos | R$ 50k | -R$ 5k | R$ 45k | Mar/2024
   ▼ (clicou no curso)
   ├─ 2024 | 30 vendas | R$ 35.000 | -R$ 3.500 | R$ 31.500
   │    ▼ (clicou em 2024)
   │    Jan | Fev | Mar | Abr | ... | Dez | TOTAL
   │    R$2k| R$3k| R$8k| R$4k| ... | R$1k| R$35k
   │         ▼ (clicou em Mar)
   │         01/03 - Aluno X - R$ 500 - Taxa R$ 50 - Líq R$ 450
   │         15/03 - Aluno Y - R$ 700 - Taxa R$ 70 - Líq R$ 630
   │
   ├─ 2025 | 15 vendas | R$ 15.000 | -R$ 1.500 | R$ 13.500
```

### Layout da aba "Vendas Ano/Mês"

```text
[Ranking] [Vendas Ano/Mês]

Curso        | 2024          | 2025          | TOTAL
             | Vendas | Bruto| Vendas | Bruto|
Curso ABC    |   30   | 35k  |   15   | 15k  | 45 | 50k
Curso XYZ    |   12   | 14k  |   10   | 11k  | 22 | 25k
TOTAL        |   42   | 49k  |   25   | 26k  | 67 | 75k

★ Mais vendido 2024: Curso ABC (Mar/2024 — R$ 8k)
★ Mais vendido 2025: Curso ABC (Jun/2025 — R$ 5k)
```

### Alterações em `src/components/HistoricoAnual.tsx`

- Adicionar states: `eduzzTab`, `expandedEduzzCursoYear`, `expandedEduzzCursoMonth`
- Novo `useMemo` — `eduzzPorAnoMes`: agrupa por curso → ano → { vendas, valor, taxas, líquido, melhorMes }
- Substituir o conteúdo expandido do ranking (linhas 683-715) pelo drill-down hierárquico Ano → Mês → Detalhe
- Adicionar Tabs dentro do Card Eduzz para alternar entre "Ranking" e "Vendas Ano/Mês"
- Nova tabela pivot na aba "Vendas Ano/Mês" com destaque dos mais vendidos

