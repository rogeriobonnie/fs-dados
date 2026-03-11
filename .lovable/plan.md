

## Plano: Corrigir Saldo Final + Adicionar Provisão Lance a Dois e Investimento XP

### Bug do Saldo Final

O problema está nas linhas 263-281 (`fluxoBancos`) e 23-44 (`calcSaldoFinalPorBanco`): registros com `custoNum` 50 (investimentos), 51 e 52 (reservas) representam saídas reais dos bancos mas **não são contabilizados** no cálculo do saldo final por banco. Apenas os ranges 1-10, 11-20, 21-30, 97/98 e 99 são processados.

**Correção**: Incluir custoNum 50, 51, 52 como destinações (saídas) tanto em `calcSaldoFinalPorBanco` quanto em `fluxoBancos`, para que o saldo final de cada banco reflita essas movimentações.

### Novas linhas após Patrimônio Total (linhas 1260-1269)

Estrutura atual:
```
PATRIMÔNIO TOTAL (Saldo em Bancos + Investimentos) = X
```

Nova estrutura:
```
PATRIMÔNIO TOTAL (Saldo em Bancos + Investimentos) = X
  (-) Provisão Lance a Dois (32-LANCE A DOIS)       = -Y
  = PATRIMÔNIO LÍQUIDO                               = X - Y
  (-) Investimento XP (10%)                           = -(X-Y)*0.10
  = PATRIMÔNIO FINAL                                  = (X-Y) * 0.90
```

### Implementação

**1. `calcSaldoFinalPorBanco` (linhas 30-37)**: Adicionar condição para custoNum 50, 51, 52 como saídas do banco

**2. `fluxoBancos` (linhas 272-277)**: Incluir `grouped.investimentos` e `Object.values(grouped.reservas).flat()` nas destinações por banco

**3. `grouped` useMemo (linhas 142-163)**: Adicionar captura de custoNum 32 em um novo grupo `lanceADois: Pagina5Record[]`

**4. Seção Investimentos no JSX (linhas 1228-1271)**: Após a linha "PATRIMÔNIO TOTAL", adicionar:
   - Linha: Provisão Lance a Dois (32) com valor e detalhamento colapsável
   - Linha: Patrimônio Líquido = Patrimônio Total - Provisão
   - Linha: Investimento XP (10% do Patrimônio Líquido)
   - Linha: Patrimônio Final = Patrimônio Líquido - Investimento XP

### Arquivo alterado
`src/components/DREFluxoCaixa.tsx`

