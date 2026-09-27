# Separar entradas de 01-Cursos por origem (Histórico)

## O que muda para você
Na aba **Histórico**, quando você abrir **01-Cursos** de um ano, vai aparecer um novo quadro com subtotais por origem:

- Eduzz
- Pix
- Boleto
- Patrocínio
- Não identificado (o que sobrar)

Cada grupo vai mostrar valor, % do total e quantidade de lançamentos. Você pode clicar no grupo para ver as linhas. Cada linha também mostra se foi classificada **por regra** ou **pela IA**.

## Como a separação funciona
1. **Primeiro, regras de palavras**: leio a Descrição e o Detalhamento procurando termos como EDUZZ, PIX, BOLETO, ASAAS, PATROCIN, APOIO e variações. Sem acentos e sem diferença entre maiúsculas e minúsculas.
2. **Depois, a IA**: as linhas que ficarem sem categoria vão para a inteligência artificial, que escolhe uma das 4 categorias ou "Não identificado".
3. **Guardar o resultado**: o que a IA classificar fica salvo. Assim, a mesma linha não é analisada de novo e o custo não se repete. Um botão **"Classificar com IA"** roda a análise só quando você quiser.

## Antes de construir
- Vou ler as linhas reais de 01-Cursos na planilha para ajustar as palavras das regras. Depois mostro quantas linhas cada regra pegou e quantas sobraram para a IA.
- Para a IA, vou precisar ativar o **Lovable Cloud**, que também guarda as classificações. Cada análise consome créditos de IA.

## Detalhes técnicos
- Fonte: `FLUXO DE CAIXA!A:G` (só tem Descrição e Detalhamento, sem banco), filtrando `custoNum === 1` e ano < 2026.
- Novo `src/utils/classificarOrigemCursos.ts`: regras com texto normalizado (sem acentos e espaços, em maiúsculas).
- Lovable Cloud: tabela `origem_classificacao` (chave = hash de data+descrição+detalhamento+valor, categoria, fonte), com GRANTs e RLS. Edge function `classificar-origem` que envia as linhas pendentes em lotes para `openai/gpt-6-astra` via Responses, com saída JSON estrita e streaming, e trata os erros 402/429.
- UI no `HistoricoAnual.tsx`, dentro da expansão de 01-Cursos.
