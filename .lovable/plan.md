

## Plano: Transporte automático de Saldo Inicial entre meses

### Problema
Cada mês só exibe registros com `custoNum: 0` daquele próprio mês. Se fevereiro não tem lançamentos de saldo inicial, aparece R$ 0,00.

### Solução
Quando o mês selecionado **não tem registros de saldo inicial** (custoNum 0), calcular automaticamente o Saldo Final do mês anterior e usá-lo como Saldo Inicial.

### Alterações

**Arquivo: `src/components/PainelFinanceiro.tsx`**

1. Passar **todos os dados** (`data`) para `DREFluxoCaixa`, além do `filteredData`, para que o componente possa acessar o mês anterior.

**Arquivo: `src/components/DREFluxoCaixa.tsx`**

1. Receber prop adicional `allData: Pagina5Record[]` (dados de todos os meses).
2. Na lógica do `grouped`, se `saldoInicial` estiver vazio (sem registros custoNum 0 no mês atual):
   - Calcular mês/ano anterior
   - Filtrar `allData` para esse mês anterior
   - Processar receitas, despesas, saídas, entradas, transferências do mês anterior
   - Calcular o Saldo Final do mês anterior
   - Criar registros sintéticos de saldo inicial por banco com esses valores
3. Adicionar indicador visual discreto ("Transportado de Jan/2025") quando o saldo for automático.

### Lógica de cálculo do mês anterior

```text
Saldo Final (Jan) = Saldo Inicial (Jan) + Receitas - Despesas - Saídas + Entradas + Transferências
                  → vira Saldo Inicial (Fev) por banco
```

Se o mês anterior também não tiver saldo inicial, a cadeia continua recursivamente até encontrar um mês com lançamento manual, ou retorna 0.

### Detalhes técnicos
- A recursão será limitada a 12 meses para evitar loops infinitos
- Os registros sintéticos terão um flag para distingui-los dos manuais
- O card de Saldo Inicial mostrará "(transportado)" quando for automático
- Nenhuma alteração na planilha necessária

