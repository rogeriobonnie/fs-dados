

## Plano: Redesign completo do Fluxo de Caixa - Formato Extrato Compacto

### Visão geral

Substituir toda a seção "FLUXO DE CAIXA" (linhas 1029-1499) por um extrato contábil compacto e sequencial, sem cards de banco separados. Adicionar captura de custoNum 50, 51, 52 nos dados agrupados.

### Nova estrutura visual

```text
═══ FLUXO DE CAIXA ═══

┌─────────────────────────────────────────────────────┐
│ SALDO INICIAL EM CAIXA           R$ 150.000,00      │
│  ▸ Banco Inter                     R$ 50.000,00     │
│  ▸ Banco Caixa                     R$ 60.000,00     │
│  ▸ Banco PagBank                   R$ 40.000,00     │
├─────────────────────────────────────────────────────┤
│ (+) ENTRADAS                     R$ 280.000,00      │
│  ▸ 01-Cursos FS (12)             R$ 200.000,00  ▾   │
│    │ 15/01 - Curso XYZ - Banco Inter   R$ 5.000     │
│    │ 16/01 - Curso ABC - Banco Caixa   R$ 3.200     │
│  ▸ 05-Cursos Terceiros (3)        R$ 30.000,00  ▾   │
│  ▸ 97-Resgates (2)                R$ 50.000,00  ▾   │
├─────────────────────────────────────────────────────┤
│ (-) SAÍDAS                      -R$ 220.000,00      │
│  ▸ 11-Fixas (8)                  -R$ 80.000,00  ▾   │
│  ▸ 12-Variáveis (5)             -R$ 40.000,00  ▾   │
│  ▸ 21-Distribuições (1)         -R$ 50.000,00  ▾   │
│  ▸ 99-Transferências (2)        -R$ 50.000,00  ▾   │
├─────────────────────────────────────────────────────┤
│ ═ SALDO FINAL DO MÊS              R$ 210.000,00    │
│  ▸ Banco Inter                     R$ 80.000,00     │
│  ▸ Banco Caixa                     R$ 70.000,00     │
│  ▸ Banco PagBank                   R$ 60.000,00     │
├─────────────────────────────────────────────────────┤
│ 💰 INVESTIMENTOS (50)              R$ 30.000,00     │
│  ▸ Detalhamento dos itens custoNum 50               │
│                                                     │
│ PATRIMÔNIO TOTAL                   R$ 240.000,00    │
│  = Saldo em Bancos + Saldo Investido                │
├─────────────────────────────────────────────────────┤
│ 📦 RESERVAS / CAIXINHAS                             │
│  ▸ 51-GIRO                         R$ 15.000,00    │
│    │ detalhamento...                                │
│  ▸ 52-CAIXINHAS                     R$ 10.000,00    │
│    │ detalhamento...                                │
│  Total em Reservas                  R$ 25.000,00    │
│  Saldo Disponível (SF - Reservas)   R$ 185.000,00   │
└─────────────────────────────────────────────────────┘
```

### Implementação

**1. Adicionar custoNum 50, 51, 52 ao `grouped`** (linhas 103-161)
- Novo grupo `investimentos: Record<string, Pagina5Record[]>` para custoNum 50
- Novo grupo `reservas: Record<string, Pagina5Record[]>` para custoNum 51 e 52
- Adicionar ao return do useMemo

**2. Classificação de entradas vs saídas para o extrato:**
- **Entradas**: receitas (1-10) + entradasCaixa (97,98) + transferências positivas
- **Saídas**: despesas (11-20) + saidasCaixa (21-30) + transferências negativas

**3. Substituir toda a seção FLUXO DE CAIXA** (linhas 1029-1499) por um único `Card` com layout de extrato sequencial:
- Cada seção é um bloco compacto com header e itens colapsáveis por centro de custo
- Sem cards separados por banco, sem botões de filtro
- Tudo em um fluxo vertical contínuo e legível

**4. Saldo Final por banco** - reutilizar `fluxoBancos` já calculado para mostrar breakdown

**5. Seção Investimentos** - somar `valorLiquido` de custoNum 50, mostrar `Patrimônio Total = Saldo Final + Investimentos`

**6. Seção Reservas** - somar custoNum 51 (GIRO) e 52 (CAIXINHAS), mostrar total e `Saldo Disponível = Saldo Final - Reservas`

### Arquivo alterado
`src/components/DREFluxoCaixa.tsx`

