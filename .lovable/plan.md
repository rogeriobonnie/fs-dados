

## Plano: Ajustar Receitas por Centro de Custo + Filtro de Ano no Ranking Eduzz

### 1. Receitas por Centro de Custo — limpeza e detalhamento

**Filtro**: Excluir `custoNum === 7` do filtro de receitas (linha 123), ficando: `custoNum >= 1 && custoNum <= 10 && custoNum !== 7`.

**Detalhamento sem poluir**:
- Adicionar colunas **Qtd 2024** e **Qtd 2025** (contagem de transações por centro de custo)
- Adicionar barra de proporção visual inline em cada linha (div com width % relativa ao maior valor)
- Trocar descrição para "Receitas operacionais — comparativo anual"
- Nota no rodapé: "Exclui aplicações/rendimentos (apresentados em seção própria)"

### 2. Ranking Eduzz — filtro por ano

**Novo state**: `eduzzRankingYear: 'todos' | number` (default `'todos'`)

**UI**: Adicionar um seletor (botões ou Select) no header do card/aba Ranking: `[Todos] [2024] [2025]` — anos extraídos dinamicamente dos dados.

**Lógica**: Filtrar `eduzzData` pelo ano selecionado antes de calcular `eduzzRanking`. Quando "Todos", comportamento atual. Quando um ano específico, ranking mostra apenas vendas daquele ano — totais, alunos, melhor mês, tudo recalculado para o ano filtrado.

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/HistoricoAnual.tsx` | Excluir custoNum 7, adicionar qtd/barra, adicionar filtro ano no ranking Eduzz |

