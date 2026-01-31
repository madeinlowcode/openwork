#!/usr/bin/env node
/**
 * MCP Server para consulta de cadastros via Brasil API
 * 
 * Este servidor expõe ferramentas para consultar CNPJ, CEP e validar CPF/CNPJ
 * usando a API pública gratuita do Brasil API (sem autenticação).
 * 
 * API Base: https://brasilapi.com.br/api
 */

console.error('[consulta-cadastros] Script starting...');
console.error('[consulta-cadastros] Node version:', process.version);

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

console.error('[consulta-cadastros] All imports completed successfully');

// Base URL da Brasil API
const BRASIL_API_BASE = 'https://brasilapi.com.br/api';

// ==================== VALIDADORES ====================

/**
 * Valida um CPF matematicamente
 * @param cpf - CPF com ou sem formatação
 * @returns Objeto com resultado da validação
 */
function validarCPF(cpf: string): { valido: boolean; cpfFormatado: string; motivo?: string } {
  // Remover caracteres não numéricos
  const cpfLimpo = cpf.replace(/\D/g, '');
  
  // Verificar se tem 11 dígitos
  if (cpfLimpo.length !== 11) {
    return {
      valido: false,
      cpfFormatado: cpf,
      motivo: 'CPF deve conter exatamente 11 dígitos',
    };
  }
  
  // Verificar se todos os dígitos são iguais (CPF inválido)
  if (/^(\d)\1{10}$/.test(cpfLimpo)) {
    return {
      valido: false,
      cpfFormatado: formatarCPF(cpfLimpo),
      motivo: 'CPF com todos os dígitos iguais é inválido',
    };
  }
  
  // Calcular primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpfLimpo[i]) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  const digito1 = resto === 10 ? 0 : resto;
  
  if (digito1 !== parseInt(cpfLimpo[9])) {
    return {
      valido: false,
      cpfFormatado: formatarCPF(cpfLimpo),
      motivo: 'Primeiro dígito verificador inválido',
    };
  }
  
  // Calcular segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo[i]) * (11 - i);
  }
  resto = (soma * 10) % 11;
  const digito2 = resto === 10 ? 0 : resto;
  
  if (digito2 !== parseInt(cpfLimpo[10])) {
    return {
      valido: false,
      cpfFormatado: formatarCPF(cpfLimpo),
      motivo: 'Segundo dígito verificador inválido',
    };
  }
  
  return {
    valido: true,
    cpfFormatado: formatarCPF(cpfLimpo),
  };
}

/**
 * Valida um CNPJ matematicamente
 * @param cnpj - CNPJ com ou sem formatação
 * @returns Objeto com resultado da validação
 */
function validarCNPJ(cnpj: string): { valido: boolean; cnpjFormatado: string; motivo?: string } {
  // Remover caracteres não numéricos
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  
  // Verificar se tem 14 dígitos
  if (cnpjLimpo.length !== 14) {
    return {
      valido: false,
      cnpjFormatado: cnpj,
      motivo: 'CNPJ deve conter exatamente 14 dígitos',
    };
  }
  
  // Verificar se todos os dígitos são iguais (CNPJ inválido)
  if (/^(\d)\1{13}$/.test(cnpjLimpo)) {
    return {
      valido: false,
      cnpjFormatado: formatarCNPJ(cnpjLimpo),
      motivo: 'CNPJ com todos os dígitos iguais é inválido',
    };
  }
  
  // Pesos para cálculo do primeiro dígito
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(cnpjLimpo[i]) * pesos1[i];
  }
  let resto = soma % 11;
  const digito1 = resto < 2 ? 0 : 11 - resto;
  
  if (digito1 !== parseInt(cnpjLimpo[12])) {
    return {
      valido: false,
      cnpjFormatado: formatarCNPJ(cnpjLimpo),
      motivo: 'Primeiro dígito verificador inválido',
    };
  }
  
  // Pesos para cálculo do segundo dígito
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(cnpjLimpo[i]) * pesos2[i];
  }
  resto = soma % 11;
  const digito2 = resto < 2 ? 0 : 11 - resto;
  
  if (digito2 !== parseInt(cnpjLimpo[13])) {
    return {
      valido: false,
      cnpjFormatado: formatarCNPJ(cnpjLimpo),
      motivo: 'Segundo dígito verificador inválido',
    };
  }
  
  return {
    valido: true,
    cnpjFormatado: formatarCNPJ(cnpjLimpo),
  };
}

/**
 * Formata CPF com pontuação
 */
function formatarCPF(cpf: string): string {
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11) return cpf;
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
}

/**
 * Formata CNPJ com pontuação
 */
function formatarCNPJ(cnpj: string): string {
  const limpo = cnpj.replace(/\D/g, '');
  if (limpo.length !== 14) return cnpj;
  return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12)}`;
}

/**
 * Formata CEP com hífen
 */
function formatarCEP(cep: string): string {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) return cep;
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
}

// ==================== CLIENTE BRASIL API ====================

interface CNPJResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string;
  data_situacao_cadastral: string;
  motivo_situacao_cadastral: string | null;
  data_inicio_atividade: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: Array<{
    codigo: number;
    descricao: string;
  }>;
  tipo: string;
  porte: string;
  natureza_juridica: string;
  capital_social: number;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string | null;
  ddd_telefone_2: string | null;
  email: string | null;
  qsa: Array<{
    identificador_de_socio: number;
    nome_socio: string;
    cnpj_cpf_do_socio: string;
    codigo_qualificacao_socio: number;
    qualificacao_socio: string;
    data_entrada_sociedade: string;
    percentual_capital_social: number | null;
    faixa_etaria?: string;
    codigo_pais?: number | null;
    nome_pais?: string | null;
    cpf_representante_legal?: string;
    nome_representante_legal?: string;
    codigo_qualificacao_representante_legal?: number | null;
  }>;
}

interface CEPResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
  location?: {
    type: string;
    coordinates: {
      longitude: string;
      latitude: string;
    };
  };
}

async function consultarCNPJ(cnpj: string): Promise<CNPJResponse> {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  
  const response = await fetch(`${BRASIL_API_BASE}/cnpj/v1/${cnpjLimpo}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`CNPJ ${formatarCNPJ(cnpjLimpo)} não encontrado na base da Receita Federal`);
    }
    throw new Error(`Erro na API Brasil: ${response.status} ${response.statusText}`);
  }
  
  return response.json() as Promise<CNPJResponse>;
}

async function consultarCEP(cep: string): Promise<CEPResponse> {
  const cepLimpo = cep.replace(/\D/g, '');
  
  const response = await fetch(`${BRASIL_API_BASE}/cep/v1/${cepLimpo}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`CEP ${formatarCEP(cepLimpo)} não encontrado`);
    }
    throw new Error(`Erro na API Brasil: ${response.status} ${response.statusText}`);
  }
  
  return response.json() as Promise<CEPResponse>;
}

// ==================== SCHEMAS ZOD ====================

const ConsultarCNPJSchema = z.object({
  cnpj: z.string().describe('CNPJ da empresa (com ou sem formatação)'),
});

const ConsultarCEPSchema = z.object({
  cep: z.string().describe('CEP para consulta (com ou sem formatação)'),
});

const ValidarCPFSchema = z.object({
  cpf: z.string().describe('CPF para validar (com ou sem formatação)'),
});

const ValidarCNPJSchema = z.object({
  cnpj: z.string().describe('CNPJ para validar (com ou sem formatação)'),
});

// ==================== SERVIDOR MCP ====================

const server = new Server(
  {
    name: 'consulta-cadastros',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler para listar as ferramentas disponíveis
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'consultar_cnpj',
        description:
          'Consulta dados de uma empresa pelo CNPJ na base da Receita Federal via Brasil API. ' +
          'Retorna razão social, nome fantasia, situação cadastral, endereço completo, ' +
          'atividades econômicas (CNAE), quadro societário (QSA) e capital social.',
        inputSchema: {
          type: 'object',
          properties: {
            cnpj: {
              type: 'string',
              description: 'CNPJ da empresa (com ou sem formatação, ex: 00.000.000/0001-00 ou 00000000000100)',
            },
          },
          required: ['cnpj'],
        },
      },
      {
        name: 'consultar_cep',
        description:
          'Consulta endereço completo pelo CEP via Brasil API. ' +
          'Retorna logradouro, bairro, cidade, estado e coordenadas (quando disponíveis).',
        inputSchema: {
          type: 'object',
          properties: {
            cep: {
              type: 'string',
              description: 'CEP para consulta (com ou sem formatação, ex: 01310-100 ou 01310100)',
            },
          },
          required: ['cep'],
        },
      },
      {
        name: 'validar_cpf',
        description:
          'Valida matematicamente um CPF usando o algoritmo oficial de dígitos verificadores. ' +
          'NÃO consulta nenhuma base de dados, apenas verifica se o número é matematicamente válido.',
        inputSchema: {
          type: 'object',
          properties: {
            cpf: {
              type: 'string',
              description: 'CPF para validar (com ou sem formatação, ex: 000.000.000-00 ou 00000000000)',
            },
          },
          required: ['cpf'],
        },
      },
      {
        name: 'validar_cnpj',
        description:
          'Valida matematicamente um CNPJ usando o algoritmo oficial de dígitos verificadores. ' +
          'NÃO consulta nenhuma base de dados, apenas verifica se o número é matematicamente válido.',
        inputSchema: {
          type: 'object',
          properties: {
            cnpj: {
              type: 'string',
              description: 'CNPJ para validar (com ou sem formatação, ex: 00.000.000/0001-00 ou 00000000000100)',
            },
          },
          required: ['cnpj'],
        },
      },
    ],
  };
});

// Handler para execução das ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  console.error(`[consulta-cadastros] Executando ferramenta: ${name}`);
  console.error(`[consulta-cadastros] Argumentos:`, JSON.stringify(args));

  try {
    switch (name) {
      case 'consultar_cnpj': {
        const params = ConsultarCNPJSchema.parse(args);
        
        // Primeiro valida o CNPJ
        const validacao = validarCNPJ(params.cnpj);
        if (!validacao.valido) {
          return {
            content: [
              {
                type: 'text',
                text: formatarRespostaCNPJInvalido(validacao),
              },
            ],
          };
        }
        
        const dados = await consultarCNPJ(params.cnpj);
        
        return {
          content: [
            {
              type: 'text',
              text: formatarRespostaCNPJ(dados),
            },
          ],
        };
      }

      case 'consultar_cep': {
        const params = ConsultarCEPSchema.parse(args);
        const cepLimpo = params.cep.replace(/\D/g, '');
        
        if (cepLimpo.length !== 8) {
          return {
            content: [
              {
                type: 'text',
                text: `## Erro na Consulta de CEP\n\n**CEP informado:** ${params.cep}\n\n**Motivo:** CEP deve conter exatamente 8 dígitos.`,
              },
            ],
            isError: true,
          };
        }
        
        const dados = await consultarCEP(params.cep);
        
        return {
          content: [
            {
              type: 'text',
              text: formatarRespostaCEP(dados),
            },
          ],
        };
      }

      case 'validar_cpf': {
        const params = ValidarCPFSchema.parse(args);
        const resultado = validarCPF(params.cpf);
        
        return {
          content: [
            {
              type: 'text',
              text: formatarRespostaValidacaoCPF(resultado),
            },
          ],
        };
      }

      case 'validar_cnpj': {
        const params = ValidarCNPJSchema.parse(args);
        const resultado = validarCNPJ(params.cnpj);
        
        return {
          content: [
            {
              type: 'text',
              text: formatarRespostaValidacaoCNPJ(resultado),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `## Erro\n\nFerramenta desconhecida: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`[consulta-cadastros] Erro:`, error);

    const mensagemErro = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: `## Erro na Consulta\n\n**Mensagem:** ${mensagemErro}`,
        },
      ],
      isError: true,
    };
  }
});

// ==================== FORMATADORES ====================

function formatarRespostaCNPJ(dados: CNPJResponse): string {
  const linhas: string[] = [];
  
  linhas.push('## Dados da Empresa');
  linhas.push('');
  linhas.push(`**CNPJ:** ${formatarCNPJ(dados.cnpj)}`);
  linhas.push(`**Razão Social:** ${dados.razao_social}`);
  if (dados.nome_fantasia) {
    linhas.push(`**Nome Fantasia:** ${dados.nome_fantasia}`);
  }
  linhas.push('');
  
  linhas.push('### Situação Cadastral');
  linhas.push(`- **Status:** ${dados.situacao_cadastral}`);
  linhas.push(`- **Data:** ${formatarData(dados.data_situacao_cadastral)}`);
  if (dados.motivo_situacao_cadastral) {
    linhas.push(`- **Motivo:** ${dados.motivo_situacao_cadastral}`);
  }
  linhas.push('');
  
  linhas.push('### Informações Gerais');
  linhas.push(`- **Tipo:** ${dados.tipo}`);
  linhas.push(`- **Porte:** ${dados.porte}`);
  linhas.push(`- **Natureza Jurídica:** ${dados.natureza_juridica}`);
  linhas.push(`- **Capital Social:** ${formatarMoeda(dados.capital_social)}`);
  linhas.push(`- **Data de Abertura:** ${formatarData(dados.data_inicio_atividade)}`);
  linhas.push('');
  
  linhas.push('### Endereço');
  const endereco = [
    dados.logradouro,
    dados.numero,
    dados.complemento,
  ].filter(Boolean).join(', ');
  linhas.push(`- **Logradouro:** ${endereco}`);
  linhas.push(`- **Bairro:** ${dados.bairro}`);
  linhas.push(`- **Cidade/UF:** ${dados.municipio}/${dados.uf}`);
  linhas.push(`- **CEP:** ${formatarCEP(dados.cep)}`);
  linhas.push('');
  
  linhas.push('### Contato');
  if (dados.ddd_telefone_1) {
    linhas.push(`- **Telefone 1:** ${dados.ddd_telefone_1}`);
  }
  if (dados.ddd_telefone_2) {
    linhas.push(`- **Telefone 2:** ${dados.ddd_telefone_2}`);
  }
  if (dados.email) {
    linhas.push(`- **E-mail:** ${dados.email}`);
  }
  if (!dados.ddd_telefone_1 && !dados.ddd_telefone_2 && !dados.email) {
    linhas.push('- *Nenhum contato cadastrado*');
  }
  linhas.push('');
  
  linhas.push('### Atividade Econômica Principal (CNAE)');
  linhas.push(`- **Código:** ${dados.cnae_fiscal}`);
  linhas.push(`- **Descrição:** ${dados.cnae_fiscal_descricao}`);
  linhas.push('');
  
  if (dados.cnaes_secundarios && dados.cnaes_secundarios.length > 0) {
    linhas.push('### Atividades Secundárias');
    dados.cnaes_secundarios.slice(0, 10).forEach((cnae) => {
      linhas.push(`- **${cnae.codigo}:** ${cnae.descricao}`);
    });
    if (dados.cnaes_secundarios.length > 10) {
      linhas.push(`- *... e mais ${dados.cnaes_secundarios.length - 10} atividades*`);
    }
    linhas.push('');
  }
  
  if (dados.qsa && dados.qsa.length > 0) {
    linhas.push('### Quadro Societário (QSA)');
    linhas.push('');
    dados.qsa.forEach((socio, index) => {
      linhas.push(`**${index + 1}. ${socio.nome_socio}**`);
      linhas.push(`   - Qualificação: ${socio.qualificacao_socio}`);
      if (socio.percentual_capital_social) {
        linhas.push(`   - Participação: ${socio.percentual_capital_social}%`);
      }
      linhas.push(`   - Entrada: ${formatarData(socio.data_entrada_sociedade)}`);
    });
    linhas.push('');
  }
  
  linhas.push('---');
  linhas.push('*Dados obtidos via Brasil API (Receita Federal)*');
  
  return linhas.join('\n');
}

function formatarRespostaCNPJInvalido(validacao: { valido: boolean; cnpjFormatado: string; motivo?: string }): string {
  return `## CNPJ Inválido

**CNPJ informado:** ${validacao.cnpjFormatado}

**Motivo:** ${validacao.motivo}

O CNPJ informado não passou na validação matemática dos dígitos verificadores. Verifique se o número foi digitado corretamente.`;
}

function formatarRespostaCEP(dados: CEPResponse): string {
  const linhas: string[] = [];
  
  linhas.push('## Endereço');
  linhas.push('');
  linhas.push(`**CEP:** ${formatarCEP(dados.cep)}`);
  linhas.push('');
  if (dados.street) {
    linhas.push(`- **Logradouro:** ${dados.street}`);
  }
  if (dados.neighborhood) {
    linhas.push(`- **Bairro:** ${dados.neighborhood}`);
  }
  linhas.push(`- **Cidade:** ${dados.city}`);
  linhas.push(`- **Estado:** ${dados.state}`);
  
  if (dados.location?.coordinates) {
    linhas.push('');
    linhas.push('### Coordenadas');
    linhas.push(`- **Latitude:** ${dados.location.coordinates.latitude}`);
    linhas.push(`- **Longitude:** ${dados.location.coordinates.longitude}`);
  }
  
  linhas.push('');
  linhas.push('---');
  linhas.push(`*Dados obtidos via Brasil API (${dados.service})*`);
  
  return linhas.join('\n');
}

function formatarRespostaValidacaoCPF(resultado: { valido: boolean; cpfFormatado: string; motivo?: string }): string {
  if (resultado.valido) {
    return `## Validação de CPF

**CPF:** ${resultado.cpfFormatado}

**Resultado:** Válido

O CPF informado é matematicamente válido de acordo com o algoritmo de dígitos verificadores.

> **Nota:** Esta validação apenas verifica a estrutura matemática do CPF. Não confirma se o CPF está cadastrado ou ativo na Receita Federal.`;
  }
  
  return `## Validação de CPF

**CPF:** ${resultado.cpfFormatado}

**Resultado:** Inválido

**Motivo:** ${resultado.motivo}`;
}

function formatarRespostaValidacaoCNPJ(resultado: { valido: boolean; cnpjFormatado: string; motivo?: string }): string {
  if (resultado.valido) {
    return `## Validação de CNPJ

**CNPJ:** ${resultado.cnpjFormatado}

**Resultado:** Válido

O CNPJ informado é matematicamente válido de acordo com o algoritmo de dígitos verificadores.

> **Nota:** Esta validação apenas verifica a estrutura matemática do CNPJ. Não confirma se o CNPJ está cadastrado ou ativo na Receita Federal.`;
  }
  
  return `## Validação de CNPJ

**CNPJ:** ${resultado.cnpjFormatado}

**Resultado:** Inválido

**Motivo:** ${resultado.motivo}`;
}

function formatarData(data: string): string {
  if (!data) return 'N/A';
  try {
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return data;
  }
}

function formatarMoeda(valor: number): string {
  if (valor === null || valor === undefined) return 'N/A';
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// ==================== INICIALIZAÇÃO ====================

async function main() {
  console.error('[consulta-cadastros] Iniciando servidor MCP...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[consulta-cadastros] Servidor MCP conectado e pronto');
  console.error('[consulta-cadastros] Ferramentas disponíveis:');
  console.error('[consulta-cadastros]   - consultar_cnpj');
  console.error('[consulta-cadastros]   - consultar_cep');
  console.error('[consulta-cadastros]   - validar_cpf');
  console.error('[consulta-cadastros]   - validar_cnpj');
}

main().catch((error) => {
  console.error('[consulta-cadastros] Erro fatal:', error);
  process.exit(1);
});
