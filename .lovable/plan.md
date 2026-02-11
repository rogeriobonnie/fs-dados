

## Nova Aba "Painel Financeiro" com DRE + Fluxo de Caixa (Página5)

### Visao Geral

Criar uma nova aba principal ao lado de "FS Turma IV" e "Demonstrações" chamada **"Painel Financeiro"** que consome dados da **Página5** da planilha Google Sheets. Essa aba unifica DRE e Fluxo de Caixa em uma unica visao, com sub-abas para comissoes e cursos de terceiros.

A aba "Demonstrações" existente sera mantida intacta.

---

### Estrutura da Página5 (Colunas)

| Coluna | Campo | Uso |
|--------|-------|-----|
| A | DATA | Filtro mes/ano (DD/MM/YY) |
| B | DESCRICAO | Nome do curso/despesa |
| C | DETALHAMENTO | Aluno/detalhe |
| D | CUSTO | Centro de custo (agrupador principal) |
| E | VALOR BRUTO | Valor bruto |
| F | TAXAS | Taxas a abater |
| G | ACRESCIMOS | Acrescimos a somar |
| H | VALOR LIQUIDO | Resultado liquido |
| I | BANCO | EDUZZ, AZUL, INTER, PROVISAO |
| J | IMP ALIQ | Aliquota imposto (ex: 13,24%) |
| K | VR IMPOSTO | Valor do imposto |
| L | VENDEDOR | Nome do vendedor |
| M | VR VENDEDOR | Valor comissao vendedor |
| N | MKT | Intermediador MKT |
| O | VR MKT | Valor comissao MKT |

### Centros de Custo Identificados

| Codigo | Tipo | Descricao |
|--------|------|-----------|
| 0-SALDO INICIAL | Saldo | Disponibilidade inicio do mes |
| 01-CURSOS | Receita | Cursos proprios |
| 05-COMISSAO | Receita | Comissoes recebidas |
| 08-TERCEIROS | Receita | Cursos de terceiros |
| 11 a 20 | Despesa | Despesas operacionais |
| 21-LUCROS | Destinacao | Distribuicao aos socios |
| 22-COMISSOES EXT | Destinacao | Pagamento cursos externos |
| 23-DESP MES ANT | Destinacao | Despesas mes anterior |
| 98-RESGATE | Resgate | Resgate de aplicacoes |
| 99-TRANSFER | Transferencia | Transferencias internas entre bancos |

---

### Arquitetura de Abas

```text
Tabs Principais:
┌──────────────┬────────────────┬──────────────────┐
│  FS Turma IV │  Demonstrações │ Painel Financeiro│  <-- NOVA
└──────────────┴────────────────┴──────────────────┘

Dentro de "Painel Financeiro":
┌─────────────────┬─────────────┬──────────────────┐
│  DRE + Fluxo    │  Comissões  │ Cursos Terceiros │
└─────────────────┴─────────────┴──────────────────┘
```

---

### PARTE 1: GoogleSheetsService - Novo Metodo

**Arquivo:** `src/services/googleSheetsService.ts`

Adicionar metodo `fetchPagina5Data()`:

```typescript
static async fetchPagina5Data(): Promise<any[]> {
  // Fetch Página5!A:O
  // Parse cada linha retornando:
  // { date, descricao, detalhamento, custo, valorBruto, taxas,
  //   acrescimos, valorLiquido, banco, impAliq, vrImposto,
  //   vendedor, vrVendedor, mkt, vrMkt, month, year }
}
```

- Pular linha 1 (totais) e linha 2 (cabecalho)
- Parsear datas no formato DD/MM/YY (2 digitos de ano, interpretar como 20XX)
- Parsear valores brasileiros (virgula decimal, ponto milhar)

---

### PARTE 2: Componente Principal "PainelFinanceiro.tsx"

**Novo arquivo:** `src/components/PainelFinanceiro.tsx`

Componente principal com:
- Filtro de Mes/Ano
- Sub-abas internas: "DRE + Fluxo", "Comissoes", "Cursos Terceiros"
- Carrega dados da Página5 uma vez e passa para sub-componentes

---

### PARTE 3: Sub-componente "DREFluxoCaixa.tsx"

**Novo arquivo:** `src/components/DREFluxoCaixa.tsx`

Layout da tela:

```text
╔══════════════════════════════════════════════════════════════════╗
║  DRE + FLUXO DE CAIXA              [Filtro: Janeiro ▼ 2026 ▼]  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  ┌─ SALDO INICIAL ─────────────────────────────────────────────┐ ║
║  │  EDUZZ    R$ 11.355,99                                      │ ║
║  │  AZUL     R$    778,83                                      │ ║
║  │  INTER    R$ 45.395,49                                      │ ║
║  │  TOTAL    R$ 57.530,31                                      │ ║
║  └─────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ═══ RECEITAS (DRE) ═══════════════════════════════════════════  ║
║                                                                  ║
║  ┌─ 01-CURSOS (colapsavel) ────────────────────────────────────┐ ║
║  │  ▼ CLUBE DE ESTUDOS                                         │ ║
║  │    Bruto: R$ 1.565,15 | Taxas: R$ 69,23 | Acresc: R$ 0     │ ║
║  │    Liquido: R$ 1.495,92 | Imposto: R$ 207,22               │ ║
║  │    [ver vendas individuais]                                  │ ║
║  │                                                              │ ║
║  │  ▼ TURMA IV                                                  │ ║
║  │    Bruto: R$ 10.XXX | Taxas: R$ XXX | ...                   │ ║
║  │    [ver vendas individuais]                                  │ ║
║  │                                                              │ ║
║  │  ... outros cursos ...                                       │ ║
║  │                                                              │ ║
║  │  TOTAL CURSOS  Bruto: R$ XX  Liquido: R$ XX                 │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ┌─ 05-COMISSAO ────────────────────────────────────────────────┐ ║
║  │  VIVIEN SCHMELING      R$ 169,37   INTER                    │ ║
║  │  TRINO EDUCACAO        R$ 755,47   INTER                    │ ║
║  │  RAFAELA GARCIA...     R$ 219,24   INTER                    │ ║
║  │  TOTAL COMISSOES       R$ 1.144,08                          │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ═══ TOTAL RECEITAS:  R$ XX.XXX,XX ════════════════════════════  ║
║                                                                  ║
║  ═══ DESPESAS (DRE) ═══════════════════════════════════════════  ║
║                                                                  ║
║  ┌─ 11-ADMINISTRATIVO ─────────────────────────────────────────┐ ║
║  │  Salario Stella         R$ 578,50                           │ ║
║  │  Certificado Digital    R$  98,60                           │ ║
║  │  ...                                                        │ ║
║  │  TOTAL                  R$ 2.424,39                         │ ║
║  └─────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ┌─ 12-MARKETING ──────────────────────────────────────────────┐ ║
║  │  Lance a Dois Ltda     R$ 3.000,00                          │ ║
║  │  Facebook              R$ 2.000,00                          │ ║
║  │  TOTAL                 R$ 5.000,00                          │ ║
║  └─────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ┌─ 13-VENDAS ──────────────────────────────────────────────────┐ ║
║  │  Stella    Comissao Vendas  R$ 1.864,22                     │ ║
║  │  Lance a Dois  Comissao    R$ 4.726,77                      │ ║
║  │  Stephanie Comissao        R$   222,38                      │ ║
║  │  TOTAL                     R$ 6.813,37                      │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ... 14-PLATAFORMAS, 15-CURSOS, 18-DESP CURSOS ...              ║
║                                                                  ║
║  ═══ TOTAL DESPESAS: R$ XX.XXX,XX ═════════════════════════════  ║
║                                                                  ║
║  ╔══════════════════════════════════════════════════════════════╗ ║
║  ║  RESULTADO DRE = RECEITAS - DESPESAS = R$ XX.XXX,XX        ║ ║
║  ╚══════════════════════════════════════════════════════════════╝ ║
║                                                                  ║
║  ═══ DESTINACOES E UTILIZACOES (21-30) ════════════════════════  ║
║                                                                  ║
║  ┌─ 21-LUCROS ──────────────────────────────────────────────────┐ ║
║  │  Flavia Baggio      R$ 7.993,91                             │ ║
║  │  Liliane Patricia   R$ 7.993,91                             │ ║
║  │  Rafaela Garcia     R$ 7.993,91                             │ ║
║  │  TOTAL              R$ 23.981,73                            │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ┌─ 22-COMISSOES EXT ──────────────────────────────────────────┐ ║
║  │  Lance a Dois  Curso MKT         R$ 1.702,23               │ ║
║  │  Liliane       Curso REAB        R$ 12.546,95              │ ║
║  │  Aterpo        Curso Sono Inf.   R$ 424,34                 │ ║
║  │  TOTAL                           R$ 14.673,52              │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ┌─ 23-DESP MES ANT ──────────────────────────────────────────┐ ║
║  │  GPS                 R$ 591,91                              │ ║
║  │  DAS Simples (2x)    R$ 24.524,62                           │ ║
║  │  TOTAL               R$ 25.116,53                           │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ┌─ 98-RESGATE ────────────────────────────────────────────────┐ ║
║  │  Resgate 16/01        R$ 2.000,00                           │ ║
║  │  Resgate 21/01        R$ 16.200,00                          │ ║
║  │  Resgate 21/01        R$ 2.220,00                           │ ║
║  │  TOTAL                R$ 20.420,00                          │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                  ║
║  ═══ FLUXO DE CAIXA ══════════════════════════════════════════  ║
║                                                                  ║
║  ┌───────────────────┬──────────┬──────────┬──────────┬────────┐ ║
║  │                   │  EDUZZ   │   AZUL   │  INTER   │ TOTAL  │ ║
║  ├───────────────────┼──────────┼──────────┼──────────┼────────┤ ║
║  │ Saldo Inicial     │ 11.355   │    778   │ 45.395   │ 57.530 │ ║
║  │ (+) Receitas      │ XX.XXX   │  X.XXX   │  X.XXX   │ XX.XXX │ ║
║  │ (-) Despesas      │      0   │      0   │ -XX.XXX  │-XX.XXX │ ║
║  │ (-) Destinacoes   │      0   │      0   │ -XX.XXX  │-XX.XXX │ ║
║  │ (+) Resgates      │      0   │      0   │ 20.420   │ 20.420 │ ║
║  │ (=) Transferencias│-28.332   │ -12.900  │ 41.232   │     0  │ ║
║  ├───────────────────┼──────────┼──────────┼──────────┼────────┤ ║
║  │ SALDO FINAL       │  X.XXX   │  X.XXX   │ XX.XXX   │ XX.XXX │ ║
║  └───────────────────┴──────────┴──────────┴──────────┴────────┘ ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

### PARTE 4: Sub-componente "ComissoesPainel.tsx"

**Novo arquivo:** `src/components/ComissoesPainel.tsx`

Exibe detalhamento das comissoes de vendas extraidas das colunas L/M/N/O dos registros 01-CURSOS e 08-TERCEIROS:

- Agrupa por vendedor (coluna L) mostrando valor vendedor (coluna M)
- Agrupa por MKT (coluna N) mostrando valor MKT (coluna O)
- Mostra totais de comissoes a pagar vs comissoes pagas (cruzando com 13-VENDAS)

---

### PARTE 5: Sub-componente "CursosTerceiros.tsx"

**Novo arquivo:** `src/components/CursosTerceiros.tsx`

Filtra registros onde custo = "08-TERCEIROS" e aplica a mesma logica de detalhamento por curso:

- Agrupa por nome do curso (coluna B)
- Para cada curso: bruto, taxas, acrescimos, liquido, imposto, comissao vendedor, comissao MKT
- Valor final = liquido - imposto - comissao vendedor - comissao MKT
- PDF individual por curso de terceiro

---

### PARTE 6: Atualizar Index.tsx

**Arquivo:** `src/pages/Index.tsx`

Adicionar terceira aba principal:

```text
┌──────────────┬────────────────┬──────────────────┐
│  FS Turma IV │  Demonstrações │ Painel Financeiro│
└──────────────┴────────────────┴──────────────────┘
```

Alterar `grid-cols-2` para `grid-cols-3` na TabsList principal.

---

### PARTE 7: Recursos Extras

- **PDF da DRE completa**: botao para gerar PDF consolidado com DRE + Fluxo de Caixa
- **Graficos resumo**: cards visuais no topo com receita total, despesa total, resultado e saldo final
- **Indicadores coloridos**: verde para resultado positivo, vermelho para negativo
- **Banco PROVISAO**: despesas com banco = "PROVISAO" aparecem na DRE mas NAO saem do fluxo de caixa (marcadas visualmente como "pendentes")
- **Transferencias (99-TRANSFER)**: aparecem no fluxo de caixa como movimentacao entre bancos mas NAO afetam resultado DRE (soma zero entre bancos)

---

### Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/services/googleSheetsService.ts` | Adicionar `fetchPagina5Data()` |
| `src/components/PainelFinanceiro.tsx` | **CRIAR** - componente container com filtros e sub-abas |
| `src/components/DREFluxoCaixa.tsx` | **CRIAR** - DRE + Fluxo de Caixa integrados |
| `src/components/ComissoesPainel.tsx` | **CRIAR** - detalhamento de comissoes |
| `src/components/CursosTerceiros.tsx` | **CRIAR** - cursos de terceiros (08-TERCEIROS) |
| `src/pages/Index.tsx` | Adicionar aba "Painel Financeiro" |

---

### Logica de Calculo

**DRE:**
```text
RECEITA BRUTA = Sum(01-CURSOS bruto) + Sum(05-COMISSAO bruto) + Sum(08-TERCEIROS bruto)
(-) TAXAS = Sum(taxas de todos)
(+) ACRESCIMOS = Sum(acrescimos de todos)
= RECEITA LIQUIDA
(-) IMPOSTOS = Sum(vr_imposto de todos)
= RECEITA LIQUIDA POS IMPOSTO
(-) DESPESAS (11 a 20) = Sum(todos gastos 11-20)
= RESULTADO OPERACIONAL
```

**Fluxo de Caixa (por banco):**
```text
SALDO INICIAL (0-SALDO INICIAL por banco)
(+) Receitas do mes (01-CURSOS + 05-COMISSAO + 08-TERCEIROS por banco)
(-) Despesas do mes (11 a 20 por banco, exceto PROVISAO)
(-) Destinacoes (21 a 30 por banco)
(+) Resgates (98-RESGATE por banco)
(+-) Transferencias (99-TRANSFER por banco, soma zero no total)
= SALDO FINAL
```

**Banco PROVISAO:**
- Entra na DRE como despesa do mes
- NAO sai do fluxo de caixa (ainda nao foi pago)
- Marcado visualmente como "A Pagar"

