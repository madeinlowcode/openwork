# Skill: Consulta de Processos Judiciais (via Navegador)

MCP Server para consulta de processos judiciais em tribunais brasileiros usando navegacao web.

## Visao Geral

Este skill fornece **instrucoes de navegacao** para o agente buscar processos judiciais nos sites dos tribunais brasileiros usando o **dev-browser** (MCP de automacao de navegador).

**IMPORTANTE:** Esta skill NAO faz chamadas de API diretamente. Ela retorna instrucoes para o agente usar browser_script/browser_navigate para acessar os sites e extrair informacoes.

## Sites de Consulta Processual

### Tribunais Superiores
| Tribunal | URL | Descricao |
|----------|-----|-----------|
| STF | https://portal.stf.jus.br/processos/ | Supremo Tribunal Federal |
| STJ | https://processo.stj.jus.br/processo/pesquisa/ | Superior Tribunal de Justica |
| TST | https://consultaprocessual.tst.jus.br/ | Tribunal Superior do Trabalho |

### Tribunais de Justica Estaduais (TJ)
| Tribunal | URL | Estado |
|----------|-----|--------|
| TJSP | https://esaj.tjsp.jus.br/cpopg/open.do | Sao Paulo |
| TJRJ | https://www3.tjrj.jus.br/consultaprocessual/ | Rio de Janeiro |
| TJMG | https://www4.tjmg.jus.br/juridico/sf/proc_complemento.jsp | Minas Gerais |
| TJRS | https://www.tjrs.jus.br/novo/consultas/processos/ | Rio Grande do Sul |
| TJPR | https://portal.tjpr.jus.br/projudi/ | Parana |
| TJSC | https://esaj.tjsc.jus.br/cpopg/open.do | Santa Catarina |

### Tribunais Regionais Federais (TRF)
| Tribunal | URL | Regiao |
|----------|-----|--------|
| TRF1 | https://processual.trf1.jus.br/consultaProcessual/ | 1a Regiao |
| TRF2 | https://eproc.trf2.jus.br/eproc/externo_controlador.php | 2a Regiao |
| TRF3 | https://pje1g.trf3.jus.br/pje/ConsultaPublica/ | 3a Regiao |
| TRF4 | https://consulta.trf4.jus.br/trf4/controlador.php | 4a Regiao |
| TRF5 | https://pje.trf5.jus.br/pje/ConsultaPublica/ | 5a Regiao |

### CNJ - Consulta Unificada
| Sistema | URL | Descricao |
|---------|-----|-----------|
| DataJud | https://datajud-wiki.cnj.jus.br/ | Base de dados unificada do CNJ |
| Justica em Numeros | https://www.cnj.jus.br/pesquisas-judiciarias/justica-em-numeros/ | Estatisticas |

## Ferramentas Disponiveis

### 1. `consultar_processo`

Retorna instrucoes de navegacao para consultar um processo especifico pelo numero NPU.

**Parametros:**
- `tribunal` (obrigatorio): Sigla do tribunal (ex: "tjsp", "stj", "trf3")
- `numeroProcesso` (obrigatorio): Numero do processo no formato NPU ou apenas digitos

**Exemplo:**
```json
{
  "tribunal": "tjsp",
  "numeroProcesso": "1000000-00.2024.8.26.0100"
}
```

**Retorno:** Instrucoes de navegacao para consultar o processo no site do TJSP.

### 2. `pesquisar_processos`

Retorna instrucoes de navegacao para pesquisar processos por criterios.

**Parametros:**
- `tribunal` (obrigatorio): Sigla do tribunal
- `nomeParte` (opcional): Nome da parte (autor, reu, etc.)
- `cpfCnpj` (opcional): CPF ou CNPJ da parte
- `numeroOab` (opcional): Numero da OAB do advogado

**Exemplo:**
```json
{
  "tribunal": "tjrj",
  "nomeParte": "Joao da Silva"
}
```

### 3. `listar_movimentacoes`

Retorna instrucoes de navegacao para listar os andamentos de um processo.

**Parametros:**
- `tribunal` (obrigatorio): Sigla do tribunal
- `numeroProcesso` (obrigatorio): Numero do processo

### 4. `listar_tribunais`

Lista todos os tribunais disponiveis para consulta com suas URLs.

**Parametros:**
- `filtro` (opcional): Filtrar por tipo - "superiores", "trf", "tj", "trt", "tre" ou "todos"

## Formato NPU (Numeracao Unica de Processo)

O numero unificado do processo segue o padrao:

```
NNNNNNN-DD.AAAA.J.TR.OOOO
```

Onde:
- `NNNNNNN`: Numero sequencial (7 digitos)
- `DD`: Digito verificador (2 digitos)
- `AAAA`: Ano do ajuizamento (4 digitos)
- `J`: Segmento do Judiciario (1 digito)
- `TR`: Tribunal (2 digitos)
- `OOOO`: Origem (4 digitos)

**Exemplo:** `0001234-56.2024.8.26.0100`

### Segmentos do Judiciario (digito J)
- `1` - Supremo Tribunal Federal
- `2` - Conselho Nacional de Justica
- `3` - Superior Tribunal de Justica
- `4` - Justica Federal
- `5` - Justica do Trabalho
- `6` - Justica Eleitoral
- `7` - Justica Militar da Uniao
- `8` - Justica Estadual
- `9` - Justica Militar Estadual

## Formato de Resposta

Todas as ferramentas retornam um objeto JSON com instrucoes de navegacao:

```json
{
  "tipo": "instrucoes_navegacao",
  "descricao": "Consulta do processo 0001234-56.2024.8.26.0100 no TJSP",
  "urls_sugeridas": [
    {
      "url": "https://esaj.tjsp.jus.br/cpopg/open.do",
      "descricao": "Pagina de consulta processual do TJSP",
      "prioridade": 1
    }
  ],
  "passos": [
    "1. Navegue ate a pagina de consulta do TJSP",
    "2. Localize o campo de numero do processo",
    "3. Preencha com o numero: 0001234-56.2024.8.26.0100",
    "4. Clique no botao de consultar/pesquisar",
    "5. Aguarde os resultados carregarem"
  ],
  "browser_script_sugerido": {
    "actions": [
      {"action": "goto", "url": "https://esaj.tjsp.jus.br/cpopg/open.do"},
      {"action": "waitForLoad"},
      {"action": "findAndFill", "selector": "input[name='numeroProcesso'], #numeroProcesso", "text": "0001234-56.2024.8.26.0100"},
      {"action": "findAndClick", "selector": "button[type='submit'], input[type='submit'], .btn-pesquisar"},
      {"action": "waitForNavigation"},
      {"action": "snapshot"}
    ]
  },
  "seletores_uteis": {
    "campo_processo": "input[name='numeroProcesso'], #numeroProcesso, #numProcesso",
    "botao_buscar": "button[type='submit'], input[type='submit'], .btn-pesquisar"
  },
  "dicas": [
    "O TJSP usa o sistema e-SAJ",
    "Alguns processos podem estar em segredo de justica",
    "Se o processo nao for encontrado, verifique o numero e o tribunal"
  ]
}
```

## Como Usar com dev-browser

### Exemplo: Consultar Processo no TJSP

1. Chamar `consultar_processo(tribunal="tjsp", numeroProcesso="1000000-00.2024.8.26.0100")`
2. Receber instrucoes com URLs e passos
3. Usar `browser_script` com as acoes sugeridas
4. Analisar o snapshot para extrair os dados do processo

### Exemplo: Pesquisar por Nome da Parte

1. Chamar `pesquisar_processos(tribunal="tjrj", nomeParte="Joao da Silva")`
2. Usar as instrucoes para navegar ate o site do TJRJ
3. Preencher o formulario de busca por nome
4. Extrair a lista de processos encontrados

## Tratamento de Captchas

Muitos sites de tribunais possuem captchas. Quando encontrar um captcha:

1. Use `browser_screenshot` para mostrar a tela ao usuario
2. Solicite ao usuario para resolver o captcha manualmente
3. Apos o usuario confirmar, continue com a automacao

## Execucao Local

```bash
# Instalar dependencias
npm install

# Executar em modo desenvolvimento
npm start

# Compilar para producao
npm run build
```

## Referencias

- [CNJ - Numeracao Unica](https://www.cnj.jus.br/programas-e-acoes/numeracao-unica/)
- [DataJud Wiki](https://datajud-wiki.cnj.jus.br/)
- [Justica em Numeros](https://www.cnj.jus.br/pesquisas-judiciarias/justica-em-numeros/)
