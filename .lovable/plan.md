

## Plano: Atualizar PDF do DRE + Fluxo com nova lógica completa

### Problema
O PDF atual (linhas 400-862) para na seção "Saldo por Banco" e não inclui as seções adicionadas recentemente na UI: Investimentos, Patrimônio Total/Líquido/Final, Provisão Lance a Dois, Investimento XP, Despesas Mês Subsequente, Resultado Mensal, Resultado ÷ 3, e Reservas/Caixinhas.

### Alterações em `src/components/DREFluxoCaixa.tsx` — função `generatePDF` (linhas 400-862)

**Página 2 (Fluxo de Caixa)** — após "Saldo por Banco" (linha 736), adicionar:

1. **Investimentos (custo 50)** — tabela com itens e total
2. **Patrimônio Total** = Saldo Final Bancos Reais + Investimentos
3. **(-) Provisão Lance a Dois (32)** — itens e total
4. **Patrimônio Líquido** = Patrimônio Total - Provisão L2
5. **(-) Investimento XP (10%)** do Patrimônio Líquido
6. **Patrimônio Final** = Patrimônio Líquido - Investimento XP
7. **(-) Despesas Mês Subsequente (33)** — agrupadas por descrição, com subtotais e total
8. **Resultado Mensal** = Patrimônio Final - Total Desp Mês Sub
9. **Resultado ÷ 3**
10. **Reservas / Caixinhas (51, 52)** — tabela com fundo azul claro

**Página de Detalhamento** — após entradas de caixa (linha 860), adicionar:

11. **Detalhamento Provisões (31)** — se houver
12. **Detalhamento Lance a Dois (32)** — se houver
13. **Detalhamento Desp Mês Subsequente (33)** — agrupado por descrição
14. **Detalhamento Investimentos (50)** — se houver
15. **Detalhamento Reservas (51, 52)** — se houver

### Cálculos no PDF
Reutiliza os mesmos dados já calculados em `grouped`, `fluxoBancos`, `totals` — os valores de patrimônio serão recalculados inline na função `generatePDF` usando a mesma lógica do JSX (linhas 1274-1311).

### Formato visual
Cada seção usa `autoTable` com cores distintas:
- Patrimônio: azul (`[0, 100, 180]`)
- Desp Mês Sub: vermelho (`[200, 50, 50]`)
- Resultado Mensal: cinza escuro com destaque verde/vermelho
- Reservas: azul claro (`[100, 150, 220]`) com fundo `[230, 240, 255]`

