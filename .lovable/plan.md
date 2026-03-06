

## Plano: Adicionar detalhe por banco no Saldo Inicial e Saldo Final do Resumo do Fluxo de Caixa

### Situacao atual

- O card "SALDO INICIAL" (linha 736-760) ja mostra os saldos por banco em grid
- No "RESUMO DO FLUXO DE CAIXA", ao expandir "Saldo Inicial" (linha 999-1023), ja aparece o detalhe por banco
- Ao expandir "SALDO FINAL LIVRE" (linha 1167-1196), mostra apenas a formula geral, sem detalhe por banco

### O que sera feito

**Arquivo: `src/components/DREFluxoCaixa.tsx`**

1. **Saldo Inicial no Resumo** - Ja funciona com detalhe por banco. Sem alteracao necessaria.

2. **Saldo Final no Resumo** - Adicionar discretamente o detalhe por banco dentro do `CollapsibleContent` do "SALDO FINAL LIVRE" (linhas 1179-1194). Apos a formula geral, inserir uma divisoria fina e listar cada banco com seu saldo final calculado (usando `fluxoBancos` que ja existe e calcula `saldoFinal` por banco).

### Estrutura visual

```text
= SALDO FINAL LIVRE                    R$ 50.000,00
  ┌────────────────────────────────────────────────┐
  │ Saldo Inicial                    R$ 20.000,00  │
  │ (+) Resultado de Caixa          +R$ 35.000,00  │
  │ (-) Saídas de Caixa             -R$ 10.000,00  │
  │ (+) Entradas de Caixa           +R$  5.000,00  │
  │ = R$ 20.000 + R$ 35.000 ...      R$ 50.000,00 │
  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
  │ Composição por banco:                          │
  │   INTER                          R$ 30.000,00  │
  │   EDUZZ                          R$ 15.000,00  │
  │   CONTA AZUL                     R$  5.000,00  │
  └────────────────────────────────────────────────┘
```

### Detalhes tecnicos

- Usar `fluxoBancos` (ja calculado no componente) para listar cada banco com `saldoFinal`
- Estilizar com `text-[10px] text-muted-foreground` para ficar discreto
- Separar da formula com um `border-t border-dashed` fino
- Nenhum state novo necessario, apenas JSX adicional dentro do CollapsibleContent existente do saldo final (linhas 1179-1194)

