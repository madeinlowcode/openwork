# Skill: Consulta de Processos Judiciais (DataJud CNJ)

MCP Server para consulta de processos judiciais em todos os tribunais brasileiros via API pública do DataJud (Conselho Nacional de Justiça).

## Configuração

### Obter API Key

1. Acesse: https://datajud-wiki.cnj.jus.br/
2. Siga as instruções para obter sua chave de API
3. A chave é gratuita e disponível para todos

### Variáveis de Ambiente

```bash
DATAJUD_API_KEY=sua_chave_api_aqui
```

## Ferramentas Disponíveis

### 1. `consultar_processo`

Consulta um processo específico pelo número NPU (Numeração Única de Processo).

**Parâmetros:**
- `tribunal` (obrigatório): Sigla do tribunal (ex: "tjsp", "stj", "trf3")
- `numeroProcesso` (obrigatório): Número do processo no formato NPU ou apenas dígitos

**Exemplo:**
```json
{
  "tribunal": "tjsp",
  "numeroProcesso": "1000000-00.2024.8.26.0100"
}
```

**Retorno:** Dados completos do processo incluindo classe, órgão julgador, partes, assuntos e últimas movimentações.

---

### 2. `pesquisar_processos`

Pesquisa processos por diversos critérios. Retorna lista paginada.

**Parâmetros:**
- `tribunal` (obrigatório): Sigla do tribunal
- `numeroProcesso` (opcional): Número parcial ou completo
- `classe` (opcional): Código da classe processual
- `orgaoJulgador` (opcional): Código do órgão julgador
- `dataAjuizamentoInicio` (opcional): Data inicial (YYYY-MM-DD)
- `dataAjuizamentoFim` (opcional): Data final (YYYY-MM-DD)
- `assunto` (opcional): Código do assunto
- `nomeParte` (opcional): Nome da parte (autor, réu, etc.)
- `tamanho` (opcional): Resultados por página (padrão: 10, máx: 100)
- `pagina` (opcional): Número da página (começa em 0)

**Exemplo - Buscar por nome da parte:**
```json
{
  "tribunal": "tjrj",
  "nomeParte": "João da Silva",
  "tamanho": 20
}
```

**Exemplo - Buscar por período:**
```json
{
  "tribunal": "trf3",
  "dataAjuizamentoInicio": "2024-01-01",
  "dataAjuizamentoFim": "2024-12-31",
  "tamanho": 50
}
```

---

### 3. `listar_movimentacoes`

Lista os andamentos/movimentações de um processo específico.

**Parâmetros:**
- `tribunal` (obrigatório): Sigla do tribunal
- `numeroProcesso` (obrigatório): Número do processo
- `limite` (opcional): Máximo de movimentações (padrão: 20, máx: 100)

**Exemplo:**
```json
{
  "tribunal": "stj",
  "numeroProcesso": "0000001-00.2024.3.00.0000",
  "limite": 50
}
```

**Retorno:** Lista de movimentações ordenadas da mais recente para a mais antiga, incluindo data, descrição e complementos.

---

### 4. `listar_tribunais`

Lista todos os tribunais disponíveis para consulta.

**Parâmetros:**
- `filtro` (opcional): Filtrar por tipo de tribunal
  - `"superiores"`: STF, STJ, TST, TSE, STM
  - `"trf"`: Tribunais Regionais Federais (TRF1-TRF6)
  - `"tj"`: Tribunais de Justiça Estaduais
  - `"trt"`: Tribunais Regionais do Trabalho (TRT1-TRT24)
  - `"tre"`: Tribunais Regionais Eleitorais
  - `"todos"`: Todos os tribunais (padrão)

**Exemplo:**
```json
{
  "filtro": "tj"
}
```

---

## Tribunais Disponíveis

### Tribunais Superiores
- `stf` - Supremo Tribunal Federal
- `stj` - Superior Tribunal de Justiça
- `tst` - Tribunal Superior do Trabalho
- `tse` - Tribunal Superior Eleitoral
- `stm` - Superior Tribunal Militar

### Tribunais Regionais Federais
- `trf1` a `trf6`

### Tribunais de Justiça Estaduais
- `tjac`, `tjal`, `tjam`, `tjap`, `tjba`, `tjce`, `tjdft`, `tjes`
- `tjgo`, `tjma`, `tjmg`, `tjms`, `tjmt`, `tjpa`, `tjpb`, `tjpe`
- `tjpi`, `tjpr`, `tjrj`, `tjrn`, `tjro`, `tjrr`, `tjrs`, `tjsc`
- `tjse`, `tjsp`, `tjto`

### Tribunais Regionais do Trabalho
- `trt1` a `trt24`

### Tribunais Regionais Eleitorais
- `tre_ac` a `tre_to`

---

## Formato NPU (Numeração Única de Processo)

O número unificado do processo segue o padrão:

```
NNNNNNN-DD.AAAA.J.TR.OOOO
```

Onde:
- `NNNNNNN`: Número sequencial (7 dígitos)
- `DD`: Dígito verificador (2 dígitos)
- `AAAA`: Ano do ajuizamento (4 dígitos)
- `J`: Segmento do Judiciário (1 dígito)
- `TR`: Tribunal (2 dígitos)
- `OOOO`: Origem (4 dígitos)

**Exemplo:** `0001234-56.2024.8.26.0100`

A API aceita o número com ou sem formatação.

---

## Códigos de Referência

### Segmentos do Judiciário (dígito J)
- `1` - Supremo Tribunal Federal
- `2` - Conselho Nacional de Justiça
- `3` - Superior Tribunal de Justiça
- `4` - Justiça Federal
- `5` - Justiça do Trabalho
- `6` - Justiça Eleitoral
- `7` - Justiça Militar da União
- `8` - Justiça Estadual
- `9` - Justiça Militar Estadual

---

## Tratamento de Erros

O skill retorna erros estruturados em formato JSON:

```json
{
  "sucesso": false,
  "erro": "Descrição do erro"
}
```

### Erros Comuns

1. **API Key não configurada:**
   ```
   API Key do DataJud não configurada. Configure a variável de ambiente DATAJUD_API_KEY.
   ```

2. **Processo não encontrado:**
   ```
   Processo 0000000-00.0000.0.00.0000 não encontrado no Tribunal de Justiça de São Paulo
   ```

3. **Tribunal inválido:**
   ```
   Erro na API DataJud: 404 Not Found. Verifique se o tribunal "xyz" é válido.
   ```

---

## Execução Local

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
DATAJUD_API_KEY=sua_chave npm start

# Compilar para produção
npm run build
```

---

## Referências

- [DataJud Wiki](https://datajud-wiki.cnj.jus.br/) - Documentação oficial da API
- [CNJ](https://www.cnj.jus.br/) - Conselho Nacional de Justiça
- [Tabelas Processuais Unificadas](https://www.cnj.jus.br/sgt/consulta_publica_classes.php) - Classes e assuntos
