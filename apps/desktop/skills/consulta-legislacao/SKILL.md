# Skill: Consulta Legislacao (via Navegador)

MCP Server para consulta de legislacao brasileira usando navegacao web.

## Visao Geral

Este skill fornece **instrucoes de navegacao** para o agente buscar leis, codigos, decretos, medidas provisorias, jurisprudencia e sumulas em portais oficiais do governo brasileiro.

**IMPORTANTE:** Esta skill NAO faz chamadas de API diretamente. Ela retorna instrucoes para o agente usar o **dev-browser** (MCP de automacao de navegador) para acessar os sites e extrair informacoes.

## Sites Utilizados

| Site | URL | Conteudo |
|------|-----|----------|
| Planalto | https://www.planalto.gov.br/ccivil_03/ | Legislacao federal (leis, decretos, MPs) |
| Senado | https://www.senado.leg.br/atividade/const/constituicao-federal.asp | Constituicao Federal |
| LexML | https://www.lexml.gov.br/ | Busca unificada de legislacao |
| STF | https://portal.stf.jus.br/jurisprudencia/ | Jurisprudencia e sumulas STF |
| STJ | https://scon.stj.jus.br/SCON/ | Jurisprudencia e sumulas STJ |
| TST | https://jurisprudencia.tst.jus.br/ | Jurisprudencia e sumulas TST |

## Ferramentas Disponiveis

### 1. pesquisar_lei
Retorna instrucoes para pesquisar uma lei especifica pelo numero e ano.

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

**Retorno:** Instrucoes de navegacao para encontrar a Lei 8.078/1990 (CDC)

### 2. pesquisar_legislacao
Retorna instrucoes para pesquisar legislacao por termo livre.

**Parametros:**
- `termo` (obrigatorio): Termo de busca

**Exemplo:**
```json
{
  "termo": "direito do consumidor"
}
```

### 3. consultar_codigo
Retorna instrucoes para consultar um dos principais codigos brasileiros.

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

### 4. buscar_jurisprudencia
Retorna instrucoes para buscar jurisprudencia nos tribunais superiores.

**Parametros:**
- `termo` (obrigatorio): Termo de busca
- `tribunal` (opcional): stf, stj, tst (padrao: todos)

### 5. pesquisar_decreto
Retorna instrucoes para pesquisar um decreto especifico.

**Parametros:**
- `numero` (obrigatorio): Numero do decreto
- `ano` (obrigatorio): Ano do decreto

### 6. pesquisar_medida_provisoria
Retorna instrucoes para pesquisar uma medida provisoria.

**Parametros:**
- `numero` (obrigatorio): Numero da MP
- `ano` (opcional): Ano da MP

### 7. pesquisar_sumula
Retorna instrucoes para pesquisar sumulas de tribunais superiores.

**Parametros:**
- `tribunal` (obrigatorio): stf, stj ou tst
- `numero` (opcional): Numero da sumula

### 8. pesquisar_constituicao
Retorna instrucoes para consultar a Constituicao Federal de 1988.

**Parametros:**
- `artigo` (opcional): Numero do artigo

### 9. listar_codigos_disponiveis
Lista todos os codigos brasileiros disponiveis para consulta.

### 10. listar_sites_legislacao
Lista todos os sites oficiais de legislacao com suas URLs e descricoes.

## Formato de Resposta

Todas as ferramentas retornam um objeto JSON com instrucoes de navegacao:

```json
{
  "tipo": "instrucoes_navegacao",
  "descricao": "Pesquisa da Lei 8.078/1990 (Codigo de Defesa do Consumidor)",
  "urls_sugeridas": [
    {
      "url": "https://www.planalto.gov.br/ccivil_03/leis/l8078.htm",
      "descricao": "Link direto para a lei no Planalto (fonte oficial)",
      "prioridade": 1
    },
    {
      "url": "https://www.google.com/search?q=lei+8078+1990+texto+completo",
      "descricao": "Busca no Google como alternativa",
      "prioridade": 2
    }
  ],
  "passos": [
    "1. Use browser_navigate para acessar a URL de prioridade 1",
    "2. Use browser_snapshot para verificar se a pagina carregou",
    "3. Se a pagina contem o texto da lei, extraia o conteudo relevante",
    "4. Se a pagina nao carregar, tente a proxima URL da lista"
  ],
  "browser_script_sugerido": {
    "actions": [
      {"action": "goto", "url": "https://www.planalto.gov.br/ccivil_03/leis/l8078.htm"},
      {"action": "waitForLoad"},
      {"action": "snapshot"}
    ]
  },
  "dicas": [
    "O site do Planalto pode demorar para carregar",
    "Se o link direto nao funcionar, use a busca no Google"
  ]
}
```

## Como Usar com dev-browser

O agente deve usar as ferramentas do dev-browser para executar as instrucoes:

### Exemplo: Buscar Lei 8.078/1990

1. Chamar `pesquisar_lei(numero=8078, ano=1990)`
2. Receber instrucoes com URLs e passos
3. Usar `browser_script` com as acoes sugeridas:

```json
browser_script(actions=[
  {"action": "goto", "url": "https://www.planalto.gov.br/ccivil_03/leis/l8078.htm"},
  {"action": "waitForLoad"},
  {"action": "snapshot"}
])
```

4. Analisar o snapshot para extrair o texto da lei
5. Se necessario, usar `browser_evaluate` para extrair texto especifico

### Exemplo: Buscar Jurisprudencia no STF

1. Chamar `buscar_jurisprudencia(termo="dano moral", tribunal="stf")`
2. Usar as instrucoes retornadas para navegar
3. Preencher o formulario de busca usando `findAndFill`
4. Extrair os resultados

## Execucao Local

```bash
# Instalar dependencias
npm install

# Executar em modo desenvolvimento
npm start

# Compilar para producao
npm run build
```

## Links Uteis

- [Portal da Legislacao - Planalto](https://www.planalto.gov.br/ccivil_03/)
- [Senado Federal - Constituicao](https://www.senado.leg.br/atividade/const/constituicao-federal.asp)
- [Portal LexML](https://www.lexml.gov.br/)
- [STF Jurisprudencia](https://portal.stf.jus.br/jurisprudencia/)
- [STJ Jurisprudencia](https://scon.stj.jus.br/SCON/)
- [TST Jurisprudencia](https://jurisprudencia.tst.jus.br/)
