# Skill: Consulta de Cadastros (Brasil API)

MCP Server para consulta de CNPJ, CEP e validação de CPF/CNPJ usando a API pública gratuita Brasil API.

## Configuração

**Nenhuma configuração necessária!** A Brasil API é pública e gratuita, sem necessidade de autenticação.

## Ferramentas Disponíveis

### 1. `consultar_cnpj`

Consulta dados completos de uma empresa pelo CNPJ na base da Receita Federal.

**Parâmetros:**
- `cnpj` (obrigatório): CNPJ da empresa (com ou sem formatação)

**Exemplo:**
```json
{
  "cnpj": "00.000.000/0001-91"
}
```

**Retorno:** Dados completos da empresa incluindo:
- Razão social e nome fantasia
- Situação cadastral (Ativa, Baixada, etc.)
- Endereço completo
- Atividades econômicas (CNAE principal e secundários)
- Quadro societário (QSA) com nome e qualificação dos sócios
- Capital social
- Contatos (telefone, e-mail)

---

### 2. `consultar_cep`

Consulta endereço completo pelo CEP.

**Parâmetros:**
- `cep` (obrigatório): CEP para consulta (com ou sem formatação)

**Exemplo:**
```json
{
  "cep": "01310-100"
}
```

**Retorno:**
- Logradouro
- Bairro
- Cidade
- Estado
- Coordenadas geográficas (quando disponíveis)

---

### 3. `validar_cpf`

Valida matematicamente um CPF usando o algoritmo oficial de dígitos verificadores.

**Parâmetros:**
- `cpf` (obrigatório): CPF para validar (com ou sem formatação)

**Exemplo:**
```json
{
  "cpf": "000.000.000-00"
}
```

**Retorno:**
- Status de validação (válido/inválido)
- CPF formatado
- Motivo da invalidação (se aplicável)

> **Importante:** Esta validação apenas verifica a estrutura matemática do CPF. NÃO confirma se o CPF está cadastrado ou pertence a uma pessoa real.

---

### 4. `validar_cnpj`

Valida matematicamente um CNPJ usando o algoritmo oficial de dígitos verificadores.

**Parâmetros:**
- `cnpj` (obrigatório): CNPJ para validar (com ou sem formatação)

**Exemplo:**
```json
{
  "cnpj": "00.000.000/0001-91"
}
```

**Retorno:**
- Status de validação (válido/inválido)
- CNPJ formatado
- Motivo da invalidação (se aplicável)

> **Importante:** Esta validação apenas verifica a estrutura matemática do CNPJ. NÃO confirma se o CNPJ está cadastrado ou ativo na Receita Federal.

---

## Algoritmos de Validação

### CPF (11 dígitos)

O CPF é composto por 9 dígitos base + 2 dígitos verificadores.

**Formato:** `XXX.XXX.XXX-DD`

**Algoritmo:**
1. Rejeitar CPFs com todos os dígitos iguais (ex: 111.111.111-11)
2. Calcular primeiro dígito verificador:
   - Multiplicar os 9 primeiros dígitos pelos pesos 10, 9, 8, 7, 6, 5, 4, 3, 2
   - Somar os produtos
   - Resto = (soma × 10) mod 11
   - Se resto = 10, dígito = 0; senão, dígito = resto
3. Calcular segundo dígito verificador:
   - Multiplicar os 10 primeiros dígitos pelos pesos 11, 10, 9, 8, 7, 6, 5, 4, 3, 2
   - Aplicar mesma fórmula do passo 2

### CNPJ (14 dígitos)

O CNPJ é composto por 12 dígitos base + 2 dígitos verificadores.

**Formato:** `XX.XXX.XXX/XXXX-DD`

**Algoritmo:**
1. Rejeitar CNPJs com todos os dígitos iguais
2. Calcular primeiro dígito verificador:
   - Multiplicar os 12 primeiros dígitos pelos pesos 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2
   - Resto = soma mod 11
   - Se resto < 2, dígito = 0; senão, dígito = 11 - resto
3. Calcular segundo dígito verificador:
   - Multiplicar os 13 primeiros dígitos pelos pesos 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2
   - Aplicar mesma fórmula do passo 2

---

## Exemplos de Uso

### Consultar empresa
```
Qual a situação cadastral e os sócios da empresa CNPJ 00.000.000/0001-91?
```

### Buscar endereço
```
Qual o endereço completo do CEP 01310-100?
```

### Validar documento
```
O CPF 123.456.789-09 é válido?
```

---

## Tratamento de Erros

### Erros Comuns

1. **CNPJ não encontrado:**
   ```
   CNPJ 00.000.000/0001-00 não encontrado na base da Receita Federal
   ```

2. **CEP não encontrado:**
   ```
   CEP 00000-000 não encontrado
   ```

3. **Documento inválido:**
   ```
   CNPJ com todos os dígitos iguais é inválido
   ```

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

## API Utilizada

- **Brasil API:** https://brasilapi.com.br/
- **Endpoint CNPJ:** `GET /api/cnpj/v1/{cnpj}`
- **Endpoint CEP:** `GET /api/cep/v1/{cep}`

A Brasil API é um projeto open source que unifica diversas APIs públicas brasileiras em uma interface simples e gratuita.

---

## Referências

- [Brasil API - Documentação](https://brasilapi.com.br/docs)
- [Brasil API - GitHub](https://github.com/BrasilAPI/BrasilAPI)
- [Receita Federal - CNPJ](https://www.gov.br/receitafederal/pt-br)
