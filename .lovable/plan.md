# Curso de Extensão: Turma IV + Turma V

A aba principal "FS Turma IV" passa a se chamar **Curso de Extensão**, com duas sub-abas de turma: **Turma V** (abre primeiro) e **Turma IV** (todo o conteúdo atual, sem mudanças).

## Estrutura nova

```text
Curso de Extensão
├── Turma V   (padrão)
│   ├── Dashboard + filtros (dados da planilha TURMA V)
│   ├── Resumo Gerencial  (padrão)
│   ├── Alunos
│   ├── Mensal
│   ├── Tabela
│   ├── Inadimplência
│   └── Distratos
└── Turma IV
    ├── Dashboard + filtros (dados da Página1)
    ├── Visão Geral (padrão)
    ├── Resumo Gerencial, Alunos, Mensal, Tabela, Inadimplência, Distratos
```

Cada turma tem seu próprio dashboard e seus próprios filtros, aplicados só aos dados daquela turma.

Turma V não terá a sub-aba "Visão Geral" (ela cruza Página2/Página5 com dados específicos da Turma 04).

## Dados da Turma V

A planilha tem a aba **TURMA V** com exatamente as mesmas colunas da Página1 (contratação, data da venda, alunos, cond. especial, forma de pgto, parcelas, vencimento, valor, taxas, juros, líquido, data pgto, status, NF, contrato, distrato?). Por isso todas as funções já existentes — status, distrato pela coluna P, condição especial pela coluna D, cálculos de recebido/pendente/vencido, relatórios e PDFs — funcionam sem alteração.

Observação: hoje a aba TURMA V tem vendas a partir de julho/2026, com parcelas indo até 2027; nada disso exige lógica nova.

## Detalhes técnicos

- `src/services/googleSheetsService.ts`: novo `fetchTurmaVData()` lendo `TURMA V!A:P` e reaproveitando o mesmo `parseSheetData` já usado na Página1.
- `src/pages/Index.tsx`:
  - renomeia o rótulo da aba para "Curso de Extensão";
  - carrega os dados da Turma V junto com os atuais (mesmo botão "Atualizar Dados");
  - extrai o conteúdo de turma para um componente reutilizável `src/components/TurmaPanel.tsx`, que recebe `data` + flag `showVisaoGeral` e contém dashboard, filtros e as sub-abas;
  - renderiza `<TurmaPanel>` duas vezes (Turma V sem Visão Geral e como aba padrão; Turma IV igual está hoje).
- Estado de filtros separado por turma (um `useState` por instância dentro de `TurmaPanel`).
- Nenhuma mudança nos componentes de relatório, PDFs ou nas demais abas (Demonstrações, Painel Financeiro, Histórico).
