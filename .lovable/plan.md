

## Plano: Ajustes no Painel Financeiro + PDFs para Todas as Abas

---

### 1. Codigo 97-TERCEIROS vai para Destinacoes

**Arquivo:** `src/components/DREFluxoCaixa.tsx` (linhas 31-42)

O filtro de destinacoes atualmente captura custoNum 21-30. Precisa incluir tambem 97:

```typescript
} else if ((r.custoNum >= 21 && r.custoNum <= 30) || r.custoNum === 97) {
  if (!destinacoes[r.custo]) destinacoes[r.custo] = [];
  destinacoes[r.custo].push(r);
}
```

Remover 97 das receitas (atualmente custoNum 1-10 ja nao captura 97, mas garantir).

**Arquivo:** `src/components/PainelFinanceiro.tsx` (linha 69) - Ajustar summary para nao contar 97 como receita (ja esta ok pois filtra 1-10).

**Arquivo:** `src/components/CursosTerceirosPainel.tsx` (linha 20) - Atualizar filtro para `r.custoNum === 97` em vez de `custoNum === 8` e buscar `97-TERCEIROS` em vez de `08-TERCEIROS`.

---

### 2. Fluxo de Caixa Simplificado (Sem Detalhamento, Apenas Saldo Final)

**Arquivo:** `src/components/DREFluxoCaixa.tsx` (linhas 405-473)

Substituir a tabela detalhada do fluxo de caixa por uma versao compacta que mostra apenas o saldo final por banco, similar ao bloco de saldo inicial. O calculo interno permanece o mesmo (saldo inicial + receitas - despesas - destinacoes + resgates + transferencias), mas a UI mostra apenas:

```text
┌─ SALDO FINAL ───────────────────────────────────┐
│  EDUZZ    R$ 0,00                                │
│  AZUL     R$ 0,00                                │
│  INTER    R$ XX.XXX,XX                           │
│  TOTAL    R$ XX.XXX,XX                           │
└──────────────────────────────────────────────────┘
```

**Bug das transferencias:** O codigo atual na linha 118 faz `b.transferencias += r.valorBruto`. O problema e que transferencias podem ter valores negativos (saida de um banco) e positivos (entrada em outro). Verificar se `valorBruto` ja vem com sinal correto da planilha. Se nao, ajustar para que transferencias negativas (saida) e positivas (entrada) sejam tratadas corretamente, garantindo que a EDUZZ zere quando soma saldo inicial + receitas + transferencias.

---

### 3. Aba Comissoes: Remover "Comissoes Pagas"

**Arquivo:** `src/components/ComissoesPainel.tsx` (linhas 20-23, 55, 60-79, 162-199)

- Remover o `useMemo` de `comissoesPagas` (linhas 20-23)
- Remover `totalPago` (linha 55)
- Remover o card "Total Pago (13-VENDAS)" dos summary cards (linhas 73-78)
- Remover toda a secao "Comissoes Pagas (Despesa 13-VENDAS)" (linhas 162-199)
- Ajustar grid dos summary cards de `grid-cols-3` para `grid-cols-2`

---

### 4. Aba Cursos Terceiros: Reorganizar Layout

**Arquivo:** `src/components/CursosTerceirosPainel.tsx`

Reorganizar o breakdown financeiro de cada curso para um fluxo vertical claro tipo demonstrativo:

```text
┌─ SONO INFANTIL ─────────────────────────────────┐
│                                                   │
│  RECEITA                                          │
│    Valor Bruto (5 vendas)         R$ 671,85       │
│    (-) Taxas de Plataforma        R$  34,50       │
│    (+) Acrescimos                 R$   0,00       │
│    ─────────────────────────────────────────       │
│    = Valor Liquido                R$ 637,35       │
│                                                   │
│  DEDUCOES                                         │
│    (-) Impostos                   R$  40,31       │
│    (-) Comissao Vendedor          R$  20,16       │
│    (-) Comissao MKT               R$   0,00       │
│    ─────────────────────────────────────────       │
│    = VALOR FINAL                  R$ 576,88       │
│                                                   │
│  [Tabela de vendas individuais expandivel]         │
└───────────────────────────────────────────────────┘
```

Usar uma tabela vertical estilo demonstrativo em vez do grid de cards atual.

---

### 5. DRE+Fluxo Receitas: Mostrar Abatimentos de Forma Clara

**Arquivo:** `src/components/DREFluxoCaixa.tsx` (linhas 195-262)

No `renderCourseBreakdown`, ao expandir um centro de custo de receita (01-CURSOS), mostrar os totais com breakdown claro:

```text
▼ 01-CURSOS
  Resumo do Centro de Custo:
  ┌──────────────────────────────────────────────┐
  │  Valor Bruto Total           R$ XX.XXX,XX    │
  │  (-) Taxas                   R$  X.XXX,XX    │
  │  (+) Acrescimos              R$    XXX,XX    │
  │  = Valor Liquido             R$ XX.XXX,XX    │
  │  (-) Impostos                R$  X.XXX,XX    │
  │  (-) Comissoes Vendedores    R$  X.XXX,XX    │
  │  (-) Comissoes MKT           R$    XXX,XX    │
  │  = Resultado Liquido         R$ XX.XXX,XX    │
  └──────────────────────────────────────────────┘
  
  ▼ CLUBE DE ESTUDOS (12 vendas)    R$ 1.495,92
  ▼ TURMA IV (8 vendas)             R$ 10.XXX,XX
```

Adicionar totais de imposto, comissao vendedor e comissao MKT no resumo do centro de custo.

---

### 6. PDFs para Todas as Abas

Adicionar botao "Gerar PDF" em cada aba. Usar `jspdf` + `jspdf-autotable` (ja instalados).

#### 6.1 PDF DRE + Fluxo de Caixa
**Arquivo:** `src/components/DREFluxoCaixa.tsx`

- Cabecalho: "DRE e Fluxo de Caixa - [Mes/Ano]"
- Secao 1: Saldo Inicial por banco
- Secao 2: Receitas por centro de custo com totais
- Secao 3: Despesas por centro de custo com totais
- Secao 4: Resultado DRE
- Secao 5: Destinacoes e Utilizacoes
- Secao 6: Resgates
- Secao 7: Saldo Final por banco
- Quebras de pagina automaticas entre secoes grandes
- Receber `selectedMonth` e `selectedYear` como props

#### 6.2 PDF Comissoes
**Arquivo:** `src/components/ComissoesPainel.tsx`

- Cabecalho: "Relatorio de Comissoes - [Mes/Ano]"
- Tabela de comissoes por vendedor
- Tabela de comissoes por MKT
- Totais gerais
- Receber `selectedMonth` e `selectedYear` como props

#### 6.3 PDF Cursos Terceiros
**Arquivo:** `src/components/CursosTerceirosPainel.tsx`

- Cabecalho: "Cursos de Terceiros - [Mes/Ano]"
- Para cada curso: demonstrativo completo (bruto, taxas, liquido, impostos, comissoes, valor final)
- Tabela de vendas individuais por curso
- Totais consolidados
- Quebra de pagina entre cursos
- Receber `selectedMonth` e `selectedYear` como props

#### 6.4 Props de Mes/Ano
**Arquivo:** `src/components/PainelFinanceiro.tsx`

Passar `selectedMonth` e `selectedYear` para os 3 sub-componentes para uso nos PDFs:

```typescript
<DREFluxoCaixa data={filteredData} selectedMonth={selectedMonth} selectedYear={selectedYear} />
<ComissoesPainel data={filteredData} selectedMonth={selectedMonth} selectedYear={selectedYear} />
<CursosTerceiros data={filteredData} selectedMonth={selectedMonth} selectedYear={selectedYear} />
```

---

### Resumo de Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/components/DREFluxoCaixa.tsx` | 97-TERCEIROS em destinacoes, fluxo simplificado, receitas com abatimentos claros, PDF, props mes/ano |
| `src/components/ComissoesPainel.tsx` | Remover comissoes pagas, PDF, props mes/ano |
| `src/components/CursosTerceirosPainel.tsx` | custoNum 97, reorganizar layout demonstrativo, PDF, props mes/ano |
| `src/components/PainelFinanceiro.tsx` | Passar props mes/ano aos sub-componentes |

