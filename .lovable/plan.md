## Plano: Separar status "DISTRATO" e "EM NEGOCIAÇÃO" em nova aba

### 1. Reconhecer os novos status na origem dos dados
- `src/types/financial.ts`: ampliar união do `status` para `'PAGO' | 'A PAGAR' | 'VENCIDO' | 'DISTRATO' | 'EM NEGOCIACAO'`.
- `src/services/googleSheetsService.ts` (`parseStatus`, ~linha 764): normalizar string (uppercase + remover acentos) e devolver `DISTRATO` se contiver "DISTRATO" e `EM NEGOCIACAO` se contiver "NEGOCIA". Não promover a `VENCIDO` quando o status original for um desses dois.

### 2. Excluir esses status da aba "Alunos" (e abas afins)
- Em `src/pages/Index.tsx`, ao montar o dataset que alimenta `StudentsDirectory`, `MonthlyRevenue` e `FinancialTable` da Turma IV, filtrar fora registros cujo `status` seja `DISTRATO` ou `EM NEGOCIACAO`. Manter o `data` bruto para a nova aba.
- Os dashboards/summary (`FinancialDashboard`) também passam a usar o conjunto filtrado, para não inflar previsão com valores perdidos/incertos.

### 3. Nova aba "Distratos & Negociação"
- Adicionar `TabsTrigger value="distratos"` no `Tabs` interno do `fs-turma` (ajustar `grid-cols-3` → `grid-cols-4`), com ícone `UserX` do lucide.
- Novo componente `src/components/DistratosNegociacao.tsx`:
  - Recebe `data: FinancialRecord[]` (dataset completo, sem o filtro acima).
  - Filtra apenas registros com status `DISTRATO` ou `EM NEGOCIACAO`.
  - **Cards de resumo** (separados em duas seções: Distrato / Em Negociação):
    - Nº de alunos únicos
    - Total contratado (Σ amount de todas parcelas do aluno)
    - Total já recebido (Σ amount das parcelas com `status = PAGO` do mesmo aluno — buscar nas demais parcelas do aluno no dataset completo)
    - Total **deixou de receber / previsão perdida** = contratado − recebido
  - **Tabela de alunos** agrupando por `studentName`, colunas: Aluno, Consultora, Status, Parcelas (pagas/total), Valor contratado, Recebido, A perder/previsão, Data do contrato.
  - Linha clicável abre `StudentDetailModal` existente (reaproveitar) para ver as parcelas.
  - Toggle/segment para alternar entre "Distrato", "Em Negociação" e "Ambos".

### 4. Detalhes de cálculo
- "Recebido" considera todas as parcelas do aluno (mesmo as com status normal) já pagas — útil quando o distrato ocorre no meio do contrato.
- "Previsão (deixou de receber)" = soma das parcelas com status `DISTRATO`, `EM NEGOCIACAO`, `A PAGAR` ou `VENCIDO` desse aluno.

### Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/types/financial.ts` | Ampliar união de `status` |
| `src/services/googleSheetsService.ts` | `parseStatus` reconhece DISTRATO e EM NEGOCIAÇÃO |
| `src/pages/Index.tsx` | Filtrar status na aba Alunos + adicionar nova TabsTrigger/Content |
| `src/components/DistratosNegociacao.tsx` | Novo componente (resumo + tabela + modal) |
