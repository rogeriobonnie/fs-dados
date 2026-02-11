

## Plano: Provisoes (custoNum 31) e Melhoria do PDF

### Resumo das Mudancas

Tres alteracoes principais no `DREFluxoCaixa.tsx`:

### 1. Provisoes (custoNum 31) apos Resultado do Mes

Novo grupo `provisoes` para custoNum=31. As provisoes com banco="PROVISAO" aparecem **apos** o card de "= RESULTADO DO MES", diminuindo o resultado mas **sem afetar** o Fluxo de Caixa.

Quando o banco de uma provisao estiver preenchido como "PAGO" (ou qualquer valor diferente de "PROVISAO"), ela nao aparece no resultado -- significa que ja foi paga.

Layout na tela:

```text
= RESULTADO DO MES                          R$ X

PROVISOES (custoNum 31, banco = PROVISAO)
  31-Provisoes
    Data | Descricao | Detalhe | Valor | Banco
  SUBTOTAL PROVISOES                        -R$ P

= RESULTADO APOS PROVISOES                  R$ X - R$ P

--- separador ---

FLUXO DE CAIXA (sem incluir provisoes)
```

### 2. Banco "PAGO" nao aparece no resultado

Itens com banco diferente de "PROVISAO" no custoNum 31 sao ignorados no calculo de provisoes (ja foram pagos e ja afetaram o caixa por outra via).

### 3. PDF melhorado - Estrutura completa

O PDF tera a seguinte estrutura:

```text
PAGINA 1 - DRE
  Receitas resumo (bruto, taxas, liquido, impostos, comissoes, resultado)
  Despesas resumo por centro de custo
  = RESULTADO DO MES
  Provisoes (custoNum 31)
  = RESULTADO APOS PROVISOES

PAGINA 2 - FLUXO DE CAIXA
  Saldo Inicial
  (+) Resultado do Mes
  = Disponivel
  (-) Saidas de Caixa (21-30)
  (+) Entradas de Caixa (97, 98)
  = SALDO FINAL LIVRE
  Saldo por Banco

PAGINAS SEGUINTES - DETALHAMENTO
  Detalhamento receitas por curso
  Detalhamento despesas por centro de custo
  Detalhamento saidas/entradas de caixa
```

### Detalhes Tecnicos

| Arquivo | O que muda |
|---------|-----------|
| `src/components/DREFluxoCaixa.tsx` | Adicionar grupo `provisoes` (custoNum=31, banco=PROVISAO) no `grouped`. Calcular `totalProvisoes` e `resultadoAposProvisoes`. Renderizar secao de provisoes entre o card Resultado e o Fluxo de Caixa. Reestruturar PDF com DRE completa (incluindo provisoes) na pagina 1, Fluxo de Caixa na pagina 2, e detalhamento nas paginas seguintes. |

Codigo de filtragem:

```typescript
// No grouped useMemo
const provisoes: Record<string, Pagina5Record[]> = {};
// ...dentro do forEach:
} else if (r.custoNum === 31 && r.banco === 'PROVISAO') {
  if (!provisoes[r.custo]) provisoes[r.custo] = [];
  provisoes[r.custo].push(r);
}

// No totals
let totalProvisoes = 0;
Object.values(grouped.provisoes).forEach(items => {
  items.forEach(r => { totalProvisoes += Math.abs(r.valorLiquido); });
});
const resultadoAposProvisoes = resultadoMes - totalProvisoes;
```

