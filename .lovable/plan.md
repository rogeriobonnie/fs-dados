

## Plano: Simplificar Saldo por Banco

### Problema
A tabela atual de "Saldo por Banco" tem 6 colunas intermediárias (Receitas, Despesas, Saídas Cx, Entradas Cx, Transferências) que confundem. O raciocínio correto é simples: para cada banco, somar tudo que entrou e subtrair tudo que saiu.

### Lógica por Banco

```text
EDUZZ:
  Saldo Inicial         R$ 11.355,99
  (+) Entradas          R$ 16.976,30   <-- receitas + resgates + entradas caixa + transferências positivas
  (-) Saídas            R$ 28.332,29   <-- despesas + destinações + transferências negativas
  = Saldo Final         R$      0,00
```

### Mudanca no Codigo

**Arquivo:** `src/components/DREFluxoCaixa.tsx`

1. No `fluxoBancos` (linhas 137-155), manter a coleta individual mas calcular dois totais por banco:
   - `entradas` = receitas + resgates + transferências positivas
   - `saidas` = despesas + destinações + transferências negativas (valor absoluto)
   - `saldoFinal` = saldoInicial + entradas - saidas

2. Na UI (linhas 790-844), simplificar a tabela para 4 colunas:
   - **Banco | Saldo Inicial | + Entradas | - Saídas | Saldo Final**

3. No PDF (linhas 406-414), atualizar para mesma estrutura simplificada.

### Detalhes Tecnicos

No `fluxoBancos` useMemo, o tipo `FluxoCaixaBanco` será mantido internamente para coleta, mas na hora de renderizar, calcular:

```typescript
const entradas = b.receitas + b.resgates + Math.max(0, b.transferencias);
const saidas = b.despesas + b.destinacoes + Math.abs(Math.min(0, b.transferencias));
const saldoFinal = b.saldoInicial + entradas - saidas;
```

A tabela fica:

```text
┌──────────┬───────────────┬──────────────┬──────────────┬──────────────┐
│ Banco    │ Saldo Inicial │ + Entradas   │ - Saídas     │ Saldo Final  │
├──────────┼───────────────┼──────────────┼──────────────┼──────────────┤
│ AZUL     │ R$ 0,00       │ R$ 0,00      │ R$ 0,00      │ R$ 0,00      │
│ EDUZZ    │ R$ 11.355,99  │ R$ 16.976,30 │ R$ 28.332,29 │ R$ 0,00      │
│ INTER    │ R$ 46.174,32  │ R$ XX.XXX    │ R$ XX.XXX    │ R$ XX.XXX    │
├──────────┼───────────────┼──────────────┼──────────────┼──────────────┤
│ TOTAL    │ R$ 57.530,31  │ R$ XX.XXX    │ R$ XX.XXX    │ R$ XX.XXX    │
└──────────┴───────────────┴──────────────┴──────────────┴──────────────┘
```

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/DREFluxoCaixa.tsx` | Simplificar tabela de banco para 4 colunas (Saldo Inicial, Entradas, Saídas, Saldo Final) na UI e no PDF |

