## Plano: Remover Cards + Toggle Investimento XP

### 1. Remover os 4 cards de resumo do Painel Financeiro

Excluir o bloco `{/* Summary Cards */}` (linhas 123-151 de `PainelFinanceiro.tsx`) — os 4 cards de Saldo Inicial, Receitas, Despesas e Resultado. A informação já está detalhada na aba DRE + Fluxo.

### 2. Investimento XP — toggle para zerar

Adicionar um state `investimentoXPAtivo` (boolean, default `true`) no `DREFluxoCaixa.tsx`. Quando desativado, o cálculo usa 0% em vez de 10%.

**UI**: Colocar um pequeno botão/switch ao lado do texto "(-) Investimento XP (10%)" que permite ligar/desligar. Quando desligado, mostra "(-) Investimento XP (0%)" e o valor fica R$ 0,00. O Patrimônio Final recalcula automaticamente.

Aplicar a mesma lógica no cálculo do PDF (linha 744).

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/PainelFinanceiro.tsx` | Remover bloco de cards |
| `src/components/DREFluxoCaixa.tsx` | Adicionar toggle para Investimento XP |