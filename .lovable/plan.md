

## Plano: Melhorar Fluxo de Caixa - Cards, Movimentações e Filtro por Banco

### Mudanças

**1. Remover seção "Conciliação Bancária"** (linhas 1314-1418)
- Eliminar completamente esta tabela redundante

**2. Cards dos bancos - redesign** (linhas 1065-1151)
- Remover as barras de `Progress` que não ficam boas
- Layout mais limpo: fluxo horizontal `SI → +Entradas → -Saídas → = SF`
- Cada card com nome do banco **clicável** - ao clicar, filtra as movimentações abaixo (substitui o filtro de botões atual)
- Card "Consolidado" sempre visível, ao clicar volta para "Todos"
- Indicador visual de seleção (borda/destaque) no banco ativo
- Variação (entradas - saídas) como indicador compacto

**3. Remover botões de filtro separados** (linhas 1037-1063)
- O filtro agora é feito clicando nos cards dos bancos diretamente

**4. Movimentações - melhor organização** (linhas 1153-1312)
- Agrupar movimentações por tipo (Receita, Despesa, Saída Caixa, Entrada Caixa, Transferência) com headers de grupo colapsáveis
- Dentro de cada grupo, ordenar por data
- Subtotal por grupo visível no header do grupo
- Manter saldo acumulado geral (calculado na ordem cronológica mas exibido agrupado)
- Alternativa: toggle "Agrupar por tipo / Cronológico" para o usuário escolher a visualização

### Arquivo alterado
`src/components/DREFluxoCaixa.tsx` - seção FLUXO DE CAIXA (linhas 1030-1418)

