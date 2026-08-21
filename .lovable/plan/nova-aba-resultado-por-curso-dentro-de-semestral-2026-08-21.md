# Nova aba "Resultado por Curso" dentro de Semestral

A aba Semestral atual vira uma sub-aba ("Fluxo de Caixa") e ganha ao lado uma nova sub-aba com a análise gerencial por curso do semestre (padrão 2026/1).

## Estrutura da nova análise

### 1. Bloco principal — Cursos (01-CURSOS, exceto Turma III e IV)
Somente receitas do centro 01-CURSOS. Linhas cuja descrição (coluna B) contém "TURMA III" ou "TURMA IV" ficam fora deste bloco (são recebimentos, não vendas novas).

Colunas por curso, ordenados da maior para a menor receita bruta:

- Valor bruto, Quantidade vendida, Valor médio
- Deduções já existentes por linha: Taxas, Impostos, Comissão vendedor, Comissão MKT
- Rateio de despesas (ver regras abaixo)
- Valor líquido e Resultado do curso

Ao clicar no nome do curso, abre a visualização mês a mês (Jan–Jun) daquele curso.
Botão de alternância de visualização: **Lista** (padrão) ou **Meses em colunas** — matriz com todos os cursos nas linhas e Jan…Jun + Total nas colunas.

### 2. Regras de rateio das despesas

| Despesa | Tratamento |
|---|---|
| 11 Administrativo, 12 Marketing, 14 Plataformas, 17 Congresso, 18 Desp. Cursos | Rateio proporcional à receita bruta de cada curso |
| 13 Vendas | Excluída (comissões já aparecem por curso) |
| 15 Cursos — "hands on" | Vai para Turma IV; fora da análise principal |
| 15 Cursos — com nome de curso na coluna S | Despesa direta daquele curso |
| 15 Cursos — sem nome na coluna S | Rateio proporcional entre os cursos |

### 3. Blocos complementares (mesma estrutura de colunas)
- **Recebimentos Turma III e Turma IV** (inclui a despesa 15 "hands on" abatendo a Turma IV)
- **Outras receitas**: patrocínios, exames, comissões e demais centros de entrada

Na última coluna de cada bloco: valor líquido e resultado. Ao final, uma linha consolidada com o **Resultado do semestre**.

## PDF

Exportação A4 colorida com capa/cabeçalho do semestre, uma seção por bloco (Cursos, Turma III/IV, Outras receitas), tabela de rateio, quadro consolidado final e paginação "Página X de Y" — no padrão visual dos relatórios já existentes, pronto para reunião de alinhamento.

## Detalhes técnicos

- `src/components/SemestralPainel.tsx`: passa a ter `Tabs` internas — "Fluxo de Caixa" (conteúdo atual, sem alterações) e "Resultado por Curso" (novo).
- Novo componente `src/components/SemestralResultadoCursos.tsx` com o cálculo por curso, rateio, alternância lista/matriz e detalhamento mensal.
- Novo `src/utils/semestralCursosPdf.ts` com `jspdf` + `jspdf-autotable`.
- Agrupamento por descrição normalizada (sem acentos, maiúsculas); Turma III/IV detectadas pela coluna B; coluna S (`evento`) usada para vincular despesas 15 a um curso.
- Rateio: peso = receita bruta do curso ÷ receita bruta total dos cursos rateáveis.

## Arquivos afetados

- `src/components/SemestralPainel.tsx` (sub-abas)
- `src/components/SemestralResultadoCursos.tsx` (novo)
- `src/utils/semestralCursosPdf.ts` (novo)
