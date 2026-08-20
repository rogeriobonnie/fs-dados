## Nova aba "Semestral" (2026/1) no Painel Financeiro

Criar uma visão gerencial semestral, posicionada **antes** da aba DRE + Fluxo, começando pelo semestre **2026/1** (jan–jun de 2026).

### O que a aba mostra

1. **Seletor de semestre** no topo (independente dos filtros de mês/ano do painel). Primeira opção: `2026/1`. A lista cresce automaticamente conforme surgirem novos semestres nos dados (2026/2, 2027/1, ...).
2. **Cards de topo**: Saldo Inicial do semestre, Total de Entradas, Total de Saídas, Saldo Final e Resultado do período.
3. **Fluxo de Caixa consolidado do semestre**, no mesmo estilo já aprovado da aba DRE + Fluxo:
   - Entradas por centro de custo (1–10 receitas, 96-Mentoria, 97/98 terceiros/resgates)
   - Saídas por centro de custo (11–20 despesas — com 15.x agrupado dentro de 15-CURSOS e subtotal; 21–30 destinações; provisões 31; 32; 33; investimentos 50; reservas 51/52)
   - Cada bloco expansível com o detalhamento das linhas (data, descrição, detalhamento, valor, banco)
4. **Quadro mês a mês** (Jan…Jun + Total): linha de Entradas, Saídas, Resultado do mês e Saldo acumulado — leitura gerencial rápida da evolução do semestre.
5. **Saldos por banco**: saldo inicial do semestre, movimentos e saldo final por banco, com total.
6. **Exportar PDF A4** do semestre, no mesmo layout/estilo dos PDFs já existentes.

### Regras de cálculo

- Saldo inicial do semestre = saldo inicial do 1º mês do semestre (centro 0), com transporte do mês anterior quando ausente, mesma lógica já usada hoje.
- Entradas/Saídas seguem exatamente as mesmas faixas de centro de custo e o uso de `valorLiquido` já aprovados no fluxo de caixa mensal.
- Banco "PAGO" continua excluído das despesas 11–20; "PROVISAO" continua fora do fluxo de caixa.
- Investimento XP (10%) permanece desligado por padrão, como hoje.
- A exclusão global de dados de 2026 vale para Histórico/Ranking; esta aba é a exceção explícita, pois é justamente sobre 2026/1.

### Detalhes técnicos

- Novo componente `src/components/SemestralPainel.tsx`, recebendo `allData` (todos os registros da Página5), sem depender do filtro mês/ano do painel.
- Lógica de agrupamento reaproveitada de `DREFluxoCaixa.tsx` (mesmas faixas de `custoNum`, mesmo tratamento de 15.x, PAGO e PROVISAO), aplicada sobre o conjunto de 6 meses.
- `src/components/PainelFinanceiro.tsx`: adicionar a aba "Semestral" como primeira da `TabsList` (grid passa a 6 colunas) e torná-la a aba padrão? — mantenho DRE + Fluxo como padrão, salvo pedido contrário.
- PDF via `jspdf` + `jspdf-autotable`, seguindo o padrão dos relatórios atuais.

### Arquivos afetados

- `src/components/SemestralPainel.tsx` (novo)
- `src/components/PainelFinanceiro.tsx` (nova aba)
