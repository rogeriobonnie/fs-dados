

## Plano: Comissão MKT "Lance a Dois" com Calculo sobre Resultado Liquido

### Logica Atual (errada)
O painel soma os valores da coluna `vrMkt` diretamente. Isso nao reflete o calculo correto.

### Logica Nova
Para o MKT "LANCE A DOIS" na coluna N:

1. **Filtrar receitas** (custoNum 1-10) onde coluna N (mkt) = "LANCE A DOIS"
2. **Calcular receita liquida** por registro: `valorBruto - taxas + acrescimos - vrImposto - vrVendedor`
3. **Filtrar despesas** (custoNum 11-20) onde coluna N (mkt) = "LANCE A DOIS"
4. **Resultado liquido** = soma receitas liquidas + soma despesas (que ja sao negativas)
5. **Comissao** = resultado liquido * 10%

### Tabela na UI

A secao "Comissoes por MKT" sera substituida por uma tabela especifica "Lance a Dois" mostrando:

```text
RECEITAS (mkt = LANCE A DOIS, custoNum 1-10)
  Curso/Receita | Bruto | Taxas | Acrescimos | Impostos | Com.Vendedor | Liquido
  ...
  SUBTOTAL RECEITAS                                                      R$ X

DESPESAS (mkt = LANCE A DOIS, custoNum 11-20)
  Despesa | Valor
  ...
  SUBTOTAL DESPESAS                                                      R$ Y

RESULTADO LIQUIDO (receitas - despesas)                                  R$ Z
COMISSAO 10%                                                             R$ Z * 0.10
```

### Alteracoes

| Arquivo | O que muda |
|---------|-----------|
| `src/components/ComissoesPainel.tsx` | Substituir a secao "Comissoes por MKT" pela logica Lance a Dois: filtrar receitas e despesas com mkt="LANCE A DOIS", calcular resultado liquido (bruto - taxas + acrescimos - impostos - comissoes vendedor + despesas), aplicar 10%. Atualizar card de resumo e PDF. |

### Detalhes Tecnicos

No `ComissoesPainel.tsx`:

```typescript
// Receitas Lance a Dois
const receitasLAD = data.filter(r => 
  r.custoNum >= 1 && r.custoNum <= 10 && 
  r.mkt.toUpperCase().includes('LANCE')
);

// Receita liquida por item
const totalReceitaLiquida = receitasLAD.reduce((s, r) => 
  s + (r.valorBruto - r.taxas + r.acrescimos - r.vrImposto - r.vrVendedor), 0
);

// Despesas Lance a Dois
const despesasLAD = data.filter(r => 
  r.custoNum >= 11 && r.custoNum <= 20 && 
  r.mkt.toUpperCase().includes('LANCE')
);
const totalDespesas = despesasLAD.reduce((s, r) => s + r.valorLiquido, 0); // negativo

// Resultado e comissao
const resultadoLiquido = totalReceitaLiquida + totalDespesas;
const comissaoLAD = resultadoLiquido * 0.10;
```

A secao de vendedores permanece inalterada. Apenas a secao MKT muda para este calculo especifico do Lance a Dois.

