# Comissão Lance a Dois rateada por curso

## Objetivo

Hoje, na aba Comissões do Painel Financeiro, a comissão Lance a Dois aparece como um único valor no rodapé: 10% sobre (receita líquida LAD + despesas LAD do mês). Não há visão de quanto dessa comissão pertence a cada curso.

A ideia é ratear esse valor por curso e reaproveitar o mesmo cálculo na aba Semestral > Resultado por Curso, na coluna "Com. MKT (L2)".

## O que muda

### 1. Painel Financeiro > Comissões

Nova tabela "Comissão Lance a Dois por curso", logo abaixo do bloco de resultado da LAD:

| Curso | Receita bruta | Receita líquida | % do total | Comissão L2 |

- Considera apenas as linhas de receita com MKT = Lance a Dois (centros 01-10 e 97), agrupadas por descrição do curso.
- Peso do rateio = receita líquida LAD do curso / receita líquida LAD total do mês.
- Comissão do curso = peso x comissão total do mês (10% do resultado líquido LAD).
- Rodapé com o total, que sempre fecha exatamente com o valor único mostrado hoje.
- Se o resultado líquido for negativo (comissão zero ou negativa), a tabela mostra R$ 0,00 por curso.
- As despesas LAD do mês continuam entrando só no cálculo global (elas não têm curso), por isso o rateio delas acompanha a proporção de receita.

O mesmo detalhamento entra no PDF da Lance a Dois.

### 2. Semestral > Resultado por Curso

A coluna "Com. MKT (L2)" passa a usar esse rateio em vez de somar o campo `vrMkt` linha a linha:

- Para cada mês do semestre, calcula-se a comissão LAD do mês (10% do resultado líquido daquele mês) e faz-se o rateio por curso conforme acima.
- Soma-se os seis meses para chegar ao valor por curso no semestre.
- O total da coluna passa a bater com a soma das comissões LAD dos seis meses da aba Comissões.
- Cursos sem receita LAD ficam com zero.
- O Resultado por curso continua descontando essa coluna, então ele se ajusta automaticamente.
- O PDF do Resultado por Curso segue usando o mesmo valor.

## Detalhes técnicos

- Criar `src/utils/comissaoLadRateio.ts` com uma função que recebe os registros da Página 5 e devolve, por mês, a comissão LAD total e o rateio por curso (chave = descrição normalizada, sem acentos/maiúsculas).
- `ComissoesPainel.tsx` passa a consumir esse util no lugar do cálculo inline, garantindo um único ponto de verdade.
- `SemestralResultadoCursos.tsx` usa o mesmo util para preencher `comMkt` de cada linha, somando mês a mês; o texto de nota do rodapé é atualizado para explicar o rateio.
- Nenhuma alteração de dados ou de parser; tudo é cálculo em cima do que já é lido da planilha.
