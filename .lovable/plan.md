

## Plano: Melhorar Destinacoes/Utilizacoes e Fluxo de Caixa

### Problema Atual

A secao "Destinacoes e Utilizacoes" mistura saidas (21-LUCROS, 22-COMISSOES EXT, 23-DESP MES ANT) com entradas (97-TERCEIROS, 98-RESGATE) sem diferenciar visualmente. O fluxo de caixa aparece apenas como "Saldo Final" sem explicar como se chega la.

### Mudancas na UI (apos o Resultado do Mes)

A estrutura atual e:

```text
RESULTADO DO MES
DESTINACOES E UTILIZACOES (tudo misturado)
RESGATES (separado)
SALDO FINAL
```

Vai mudar para:

```text
RESULTADO DO MES = R$ XX.XXX

═══ FLUXO DE CAIXA ═══════════════════════════

  Saldo Inicial                    R$ 57.530,31
  (+) Resultado do Mes             R$ XX.XXX,XX
                                   ────────────
  = Disponivel antes de movim.     R$ XX.XXX,XX

  SAIDAS DE CAIXA (nao sao despesas do mes):
  ┌──────────────────────────────────────────────┐
  │  21-LUCROS (distribuicao socios)             │
  │    Flavia Baggio        R$ 7.993,91          │
  │    Liliane Patricia     R$ 7.993,91          │
  │    Rafaela Garcia       R$ 7.993,91          │
  │    Subtotal             R$ 23.981,73         │
  │                                              │
  │  22-COMISSOES EXT                            │
  │    ...                  R$ 14.673,52         │
  │                                              │
  │  23-DESP MES ANT                             │
  │    ...                  R$ 25.116,53         │
  │                                              │
  │  TOTAL SAIDAS           R$ 63.771,78         │
  └──────────────────────────────────────────────┘

  ENTRADAS DE CAIXA (nao sao receitas do mes):
  ┌──────────────────────────────────────────────┐
  │  97-TERCEIROS (repasses recebidos)           │
  │    ...                  R$ X.XXX,XX          │
  │                                              │
  │  98-RESGATE (resgate aplicacoes)             │
  │    Resgate 16/01        R$ 2.000,00          │
  │    Resgate 21/01        R$ 16.200,00         │
  │    Resgate 21/01        R$ 2.220,00          │
  │    Subtotal             R$ 20.420,00         │
  │                                              │
  │  TOTAL ENTRADAS         R$ XX.XXX,XX         │
  └──────────────────────────────────────────────┘

  RESUMO DO FLUXO:
  ╔══════════════════════════════════════════════╗
  ║  Saldo Inicial              R$ 57.530,31    ║
  ║  (+) Resultado do Mes       R$ XX.XXX,XX    ║
  ║  (-) Saidas de Caixa        R$ 63.771,78    ║
  ║  (+) Entradas de Caixa      R$ XX.XXX,XX    ║
  ║  ════════════════════════════════════════    ║
  ║  = SALDO FINAL LIVRE        R$ XX.XXX,XX    ║
  ╚══════════════════════════════════════════════╝

  Saldo por Banco:
  ┌─────────────────────────────────────────────┐
  │  EDUZZ    R$ 0,00                           │
  │  AZUL     R$ 0,00                           │
  │  INTER    R$ XX.XXX,XX                      │
  │  TOTAL    R$ XX.XXX,XX                      │
  └─────────────────────────────────────────────┘
```

---

### Detalhes Tecnicos

**Arquivo:** `src/components/DREFluxoCaixa.tsx`

1. **Separar destinacoes em saidas e entradas** no `useMemo`:
   - Saidas: custoNum 21-30 (distribuicoes, pagamentos externos, despesas anteriores)
   - Entradas: custoNum 97 (terceiros) e 98 (resgates)
   - Remover o bloco separado de "98-RESGATE" que existe hoje

2. **Calcular novos totais**:
   - `totalSaidasCaixa` = soma absoluta dos itens 21-30
   - `totalEntradasCaixa` = soma dos itens 97 + 98
   - `disponivelAntes` = saldoInicial + resultadoMes
   - `saldoFinalLivre` = disponivelAntes - totalSaidasCaixa + totalEntradasCaixa

3. **Substituir a UI** das secoes "DESTINACOES", "RESGATES" e "SALDO FINAL" por uma unica secao "FLUXO DE CAIXA" com:
   - Card verde: Saidas de Caixa (cada centro de custo colapsavel, cor vermelha)
   - Card azul: Entradas de Caixa (cada centro de custo colapsavel, cor verde)
   - Card destaque: Resumo do Fluxo (saldo inicial + resultado - saidas + entradas = saldo final)
   - Card saldo por banco (mantido como esta)

4. **Atualizar o PDF** na secao de Fluxo de Caixa para seguir a mesma logica: separar saidas e entradas, mostrar resumo claro.

---

### Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/DREFluxoCaixa.tsx` | Separar destinacoes em saidas/entradas, novo bloco Fluxo de Caixa explicativo, atualizar PDF |

