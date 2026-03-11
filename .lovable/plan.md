

## Plano: Redesign completo do Fluxo de Caixa com visão por banco

### O que muda
Substituir tudo abaixo do título "FLUXO DE CAIXA" (linhas 1029-1391 de `DREFluxoCaixa.tsx`) por uma nova estrutura com filtro por banco e visualização detalhada das movimentações.

### Nova estrutura

```text
═══ FLUXO DE CAIXA ═══

[Filtros: Todos | Banco1 | Banco2 | Banco3] (botões toggle)

┌─────────────────────────────────────────────────┐
│ Cards resumo (3 bancos + total)                 │
│ Saldo Inicial → Entradas → Saídas → Saldo Final│
│ Barra de progresso visual entradas vs saídas    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ MOVIMENTAÇÕES DO PERÍODO                        │
│ Tabela detalhada filtrada por banco selecionado │
│ Colunas: Data | Tipo | Descrição | Detalhe |    │
│          Entrada | Saída | Saldo Acum. | Banco  │
│ Cores: verde entradas, vermelho saídas          │
│ Agrupável por tipo (Receita/Despesa/Saída/etc)  │
│ Totalizadores por grupo                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ CONCILIAÇÃO BANCÁRIA (tabela atual melhorada)   │
│ Banco | SI | Receitas | Despesas | Saídas |     │
│        Entradas | Transf | Saldo Final          │
│ Com barras visuais proporcionais                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ RESUMO DO FLUXO (card colapsável existente,     │
│ mantido e melhorado)                            │
└─────────────────────────────────────────────────┘
```

### Detalhes da implementação

**1. Filtro por banco** (novo state `selectedBanco: string | null`)
- Botões clicáveis com os nomes dos bancos extraídos de `fluxoBancos`
- "Todos" como default; ao selecionar um banco, todas as seções filtram

**2. Cards de resumo por banco**
- Quando "Todos": 1 card por banco + card total consolidado
- Quando banco selecionado: card único maior com detalhamento
- Cada card mostra: Saldo Inicial, Total Entradas, Total Saídas, Saldo Final
- Progress bar visual mostrando proporção entradas/saídas

**3. Tabela de movimentações** (novo)
- Lista todas as transações do mês filtradas pelo banco selecionado
- Ordenadas por data cronológica
- Coluna "Saldo Acumulado" que vai somando a partir do saldo inicial
- Tipo indicado por badge colorido (Receita, Despesa, Saída Caixa, Entrada Caixa, Transferência)
- Subtotais por tipo quando expandido
- Quando "Todos": mostra coluna Banco; quando filtrado: oculta

**4. Conciliação bancária** (tabela existente melhorada)
- Expandir colunas para mostrar Receitas, Despesas, Saídas, Entradas e Transferências separadamente
- Adicionar barras visuais de proporção em cada célula
- Linha de total consolidado

**5. Resumo do fluxo** (manter card colapsável existente)

### Arquivo alterado
`src/components/DREFluxoCaixa.tsx` - linhas 1029-1391 (seção FLUXO DE CAIXA)

### Novos imports necessários
- `Filter` de lucide-react
- `Progress` de ui/progress (barra visual)

