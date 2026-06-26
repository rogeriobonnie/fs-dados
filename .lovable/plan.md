## Relatório de Inadimplência (FS Turma IV)

Nova aba **"Inadimplência"** dentro de FS Turma IV, agrupando todos os alunos por status com totalizadores, visual colorido/profissional e exportação em PDF A4.

### 1. Nova aba na navegação interna
- Em `src/pages/Index.tsx`, alterar `grid-cols-4` → `grid-cols-5` nas tabs internas e adicionar `TabsTrigger value="inadimplencia"` (ícone `AlertTriangle`) antes de "Distratos".
- Passa `filteredData` completo (incluindo DISTRATO/EM NEGOCIACAO) para o novo componente.

### 2. Novo componente `src/components/RelatorioInadimplencia.tsx`
Estrutura visual:

**Cabeçalho com 5 cards coloridos (resumo geral):**
- 🟢 Pagos (verde) — qtd alunos, total recebido
- 🟡 Em dia / A pagar (azul) — qtd, valor a receber
- 🟠 Em Negociação / Acordo (âmbar) — qtd, valor em acordo
- 🔴 Vencidos / Em atraso (vermelho) — qtd, valor em atraso, dias médios
- ⚫ Distratos (cinza-escuro) — qtd, valor perdido

**Card geral consolidado:**
Total contratado | Total recebido | Total a receber | Total em atraso | Total perdido (distrato) | % inadimplência

**Seções (uma por status, cada uma colapsável/Card):**
Para cada grupo, tabela com colunas:
`Aluno | Consultora | Parcelas (pagas/total) | Contratado | Recebido | Em aberto | Atraso (dias) | Última atualização`

Grupos:
1. **Em Atraso** (status VENCIDO) — ordenado por dias de atraso desc, linha vermelha
2. **Em Negociação / Acordo** (EM NEGOCIACAO) — laranja
3. **Distratos** (DISTRATO) — cinza
4. **A Pagar** (parcelas futuras pendentes) — azul
5. **Pagos / Adimplentes** (alunos 100% quitados) — verde

Agrupamento: somar parcelas por `studentName`; classificar aluno pelo "pior" status presente (vencido > negociação > distrato > a pagar > pago) — mas exibir também nas seções específicas conforme houver parcelas naquele status. Padrão: aluno aparece em UMA seção principal (pior status). Toggle "Ver detalhe de parcelas" abre modal `StudentDetailModal`.

Cálculos:
- `valorFinal = amount + interest - fees`
- `recebido` = soma de parcelas PAGAS
- `emAberto` = soma de parcelas não pagas
- `diasAtraso` = max dos dias entre hoje e dueDate das parcelas vencidas

### 3. Exportação PDF A4
Botão "Exportar PDF" no topo direito. Usa `jsPDF` + `jspdf-autotable` (já instalado no projeto — confirmar; se não, adicionar).
- Formato A4 retrato, margens 15mm
- Cabeçalho: logo FS + título "Relatório de Inadimplência — FS Turma IV" + data de geração
- Bloco de resumo (5 mini-cards coloridos via `doc.rect` + texto)
- Uma tabela por status, com cabeçalho colorido conforme o status (verde/azul/laranja/vermelho/cinza), zebra striping, totais ao fim de cada tabela
- Rodapé com paginação "Página X de Y"
- Nome do arquivo: `Inadimplencia_FS_Turma_IV_YYYY-MM-DD.pdf`

### Arquivos
- editar: `src/pages/Index.tsx`
- criar: `src/components/RelatorioInadimplencia.tsx`
- criar (helper): `src/utils/inadimplenciaPdf.ts`

### Dúvidas rápidas
1. Aluno deve aparecer em **uma só seção** (pelo pior status) ou em **todas as seções** onde tenha parcelas? Sugestão: pior status, com badge mostrando se também tem parcelas em outros estados.
2. "Pagos" deve listar **apenas alunos 100% quitados** ou também as parcelas pagas de quem ainda deve? Sugestão: só 100% quitados (para ficar limpo).
