

## Plano: Drill-down nas Receitas Operacionais + Remover 2026 do Eduzz

### 1. Receitas Operacionais — drill-down por clique

Ao clicar numa linha da tabela de receitas operacionais, expandir uma sub-tabela mostrando o detalhamento Ano → Mês.

**Estrutura expandida:**

```text
01-Cursos FS | Qtd 2024 | R$ 2024 | Qtd 2025 | R$ 2025 | Variação | Proporção
  ▼ (clicou)
  ├─ 2024
  │   Jan | Fev | Mar | ... | Dez | TOTAL
  │   R$5k| R$8k| R$12k|    | R$3k| R$90k
  ├─ 2025
  │   Jan | Fev | Mar | ... | Dez | TOTAL
  │   R$7k| R$10k| R$15k|   | -   | R$110k
```

**Mudanças técnicas:**
- Novo state: `expandedReceitaCusto: string | null`
- Novo `useMemo` — `receitasDetalhe`: agrupa registros de receitas operacionais (custoNum 1-10, excl 7) por centro de custo → ano → mês, com valores e contagens
- Ao clicar na `TableRow`, togglá-la para expandir/colapsar
- Linha expandida: renderiza mini-tabela com colunas Jan-Dez + Total, uma row por ano (2024, 2025)

### 2. Eduzz — filtrar registros de 2026

Adicionar filtro `r.year <= 2025` em todos os pontos que processam dados Eduzz:
- `eduzzTotals` (linha 212)
- `eduzzRanking` / `eduzzRankingYears` (linhas 175, 179)
- `eduzzHierarchy` (linha 223)
- `eduzzVendasPivot` (linha 234)
- `eduzzMatriz` (linha 200)

Alternativa mais limpa: filtrar no `setEduzzData` no `loadData` (linha 72), removendo registros com `year >= 2026` antes de guardar no state. Isso limpa tudo de uma vez.

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/HistoricoAnual.tsx` | Drill-down receitas + filtro 2026 Eduzz |

