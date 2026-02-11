

## Plano: Corrigir Saldo Final Livre no Fluxo de Caixa

### Problema

O calculo do "Saldo Final Livre" usa `resultadoMes`, que ja desconta impostos e comissoes de vendedor. Porem, esses valores sao itens da DRE (provisoes contabeis) e nao saidas reais de caixa. O dinheiro ainda esta no banco.

Isso causa a diferenca entre:
- **Saldo Final Livre**: R$ 27.254,36 (incorreto, desconta impostos/comissoes que nao sairam do caixa)
- **Saldo Final Real (soma bancos)**: R$ 31.385,88 (correto, reflete o caixa real)

### Solucao

No Fluxo de Caixa, substituir `resultadoMes` por `resultadoCaixa`, que usa apenas valores que realmente movimentaram o caixa:

```text
resultadoCaixa = totalLiquidoReceitas - totalDespesas
```

Em vez de:

```text
resultadoMes = (totalLiquidoReceitas - impostos - comVendedor) - totalDespesas
```

### O que muda na tela

```text
FLUXO DE CAIXA
  Saldo Inicial                              R$ X
  (+) Resultado de Caixa do Mes              R$ Y  (receitas liquidas - despesas, SEM descontar impostos/comissoes)
  = Disponivel                               R$ X + Y
  (-) Saidas de Caixa                        R$ Z
  (+) Entradas de Caixa                      R$ W
  = SALDO FINAL LIVRE                        R$ X + Y - Z + W  (vai bater com soma dos bancos)
```

### Detalhes Tecnicos

| Arquivo | O que muda |
|---------|-----------|
| `src/components/DREFluxoCaixa.tsx` | Criar `resultadoCaixa = totalLiquidoReceitas - totalDespesas`. Usar `resultadoCaixa` em vez de `resultadoMes` nos calculos de `disponivelAntes` e `saldoFinalLivre`. Atualizar o label na UI e no PDF de "Resultado do Mes" para "Resultado de Caixa" na secao de fluxo. A DRE continua mostrando `resultadoMes` com impostos e comissoes normalmente. |

Linha 137-138 muda de:
```typescript
const disponivelAntes = totalSaldoInicial + resultadoMes;
const saldoFinalLivre = disponivelAntes - totalSaidasCaixa + totalEntradasCaixa;
```

Para:
```typescript
const resultadoCaixa = totalLiquidoReceitas - totalDespesas;
const disponivelAntes = totalSaldoInicial + resultadoCaixa;
const saldoFinalLivre = disponivelAntes - totalSaidasCaixa + totalEntradasCaixa;
```

Isso fara o Saldo Final Livre bater com a soma dos saldos finais dos bancos.

