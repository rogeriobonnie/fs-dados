## Melhorar PDF de Eventos — agrupamento de despesas

Ajustar `src/components/EventosPainel.tsx` (função `exportPDF`) para reorganizar a seção **Despesas** do PDF, mantendo Receitas como estão.

### Mudanças

1. **Agrupar despesas por Descrição normalizada** (sem acentos, sem espaços extras, uppercase — mesmo padrão já usado no arquivo em `normalize()`).
2. **Ordenar** os grupos por valor total (maior → menor) para leitura mais útil.
3. **Dentro de cada grupo**: manter todas as linhas detalhadas (data, detalhamento, centro de custo, banco, valor) ordenadas por data.
4. **Linha de subtotal** ao final de cada grupo: `Subtotal — {Descrição} ({N} lançamentos)` com valor à direita, destacada com fundo cinza-claro.
5. **Total geral** de despesas permanece no `foot` da tabela (já existe).
6. **Corrigir "linhas faltando"**: garantir que autoTable use `showHead: 'everyPage'` e não force `pageBreak` cortando grupos. Grupos são renderizados como um único `body` contínuo (não múltiplas tabelas), evitando header órfão. A separação visual entre grupos vem apenas do estilo da linha de subtotal.

### Detalhes técnicos

- Construir `body` como array plano intercalando linhas normais e linhas-subtotal.
- Usar `didParseCell` para pintar as linhas de subtotal (`fillColor: [243, 244, 246]`, `fontStyle: 'bold'`) identificando-as por um `Set<number>` de índices.
- A coluna "Descrição" da linha subtotal usa `colSpan` para ocupar da col 0 até col 4, valor fica na col 5 (alinhado à direita).
- Nada muda em Receitas nem na tela (só no PDF exportado).

### Arquivo afetado

- `src/components/EventosPainel.tsx` (apenas função `exportPDF`)