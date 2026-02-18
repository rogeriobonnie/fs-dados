
## Detalhamento interativo no Resumo do Fluxo de Caixa

Tornar cada linha do card "RESUMO DO FLUXO DE CAIXA" clicavel, mostrando um painel expansivel (ou dialog/popover) com o detalhamento do calculo.

### Como vai funcionar

Cada valor no resumo tera um botao/link clicavel. Ao clicar, expande uma area abaixo da linha mostrando de onde vem aquele numero:

| Linha clicavel | O que mostra ao expandir |
|---|---|
| Saldo Inicial | Lista de saldos por banco (banco + valor) |
| (+) Resultado de Caixa | Formula: Receitas Liquidas (X) - Despesas (Y) = Resultado, com subtotais por centro de custo |
| (-) Saidas de Caixa | Lista de itens custoNum 21-30, agrupados por centro de custo com subtotais |
| (+) Entradas de Caixa | Lista de itens custoNum 97-98, agrupados por centro de custo com subtotais |
| (+/-) Transferencias | Lista de transferencias custoNum 99 com banco e valor |
| Saldo Final Livre | Formula completa: Saldo Inicial + Resultado - Saidas + Entradas + Transferencias |

### Comportamento

- Clicar na linha expande/colapsa o detalhamento (estilo accordion)
- Apenas uma linha expandida por vez (ou varias, conforme preferencia)
- Cursor pointer e leve destaque (hover) indicam que e clicavel
- O detalhamento aparece dentro do proprio card, abaixo da linha clicada

### Detalhes Tecnicos

**Arquivo**: `src/components/DREFluxoCaixa.tsx`

- Adicionar um state `expandedFluxoRow` para controlar qual linha esta expandida
- Cada linha do resumo vira um componente clicavel com `Collapsible` (ja disponivel no projeto)
- Dentro do `CollapsibleContent`, renderizar uma mini-tabela ou lista com os itens que compoem aquele valor
- Usar os dados ja calculados em `grouped` (saldoInicial, receitas, despesas, saidasCaixa, entradasCaixa, transferencias) para popular os detalhamentos
- Adicionar icone de seta (ChevronDown/ChevronRight) ao lado de cada label para indicar expansibilidade
- Estilizar com fundo levemente diferente (`bg-muted/50`) para o conteudo expandido

**Estrutura de cada linha expandida**:
```text
(+) Resultado de Caixa          +R$ 30.816,48   [v]
  ┌─────────────────────────────────────────────┐
  │ Receitas Liquidas:              R$ 42.000,00 │
  │   01 - Cursos FS:              R$ 30.000,00 │
  │   05 - Cursos Terceiros:       R$ 12.000,00 │
  │ Despesas:                     -R$ 11.183,52 │
  │   11 - Fixas:                  -R$ 5.000,00 │
  │   12 - Variaveis:             -R$ 6.183,52 │
  │                                              │
  │ = Resultado: 42.000 - 11.183 = R$ 30.816,48 │
  └─────────────────────────────────────────────┘
```

Nenhum componente novo sera criado - tudo dentro do card existente usando Collapsible.
