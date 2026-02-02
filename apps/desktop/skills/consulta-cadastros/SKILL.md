# Skill: Consulta de Cadastros (via Navegador + Validacao Local)

MCP Server para consulta de CNPJ, CEP e validacao de CPF/CNPJ usando navegacao web e validacao local.

## Visao Geral

Este skill combina duas abordagens:

1. **Validacao Local**: Validacao matematica de CPF e CNPJ (funciona offline)
2. **Instrucoes de Navegacao**: URLs e passos para o agente consultar dados via navegador

**IMPORTANTE:** Para consultas que requerem acesso a bases de dados (CNPJ na Receita, CEP nos Correios), o skill retorna instrucoes para o agente usar o **dev-browser**.

## Fontes de Dados

### Consulta de CNPJ
| Site | URL | Descricao |
|------|-----|-----------|
| Receita Federal | https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp | Consulta oficial |
| SINTEGRA | http://www.sintegra.gov.br/ | Consulta por estado |
| Casa Civil | https://www.gov.br/empresas-e-negocios/pt-br/empreendedor | Portal do empreendedor |

### Consulta de CEP
| Site | URL | Descricao |
|------|-----|-----------|
| Correios | https://buscacepinter.correios.com.br/app/endereco/index.php | Busca oficial |
| ViaCEP | https://viacep.com.br/ | API alternativa |

## Ferramentas Disponiveis

### 1. `consultar_cnpj`

Retorna instrucoes de navegacao para consultar dados de uma empresa pelo CNPJ na Receita Federal.

**Parametros:**
- `cnpj` (obrigatorio): CNPJ da empresa (com ou sem formatacao)

**Exemplo:**
```json
{
  "cnpj": "00.000.000/0001-91"
}
```

**Retorno:** 
- Validacao matematica do CNPJ
- Instrucoes de navegacao para a Receita Federal
- URLs alternativas

### 2. `consultar_cep`

Retorna instrucoes de navegacao para consultar endereco pelo CEP.

**Parametros:**
- `cep` (obrigatorio): CEP para consulta (com ou sem formatacao)

**Exemplo:**
```json
{
  "cep": "01310-100"
}
```

### 3. `validar_cpf`

Valida matematicamente um CPF usando o algoritmo oficial de digitos verificadores.

**Parametros:**
- `cpf` (obrigatorio): CPF para validar (com ou sem formatacao)

**Retorno:** Resultado da validacao (valido/invalido) com o motivo.

**IMPORTANTE:** Esta validacao e LOCAL e apenas verifica a estrutura matematica. NAO confirma se o CPF existe na Receita Federal.

### 4. `validar_cnpj`

Valida matematicamente um CNPJ usando o algoritmo oficial de digitos verificadores.

**Parametros:**
- `cnpj` (obrigatorio): CNPJ para validar (com ou sem formatacao)

**Retorno:** Resultado da validacao (valido/invalido) com o motivo.

**IMPORTANTE:** Esta validacao e LOCAL e apenas verifica a estrutura matematica. NAO confirma se o CNPJ esta cadastrado na Receita Federal.

## Algoritmos de Validacao

### CPF (11 digitos)

O CPF e composto por 9 digitos base + 2 digitos verificadores.

**Formato:** `XXX.XXX.XXX-DD`

**Algoritmo:**
1. Rejeitar CPFs com todos os digitos iguais (ex: 111.111.111-11)
2. Calcular primeiro digito verificador:
   - Multiplicar os 9 primeiros digitos pelos pesos 10, 9, 8, 7, 6, 5, 4, 3, 2
   - Somar os produtos
   - Resto = (soma * 10) mod 11
   - Se resto = 10, digito = 0; senao, digito = resto
3. Calcular segundo digito verificador:
   - Multiplicar os 10 primeiros digitos pelos pesos 11, 10, 9, 8, 7, 6, 5, 4, 3, 2
   - Aplicar mesma formula do passo 2

### CNPJ (14 digitos)

O CNPJ e composto por 12 digitos base + 2 digitos verificadores.

**Formato:** `XX.XXX.XXX/XXXX-DD`

**Algoritmo:**
1. Rejeitar CNPJs com todos os digitos iguais
2. Calcular primeiro digito verificador:
   - Multiplicar os 12 primeiros digitos pelos pesos 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2
   - Resto = soma mod 11
   - Se resto < 2, digito = 0; senao, digito = 11 - resto
3. Calcular segundo digito verificador:
   - Multiplicar os 13 primeiros digitos pelos pesos 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2
   - Aplicar mesma formula do passo 2

## Formato de Resposta

### Validacao (Local)
```json
{
  "tipo": "validacao_local",
  "documento": "CPF",
  "numero_formatado": "123.456.789-09",
  "valido": true,
  "mensagem": "CPF matematicamente valido",
  "aviso": "Esta validacao apenas verifica a estrutura. Nao confirma cadastro na Receita."
}
```

### Consulta (Navegador)
```json
{
  "tipo": "instrucoes_navegacao",
  "descricao": "Consulta do CNPJ 00.000.000/0001-91 na Receita Federal",
  "validacao_previa": {
    "valido": true,
    "cnpj_formatado": "00.000.000/0001-91"
  },
  "urls_sugeridas": [
    {
      "url": "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp",
      "descricao": "Consulta CNPJ na Receita Federal (oficial)",
      "prioridade": 1
    }
  ],
  "passos": [...],
  "browser_script_sugerido": {...},
  "dicas": [...]
}
```

## Como Usar com dev-browser

### Exemplo: Consultar CNPJ

1. Chamar `consultar_cnpj(cnpj="00.000.000/0001-91")`
2. Verificar se o CNPJ e matematicamente valido
3. Usar `browser_script` para navegar ate a Receita Federal
4. Preencher o formulario e resolver o captcha
5. Extrair os dados da empresa

### Tratamento de Captchas

A Receita Federal usa captcha. Quando encontrar:

1. Use `browser_screenshot` para mostrar a tela
2. Solicite ao usuario para resolver o captcha
3. Apos confirmar, continue com a extracao dos dados

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

- [Receita Federal - CNPJ](https://www.gov.br/receitafederal/pt-br)
- [Correios - Busca CEP](https://buscacepinter.correios.com.br/)
- [ViaCEP](https://viacep.com.br/)
