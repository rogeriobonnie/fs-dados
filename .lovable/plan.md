# Visão Geral FS Turma 04

Nova sub-aba **Visão Geral** dentro de FS Turma IV (primeira sub-aba, antes de Resumo Gerencial), reunindo os três blocos de informação hoje espalhados: contratos (Página1), recebimentos ago–dez/2025 (Página2) e resultado por curso do semestre 2026/1 (Página5).

## Bloco 1 — Contratos (Página1)

Painel único, sem cards clicáveis, com:

- Receita total contratada
- Valores recebidos
- Valores pendentes (a pagar em dia)
- Valores vencidos
- Total de alunos
- Alunos em distrato (coluna P = SIM) e valor perdido (aberto) / já recebido deles
- Alunos em atraso e valor vencido
- Alunos já quitados e total quitado

Os números usam a mesma base já aprovada nos relatórios de inadimplência (status coluna M, distrato coluna P, valor = venda + juros − taxas), então batem com as outras sub-abas.

## Bloco 2 — Recebimentos ago–dez/2025 (Página2)

Tabela mês a mês (Ago, Set, Out, Nov, Dez e Total) das linhas de entrada cuja descrição (coluna B) identifica a Turma 04 (variações "TURMA IV", "TURMA 04", "FS TURMA IV", normalizadas sem acento):

| Mês | Receita bruta | Impostos/Taxas | Com. vendedores | Com. Lance a Dois | Receita líquida |

- Impostos/taxas e comissões (vendedores e Lance a Dois) da Página2 não vêm marcados por turma, então são **rateados proporcionalmente**: peso = receita bruta da Turma 04 no mês ÷ receita bruta total de entradas do mês.
- Cada célula rateada é clicável e mostra o detalhamento dos lançamentos do mês que formaram o rateio (data, descrição, valor, peso aplicado).
- Rodapé com o total do período e o percentual médio de dedução.

## Bloco 3 — Resultado 2026/1 (Página5)

Reaproveita o cálculo já existente do Resultado por Curso semestral, exibindo a linha da Turma IV com receita bruta, taxas, impostos, comissões, despesas diretas (coluna S) e rateio, terminando em resultado do semestre.

## Bloco 4 — Consolidado

Quadro final somando: total contratado, recebido até hoje (Página1), líquido apurado em 2025 (Página2), resultado 2026/1 (Página5) e a posição em aberto/perdida da turma.

## PDF

Exportação A4 colorida, no mesmo padrão dos relatórios existentes: capa com identificação da turma, uma seção por bloco, tabelas com zebra e subtotais, sem tabelas cortadas ao meio, paginação "Página X de Y".

## Detalhes técnicos

- Novo `src/components/VisaoGeralTurma.tsx`, recebendo os registros da Página1 já carregados no `Index.tsx` e buscando Página2 (`fetchDREData`) e Página5 (`fetchPagina5Data`) internamente.
- Novo `src/utils/visaoGeralTurmaPdf.ts` com `jspdf` + `jspdf-autotable`.
- Novo util `src/utils/turma04Pagina2.ts` com a identificação por coluna B, o rateio proporcional de impostos/comissões por mês e o detalhamento por lançamento — reutilizável e testável.
- Reaproveitamento do cálculo semestral existente (extração da parte de cálculo de `SemestralResultadoCursos.tsx` para um util compartilhado, sem mudar a aba atual).
- `src/pages/Index.tsx`: adiciona a sub-aba e passa a usá-la como padrão em FS Turma IV.
- Nenhuma mudança de parser ou de planilha.
