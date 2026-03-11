

## Plano: Corrigir Saldo Final por Banco (AZUL 632,91 → 1473,55)

### Diagnóstico

O problema tem duas causas:

1. **Bancos falsos na listagem**: Registros com `custoNum` 50 (Investimentos) e 32 (Lance a Dois) têm `banco` = "INVEST" e "L2" respectivamente. O sistema cria entradas de banco para eles no Saldo Final, mas estes NÃO são bancos reais.

2. **Dupla contagem**: As linhas 284-286 e 37-38 adicionam custoNum 50, 51, 52, 32 como `destinacoes` (saídas) dos bancos. Mas esses registros NÃO representam dinheiro saindo de um banco real - são categorias contábeis. Se houver transferência real de AZUL para investimento, ela já está contabilizada via custoNum 99 (transferência) ou outro registro. Contá-los novamente reduz artificialmente o saldo do AZUL.

### Correção

**Arquivo**: `src/components/DREFluxoCaixa.tsx`

**1. `calcSaldoFinalPorBanco` (linha 37-38)**: Remover custoNum 32, 50, 51, 52 e 31 do cálculo de saldo por banco. Saldo por banco deve refletir apenas: SI + receitas(1-10) - despesas(11-20) - saidasCaixa(21-30) + entradasCaixa(97/98) + transferências(99).

**2. `fluxoBancos` (linhas 284-286)**: Remover as 3 linhas que adicionam `grouped.investimentos`, `grouped.reservas` e `grouped.lanceADois` como destinações bancárias.

**3. Filtrar bancos não-reais do Saldo Final**: No JSX (linha 1226), filtrar `fluxoBancos` para excluir bancos que não são reais (INVEST, L2, PROVISAO e similares). Usar uma lista de bancos reais extraída dos registros de saldo inicial (custoNum 0), ou filtrar bancos que só aparecem em custoNum 50/32/51/52.

