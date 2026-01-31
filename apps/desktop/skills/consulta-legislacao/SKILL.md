# Skill: Consulta Legislacao

MCP Server para consulta de legislacao brasileira via API LexML do Senado Federal.

## Visao Geral

Este skill permite consultar leis, codigos, decretos, medidas provisorias, jurisprudencia e sumulas usando a API publica do LexML (Rede de Informacao Legislativa e Juridica).

**API Base:** https://www.lexml.gov.br/busca/SRU
**Autenticacao:** Nenhuma (API publica)
**Protocolo:** SRU (Search/Retrieval via URL) com queries CQL

## Ferramentas Disponiveis

### 1. pesquisar_lei
Pesquisa uma lei especifica pelo numero e ano.

**Parametros:**
- `numero` (obrigatorio): Numero da lei
- `ano` (obrigatorio): Ano da lei
- `complementar` (opcional): Se e lei complementar (padrao: false)

**Exemplo:**
```json
{
  "numero": 8078,
  "ano": 1990
}
```
Retorna: Codigo de Defesa do Consumidor

### 2. pesquisar_legislacao
Pesquisa legislacao por termo livre nas ementas.

**Parametros:**
- `termo` (obrigatorio): Termo de busca
- `maxResultados` (opcional): Quantidade maxima (padrao: 10, max: 50)

**Exemplo:**
```json
{
  "termo": "direito do consumidor",
  "maxResultados": 20
}
```

### 3. consultar_codigo
Consulta um dos principais codigos brasileiros.

**Codigos disponiveis:**
| Sigla | Nome | Lei |
|-------|------|-----|
| civil | Codigo Civil | Lei 10.406/2002 |
| penal | Codigo Penal | Decreto-Lei 2.848/1940 |
| clt | Consolidacao das Leis do Trabalho | Decreto-Lei 5.452/1943 |
| cdc | Codigo de Defesa do Consumidor | Lei 8.078/1990 |
| cpc | Codigo de Processo Civil | Lei 13.105/2015 |
| cpp | Codigo de Processo Penal | Decreto-Lei 3.689/1941 |
| ctb | Codigo de Transito Brasileiro | Lei 9.503/1997 |
| eca | Estatuto da Crianca e do Adolescente | Lei 8.069/1990 |

**Parametros:**
- `codigo` (obrigatorio): Sigla do codigo
- `artigo` (opcional): Numero do artigo para filtrar

**Exemplo:**
```json
{
  "codigo": "cdc",
  "artigo": 6
}
```
Retorna: Art. 6 do CDC (direitos basicos do consumidor)

### 4. buscar_jurisprudencia_termo
Busca jurisprudencia por termo nas ementas.

**Parametros:**
- `termo` (obrigatorio): Termo de busca
- `maxResultados` (opcional): Quantidade maxima (padrao: 10, max: 50)

**Exemplo:**
```json
{
  "termo": "dano moral consumidor"
}
```

### 5. pesquisar_decreto
Pesquisa um decreto especifico.

**Parametros:**
- `numero` (obrigatorio): Numero do decreto
- `ano` (obrigatorio): Ano do decreto

**Exemplo:**
```json
{
  "numero": 9579,
  "ano": 2018
}
```

### 6. pesquisar_medida_provisoria
Pesquisa uma medida provisoria.

**Parametros:**
- `numero` (obrigatorio): Numero da MP
- `ano` (opcional): Ano da MP

**Exemplo:**
```json
{
  "numero": 1085,
  "ano": 2021
}
```

### 7. pesquisar_sumula
Pesquisa sumulas de tribunais superiores.

**Parametros:**
- `tribunal` (obrigatorio): stf, stj ou tst
- `numero` (opcional): Numero da sumula

**Exemplo:**
```json
{
  "tribunal": "stf",
  "numero": 323
}
```

### 8. pesquisar_constituicao
Pesquisa na Constituicao Federal de 1988.

**Parametros:**
- `artigo` (opcional): Numero do artigo

**Exemplo:**
```json
{
  "artigo": 5
}
```
Retorna: Art. 5 da CF/88 (direitos fundamentais)

### 9. pesquisar_avancada
Pesquisa usando query CQL personalizada.

**Parametros:**
- `query` (obrigatorio): Query CQL
- `maxResultados` (opcional): Quantidade maxima (padrao: 10, max: 50)

**Sintaxe CQL:**
- `tipoDocumento=lei AND numero=8078 AND ano=1990`
- `ementa all "direito consumidor"`
- `autoridade=supremo.tribunal.federal`
- `localidade=br`

**Exemplo:**
```json
{
  "query": "tipoDocumento=lei AND ementa all \"protecao dados\" AND ano>=2018",
  "maxResultados": 20
}
```

### 10. listar_codigos_disponiveis
Lista todos os codigos brasileiros disponiveis para consulta.

### 11. listar_tipos_documento
Lista todos os tipos de documento disponiveis para busca.

## Formato de Resposta

Todas as ferramentas retornam JSON com a seguinte estrutura:

```json
{
  "sucesso": true,
  "total": 5,
  "quantidadeRetornada": 5,
  "query": "tipoDocumento=lei AND numero=8078 AND ano=1990",
  "registros": [
    {
      "titulo": "Lei no 8.078, de 11 de setembro de 1990",
      "tipoDocumento": "lei",
      "numero": "8078",
      "ano": 1990,
      "data": "1990-09-11",
      "ementa": "Dispoe sobre a protecao do consumidor e da outras providencias.",
      "autoridade": "federal",
      "localidade": "br",
      "url": "https://www.lexml.gov.br/urn/urn:lex:br:federal:lei:1990-09-11;8078",
      "urlTextoIntegral": "http://...",
      "descritores": ["consumidor", "protecao"],
      "urn": "urn:lex:br:federal:lei:1990-09-11;8078"
    }
  ]
}
```

## Tipos de Documento

| Codigo | Descricao |
|--------|-----------|
| lei | Lei (generica) |
| lei.complementar | Lei Complementar |
| lei.ordinaria | Lei Ordinaria |
| decreto.lei | Decreto-Lei |
| decreto | Decreto |
| medida.provisoria | Medida Provisoria |
| emenda.constitucional | Emenda Constitucional |
| resolucao | Resolucao |
| portaria | Portaria |
| instrucao.normativa | Instrucao Normativa |
| jurisprudencia | Jurisprudencia |
| sumula | Sumula |
| acordao | Acordao |
| constituicao | Constituicao |

## Exemplos de Uso

### Buscar o Codigo de Defesa do Consumidor
```
pesquisar_lei(numero=8078, ano=1990)
```

### Consultar Art. 5 da Constituicao Federal
```
pesquisar_constituicao(artigo=5)
```

### Buscar jurisprudencia sobre dano moral
```
buscar_jurisprudencia_termo(termo="dano moral")
```

### Consultar sumula vinculante do STF
```
pesquisar_sumula(tribunal="stf", numero=37)
```

### Pesquisa avancada por leis de protecao de dados
```
pesquisar_avancada(query="tipoDocumento=lei AND ementa all \"protecao dados\"")
```

## Configuracao

Nenhuma configuracao necessaria. A API do LexML e publica e nao requer autenticacao.

## Limitacoes

- A API retorna metadados e ementas, nao o texto completo das leis
- Para texto completo, use o link `urlTextoIntegral` retornado
- Maximo de 50 resultados por consulta
- Algumas buscas podem retornar muitos resultados; use filtros para refinar

## Links Uteis

- [Portal LexML](https://www.lexml.gov.br/)
- [Documentacao SRU](https://www.lexml.gov.br/conteudo/LexML-Brasil-Projeto-do-LEXML-SRU.pdf)
- [Catalogo de URNs](https://projeto.lexml.gov.br/)
