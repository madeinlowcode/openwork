# Skill: Extrator de Documentos Jurídicos

MCP Server para extração de texto e análise de documentos PDF e DOCX jurídicos. Permite extrair conteúdo, analisar peças processuais, identificar cláusulas contratuais e comparar documentos.

## Formatos Suportados

- **PDF** - Extração completa de texto e metadados (título, autor, datas, páginas)
- **DOCX** - Extração de texto e opcionalmente HTML
- **TXT** - Leitura direta de arquivos de texto

## Ferramentas Disponíveis

### 1. `extrair_documento`

Extrai texto de documentos PDF, DOCX ou TXT com diferentes formatos de saída.

**Parâmetros:**
- `caminhoArquivo` (obrigatório): Caminho completo para o arquivo
- `formato` (opcional): Formato de saída
  - `"texto"` (padrão): Texto completo extraído
  - `"resumo"`: Primeiros 2000 caracteres
  - `"estruturado"`: Metadados + informações extraídas + texto parcial

**Exemplo - Texto completo:**
```json
{
  "caminhoArquivo": "C:/Documentos/peticao.pdf",
  "formato": "texto"
}
```

**Exemplo - Formato estruturado:**
```json
{
  "caminhoArquivo": "C:/Documentos/contrato.docx",
  "formato": "estruturado"
}
```

**Retorno (estruturado):**
```json
{
  "sucesso": true,
  "formato": "estruturado",
  "metadados": {
    "numeroPaginas": 15,
    "tamanhoBytes": 125000,
    "titulo": "Contrato de Prestação de Serviços",
    "autor": "Escritório XYZ"
  },
  "informacoesExtraidas": {
    "numeroProcesso": null,
    "partes": { "autor": [], "reu": [] },
    "valorCausa": "R$ 50.000,00"
  },
  "texto": "..."
}
```

---

### 2. `analisar_peca_juridica`

Analisa peças jurídicas identificando automaticamente elementos estruturais.

**Parâmetros:**
- `caminhoArquivo` (obrigatório): Caminho para a peça jurídica
- `tipoPeca` (opcional): Tipo da peça (sobrescreve detecção automática)

**Elementos identificados:**
- Número do processo (formato NPU)
- Partes (autor/réu/requerente/requerido)
- Valor da causa
- Pedidos
- Fundamentos jurídicos (artigos, leis, súmulas)
- Tipo de documento

**Exemplo:**
```json
{
  "caminhoArquivo": "C:/Processos/peticao-inicial.pdf"
}
```

**Retorno:**
```json
{
  "sucesso": true,
  "analise": {
    "tipoDocumento": "Petição Inicial",
    "numeroProcesso": "1234567-89.2024.8.26.0100",
    "partes": {
      "autor": ["João da Silva"],
      "reu": ["Empresa XYZ Ltda"]
    },
    "valorCausa": "R$ 100.000,00",
    "pedidos": [
      "Condenação ao pagamento de indenização por danos morais",
      "Restituição dos valores pagos indevidamente"
    ],
    "fundamentosJuridicos": [
      "Art. 186 do Código Civil",
      "Art. 5º, X da Constituição Federal",
      "Súmula 37 do STJ"
    ]
  }
}
```

---

### 3. `extrair_clausulas_contrato`

Lista cláusulas de contratos jurídicos com opção de filtro.

**Parâmetros:**
- `caminhoArquivo` (obrigatório): Caminho para o contrato
- `filtroClausulas` (opcional): Array de palavras-chave para filtrar

**Exemplo - Todas as cláusulas:**
```json
{
  "caminhoArquivo": "C:/Contratos/prestacao-servicos.docx"
}
```

**Exemplo - Filtrar por palavras-chave:**
```json
{
  "caminhoArquivo": "C:/Contratos/locacao.pdf",
  "filtroClausulas": ["multa", "rescisão", "penalidade"]
}
```

**Retorno:**
```json
{
  "sucesso": true,
  "totalClausulas": 3,
  "filtroAplicado": ["multa", "rescisão", "penalidade"],
  "clausulas": [
    {
      "indice": 1,
      "numero": "QUINTA",
      "titulo": "DA MULTA CONTRATUAL",
      "conteudo": "Em caso de inadimplemento, a parte infratora..."
    },
    {
      "indice": 2,
      "numero": "DÉCIMA",
      "titulo": "DA RESCISÃO",
      "conteudo": "O presente contrato poderá ser rescindido..."
    }
  ]
}
```

---

### 4. `comparar_documentos`

Compara dois documentos calculando similaridade e identificando diferenças.

**Parâmetros:**
- `caminhoArquivo1` (obrigatório): Primeiro documento
- `caminhoArquivo2` (obrigatório): Segundo documento

**Exemplo:**
```json
{
  "caminhoArquivo1": "C:/Contratos/versao-1.docx",
  "caminhoArquivo2": "C:/Contratos/versao-2.docx"
}
```

**Retorno:**
```json
{
  "sucesso": true,
  "documento1": {
    "caminho": "C:/Contratos/versao-1.docx",
    "tamanhoTexto": 15000
  },
  "documento2": {
    "caminho": "C:/Contratos/versao-2.docx",
    "tamanhoTexto": 16500
  },
  "comparacao": {
    "similaridadePercentual": 78.5,
    "resumo": "Os documentos têm alta similaridade (70-90%)",
    "palavrasExclusivasDocumento1": ["anterior", "valor", "prazo"],
    "palavrasExclusivasDocumento2": ["novo", "atualizado", "aditivo"],
    "palavrasEmComum": ["contrato", "partes", "objeto", "...]
  }
}
```

---

## Padrões Reconhecidos

### Número de Processo (NPU)
```
NNNNNNN-DD.AAAA.J.TR.OOOO
Exemplo: 1234567-89.2024.8.26.0100
```

### Tipos de Documento Detectados
- Petição Inicial
- Contestação
- Sentença
- Acórdão
- Recurso de Apelação
- Agravo de Instrumento
- Mandado de Segurança
- Habeas Corpus
- Contrato
- Procuração
- Parecer
- Laudo
- Notificação Extrajudicial

### Fundamentos Jurídicos Reconhecidos
- Artigos de lei (Art. 186 do Código Civil)
- Leis específicas (Lei nº 8.078/90)
- Códigos (Código Civil, Código Penal, Código de Processo)
- Súmulas (Súmula 37 do STJ)
- Constituição Federal

---

## Tratamento de Erros

Todos os erros são retornados em formato estruturado:

```json
{
  "sucesso": false,
  "erro": "Descrição do erro",
  "caminhoArquivo": "caminho/do/arquivo"
}
```

### Erros Comuns

1. **Arquivo não encontrado:**
   ```
   Arquivo não encontrado: C:/caminho/arquivo.pdf
   ```

2. **Formato não suportado:**
   ```
   Formato não suportado: .xlsx. Use PDF, DOCX ou TXT.
   ```

3. **Arquivo corrompido:**
   ```
   Invalid PDF structure
   ```

---

## Casos de Uso

### 1. Triagem de Processos
```json
{
  "ferramenta": "analisar_peca_juridica",
  "caminhoArquivo": "C:/Inbox/nova-peticao.pdf"
}
```
Identifica automaticamente tipo de peça, partes envolvidas e valor da causa para classificação.

### 2. Revisão de Contrato
```json
{
  "ferramenta": "extrair_clausulas_contrato",
  "caminhoArquivo": "C:/Contratos/novo-contrato.docx",
  "filtroClausulas": ["responsabilidade", "indenização", "limitação"]
}
```
Lista cláusulas de risco para revisão focada.

### 3. Controle de Versões
```json
{
  "ferramenta": "comparar_documentos",
  "caminhoArquivo1": "C:/Minutas/v1.docx",
  "caminhoArquivo2": "C:/Minutas/v2.docx"
}
```
Identifica alterações entre versões de minutas.

### 4. Digitalização de Acervo
```json
{
  "ferramenta": "extrair_documento",
  "caminhoArquivo": "C:/Acervo/documento-antigo.pdf",
  "formato": "estruturado"
}
```
Extrai e indexa documentos para base de conhecimento.

---

## Execução Local

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm start

# Compilar para produção
npm run build
```

---

## Dependências

- **pdf-parse**: Extração de texto e metadados de PDFs
- **mammoth**: Conversão de DOCX para texto/HTML
- **@modelcontextprotocol/sdk**: Framework MCP
- **zod**: Validação de schemas

---

## Limitações

1. **OCR**: PDFs escaneados (imagens) não são suportados. Use PDFs com texto selecionável.
2. **Layouts complexos**: Tabelas e colunas múltiplas podem ter extração imperfeita.
3. **Criptografia**: PDFs protegidos por senha não são suportados.
4. **Tamanho**: Documentos muito grandes podem impactar performance.

---

## Referências

- [pdf-parse](https://www.npmjs.com/package/pdf-parse) - Documentação do extrator PDF
- [mammoth](https://www.npmjs.com/package/mammoth) - Documentação do conversor DOCX
- [MCP SDK](https://modelcontextprotocol.io/) - Documentação do Model Context Protocol
