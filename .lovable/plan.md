

## Ajustes no Painel Financeiro

### 1. Cards do Painel Financeiro - Refletir dados reais da DRE

Os 4 cards atuais usam calculos simplificados que nao batem com a DRE. Vou atualizar para usar a mesma logica:

| Card | Hoje (simplificado) | Corrigido (real) |
|------|---------------------|------------------|
| Saldo Inicial | `valorBruto` dos registros custoNum 0 | Mantido (ja esta correto) |
| Receitas | `valorLiquido` bruto | Resultado real: liquido - impostos - comissoes vendedores |
| Despesas | `abs(valorLiquido)` despesas 11-20 | Mantido (ja esta correto) |
| Resultado | Receitas - Despesas simples | Resultado real da DRE (receitas resultado - despesas) |

**Arquivo**: `src/components/PainelFinanceiro.tsx`

- Atualizar o calculo do `summary` para considerar impostos e comissoes de vendedores no valor de receitas, alinhando com a DRE
- Receitas no card mostrara o "Resultado Receitas" (liquido - impostos - comissoes vendedores com campo vendedor preenchido)
- Resultado sera Receitas (resultado) - Despesas

### 2. Lance a Dois - Incluir nome (detalhamento) ao lado do curso

Na tabela de receitas do Lance a Dois, adicionar a coluna "Nome" (campo `detalhamento` do registro) logo apos a coluna "Curso".

**Arquivo**: `src/components/ComissoesPainel.tsx`

- Na tabela de receitas LAD, adicionar `<TableHead>Nome</TableHead>` apos "Curso"
- Na linha de dados, adicionar `<TableCell>{r.detalhamento}</TableCell>` apos `r.descricao`
- Atualizar o `colSpan` do footer de 2 para 3
- Atualizar o PDF do LAD para incluir a coluna "Nome" tambem

### Detalhes Tecnicos

**PainelFinanceiro.tsx - novo calculo summary:**
```text
const receitas = filteredData.filter(r => r.custoNum >= 1 && r.custoNum <= 10);
const totalBruto = soma valorBruto
const totalImpostos = soma vrImposto
const totalComVend = soma vrVendedor (apenas quando vendedor preenchido)
const totalResultadoReceitas = soma valorLiquido - totalImpostos - totalComVend
const resultado = totalResultadoReceitas - totalDespesas
```

**ComissoesPainel.tsx - nova coluna:**
- Header: Data | Curso | Nome | Bruto | Taxas | ...
- Body: r.date | r.descricao | r.detalhamento | ...
- Footer colSpan: 2 -> 3
- PDF head: adicionar 'Nome' apos 'Curso'
