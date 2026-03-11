

## Plano: Adicionar Despesas Provisionadas (custo 33) + Resultado Mensal + Reorganizar Reservas

### O que muda

Após o **Patrimônio Final**, adicionar uma nova seção:

1. **Despesas do Mês Subsequente (custoNum 33)** — agrupadas por `descricao` (coluna B), com subtotais por grupo e total geral. Esse total é subtraído do Patrimônio Final.

2. **Resultado Mensal** = Patrimônio Final - Total Desp Mês Sub

3. **Resultado ÷ 3** — uma linha abaixo mostrando o valor dividido por 3.

4. **Reservas/Caixinhas** — mover para depois do Resultado ÷ 3, com cor diferenciada (manter a cor azul que já tem). Remover a linha "Saldo Disponível" que fica no final.

### Alterações em `src/components/DREFluxoCaixa.tsx`

**1. Grouped data (linha ~140-166)**: Adicionar captura de `custoNum === 33` como `despMesSub`, agrupado por `r.descricao`.

**2. JSX (após Patrimônio Final, linha ~1367)**: Dentro do mesmo IIFE que calcula patrimônio:
- Seção "DESPESAS MÊS SUBSEQUENTE" (custoNum 33), colapsável, agrupada por descrição com subtotais
- Linha "TOTAL DESP MÊS SUB" com total
- Linha "RESULTADO MENSAL" = patrimonioFinal - totalDespMesSub
- Linha "RESULTADO ÷ 3" = resultadoMensal / 3

**3. Reservas (linha ~1372-1434)**: Mover para depois do bloco acima. Remover "Saldo Disponível" (linhas 1423-1430).

### Layout visual

```text
PATRIMÔNIO FINAL                          R$ XX.XXX
──────────────────────────────────────────────────
(-) DESP MÊS SUBSEQUENTE [33]
    Aluguel (3)                          -R$ 3.000
    Internet (1)                           -R$ 200
    ...
    TOTAL                                -R$ 5.000
──────────────────────────────────────────────────
RESULTADO MENSAL                          R$ XX.XXX
    ÷ 3                                  R$ XX.XXX
──────────────────────────────────────────────────
RESERVAS / CAIXINHAS  (fundo azul)
    51-Giro (2)                           R$ X.XXX
    52-Caixinhas (3)                      R$ X.XXX
    Total em Reservas                     R$ X.XXX
```

