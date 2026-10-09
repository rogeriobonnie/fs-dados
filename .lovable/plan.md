# Auditoria do Fluxo de Caixa (jan a set/2026)

Conta conferida: Saldo Inicial + Entradas - Saídas = Saldo Final (bancos)

| Mês | Saldo Inicial | Entradas | Saídas | Conta | Saldo Final | Diferença |
|---|---|---|---|---|---|---|
| Jan | 57.530,31 | 94.369,01 | 120.513,44 | 31.385,88 | 31.385,88 | 0 |
| Fev | 31.385,88 | 29.991,74 | 36.015,73 | 25.361,89 | 25.361,89 | 0 |
| Mar | 25.361,89 | 81.251,92 | 63.779,39 | 42.834,42 | 42.834,42 | 0 |
| Abr | 42.834,42 | 65.964,39 | 87.449,39 | 21.349,42 | 21.349,42 | 0 |
| Mai | 21.349,42 | 94.437,75 | 66.998,27 | 48.788,90 | 48.788,90 | 0 |
| Jun | 48.788,90 | 193.223,42 | 199.411,84 | 42.600,48 | 42.600,48 | 0 |
| Jul | 42.600,48 | 121.492,05 | 129.399,96 | 34.692,57 | 40.591,13 | +5.898,56 |
| Ago | 40.591,13 | 121.693,38 | 60.401,20 | 101.883,31 | 88.827,31 | -13.056,00 |
| Set | 88.827,31 | 96.687,92 | 112.188,48 | 73.326,75 | 75.240,75 | +1.914,00 |

De janeiro a junho fecha certinho. O saldo inicial de cada mês agora é igual ao saldo final do mês anterior.

## O que acontece em julho, agosto e setembro

**1. Valores com o sinal trocado na planilha (causa principal)**

O painel soma as entradas sempre como positivas e as saídas sempre como negativas, sem olhar o sinal de cada linha. O saldo dos bancos usa o sinal que está na planilha. Quando uma linha vem com o sinal ao contrário, as duas contas se separam:

- **Julho (+5.898,56):** em 25-MENTORIAS (saída), algumas linhas estão **positivas** (200,00 / 87,61 / 2.675,00 ...). Em 01-CURSOS, "CLUBE DE ESTUDOS" está **negativo** (-13,33).
- **Agosto (-13.056,00):** em 01-CURSOS, linhas "TURMA V" estão **negativas** (-3.450,00 / -778,00 / -2.300,00 ...). Podem ser estornos ou devoluções, mas o painel mostra como se fossem entradas.
- **Setembro:** mais uma "TURMA V" negativa de -778,00 em 01-CURSOS (impacto de -1.556,00 na conta).

**2. Linha sem centro de custo (setembro)**

- "XXXXXXX – Mateus Bramusse" (INTER, R$ 3.470,00) está com a coluna de centro de custo vazia. Ela entra no saldo do banco, mas não aparece em Entradas nem em Saídas.
- Conferência de setembro: +3.470,00 - 1.556,00 = +1.914,00.

## Como corrigir (escolha uma opção)

- **Na planilha:** corrigir o sinal dessas linhas (ou trocar o centro de custo, se forem estornos) e preencher o centro de custo da linha de R$ 3.470,00.
- **No painel:** somar as linhas pelo sinal real. Uma linha negativa em 01-CURSOS reduziria as Entradas, e uma positiva em 25-MENTORIAS reduziria as Saídas. Também passaria a mostrar um grupo "Sem centro de custo". Assim a conta sempre fecharia com o saldo dos bancos.

Nada foi alterado por esta auditoria.
