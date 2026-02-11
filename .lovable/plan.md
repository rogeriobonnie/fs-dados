

## Plano: Corrigir Fluxo de Caixa para bater com Saldo dos Bancos

### Problema Identificado

O Fluxo de Caixa e a Tabela de Bancos calculam valores de formas diferentes, por isso nunca batem:

| Item | Fluxo de Caixa (errado) | Tabela de Bancos (correto) |
|------|------------------------|---------------------------|
| Saidas (21-30) | usa `valorBruto` | usa `valorLiquido` |
| Entradas (97-98) | usa `valorBruto` | usa `valorLiquido` |
| Transferencias (99) | IGNORA | Inclui no calculo |
| Resultado de Caixa | formula propria | receitas - despesas real |

### Solucao

Alinhar o Fluxo de Caixa com a mesma logica da tabela de bancos. Usar `valorLiquido` consistentemente e incluir transferencias.

### O que muda na tela

```text
FLUXO DE CAIXA
  Saldo Inicial                              R$ X
  (+) Resultado de Caixa                     R$ Y  (receitas valorLiquido - despesas valorLiquido)
  = Disponivel                               R$ X + Y
  (-) Saidas de Caixa                        R$ Z  (valorLiquido, nao valorBruto)
  (+) Entradas de Caixa                      R$ W  (valorLiquido, nao valorBruto)
  (+/-) Transferencias                       R$ T  (custoNum 99, soma liquida)
  = SALDO FINAL LIVRE                        R$ X + Y - Z + W + T  (= soma saldos finais bancos)
```

### Detalhes Tecnicos

Arquivo: `src/components/DREFluxoCaixa.tsx`

**1. Saidas de caixa (linha 128)**: trocar `valorBruto` por `valorLiquido`

```text
ANTES: totalSaidasCaixa += Math.abs(r.valorBruto)
DEPOIS: totalSaidasCaixa += Math.abs(r.valorLiquido)
```

**2. Entradas de caixa (linha 134)**: trocar `valorBruto` por `valorLiquido`

```text
ANTES: totalEntradasCaixa += Math.abs(r.valorBruto)
DEPOIS: totalEntradasCaixa += Math.abs(r.valorLiquido)
```

**3. Adicionar transferencias no calculo do fluxo (apos linha 135)**:

```text
totalTransferencias = soma de valorLiquido das transferencias (custoNum 99), ignorando banco PROVISAO
saldoFinalLivre = disponivelAntes - totalSaidasCaixa + totalEntradasCaixa + totalTransferencias
```

Obs: transferencias somam zero no total (saem de um banco e entram em outro), mas sao necessarias para a conta fechar corretamente caso haja arredondamentos.

**4. Exibir transferencias no resumo do fluxo (UI e PDF)** se o valor for diferente de zero.

**5. Manter `resultadoCaixa = totalLiquidoReceitas - totalDespesas`** -- isso ja esta alinhado com a tabela de bancos (ambos usam `valorLiquido` para receitas e despesas).

Resultado: o Saldo Final Livre vai bater exatamente com a soma dos saldos finais dos bancos.
