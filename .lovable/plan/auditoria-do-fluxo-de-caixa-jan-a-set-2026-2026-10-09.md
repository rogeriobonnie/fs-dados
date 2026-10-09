# Auditoria do Fluxo de Caixa (jan a set/2026)

## Conclusão

Os saldos finais estão **corretos**: julho 40.591,13, agosto 88.827,31, setembro 75.240,75. Eles batem com a planilha filtrando EDUZZ + AZUL + INTER, e nada se perde de um mês para o outro.

O que não bate é a **conta exibida na tela** (Saldo Inicial + Entradas - Saídas). Isso acontece porque o painel mostra todo valor de Entradas como positivo e todo valor de Saídas como negativo, mesmo quando a linha na planilha tem o sinal ao contrário (estorno ou devolução). De janeiro a junho não há nenhuma linha assim, e por isso esses meses fecham certinho.

## Linhas exatas que causam a diferença

**Julho (diferença de +5.898,56)**
- 19/07 | 01-CURSOS | Clube de Estudos – Lilian Naddeo | EDUZZ | **-13,33** (aparece como entrada de +13,33)
- 01/07 | 25-MENTORIAS | Flavia Baggio Nerbass | INTER | **+200,00** (aparece como saída de -200,00)
- 08/07 | 25-MENTORIAS | Vivien Schmeling Piccin | INTER | **+87,61** (aparece como saída)
- 08/07 | 25-MENTORIAS | Clinica Respirarte Ltda | INTER | **+2.675,00** (aparece como saída)

**Agosto (diferença de -13.056,00)**
- 05/08 | 01-CURSOS | Turma V – Daniela De Oliveira Lemos | INTER | **-3.450,00** (aparece como entrada)
- 07/08 | 01-CURSOS | Turma V – Jessica Felipe Dos Santos | INTER | **-778,00** (aparece como entrada)
- 07/08 | 01-CURSOS | Turma V – Rafael Almeida De Melo | INTER | **-2.300,00** (aparece como entrada)

**Setembro (diferença de +1.914,00)**
- 10/09 | 01-CURSOS | Turma V – Rejane Cândida Andrade (DESIST) | EDUZZ | **-778,00** (aparece como entrada, impacto de -1.556,00)
- Mateus Bramusse | INTER | **+3.470,00**: o centro de custo está escrito só "MENTORIA", sem o número. Por isso o painel não sabe em que lista colocar. A linha entra no saldo do banco, mas não aparece em Entradas (+3.470,00).
- +3.470,00 - 1.556,00 = +1.914,00

## Opção de ajuste no painel (só se você aprovar)

Somar Entradas e Saídas pelo sinal real de cada linha. Assim:
- um estorno negativo em 01-CURSOS diminui as Entradas;
- um valor positivo em 25-MENTORIAS diminui as Saídas;
- linhas com centro de custo sem número aparecem em um grupo "Sem centro de custo".

Com isso, Saldo Inicial + Entradas - Saídas passa a fechar sempre com o saldo dos bancos. Os saldos finais não mudam.
