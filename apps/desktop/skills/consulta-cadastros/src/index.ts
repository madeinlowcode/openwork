#!/usr/bin/env node
/**
 * @skill consulta-cadastros
 * @description MCP Server para consulta de cadastros (CNPJ, CEP) via navegador e validacao local de CPF/CNPJ
 *
 * Este servidor combina duas abordagens:
 * 1. Validacao LOCAL de CPF e CNPJ (algoritmo de digitos verificadores)
 * 2. Instrucoes de navegacao para consultar dados via dev-browser
 *
 * AIDEV-NOTE: A validacao de CPF/CNPJ funciona offline.
 * Para consultas de dados (CNPJ na Receita, CEP), retorna instrucoes de navegacao.
 *
 * @dependencies
 * - @modelcontextprotocol/sdk (Server, StdioServerTransport)
 * - zod (validacao de schemas)
 *
 * @relatedFiles
 * - apps/desktop/skills/dev-browser/SKILL.md (skill de navegador)
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

// ============================================================================
// AIDEV-NOTE: Configuracao de URLs para consultas de cadastros
// ============================================================================

const SITES_CONSULTA = {
  cnpj: {
    receita: {
      url: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp',
      nome: 'Receita Federal',
      descricao: 'Consulta oficial de CNPJ na Receita Federal',
      tem_captcha: true,
    },
    sintegra: {
      url: 'http://www.sintegra.gov.br/',
      nome: 'SINTEGRA',
      descricao: 'Sistema Integrado de Informacoes sobre Operacoes Interestaduais',
      tem_captcha: true,
    },
    casaCivil: {
      url: 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor',
      nome: 'Portal do Empreendedor',
      descricao: 'Portal do Governo para empresas',
      tem_captcha: false,
    },
  },
  cep: {
    correios: {
      url: 'https://buscacepinter.correios.com.br/app/endereco/index.php',
      nome: 'Correios',
      descricao: 'Busca CEP oficial dos Correios',
      tem_captcha: false,
    },
    viaCep: {
      url: 'https://viacep.com.br/',
      nome: 'ViaCEP',
      descricao: 'Servico alternativo de busca de CEP',
      tem_captcha: false,
    },
  },
};

// ============================================================================
// AIDEV-NOTE: Funcoes de validacao local de documentos
// ============================================================================

/**
 * @function validarCPF
 * @description Valida um CPF matematicamente usando o algoritmo oficial
 * AIDEV-NOTE: Esta validacao e LOCAL e nao consulta nenhuma base de dados
 */
function validarCPF(cpf: string): { valido: boolean; cpfFormatado: string; motivo?: string } {
  // Remover caracteres nao numericos
  const cpfLimpo = cpf.replace(/\D/g, '');
  
  // Verificar se tem 11 digitos
  if (cpfLimpo.length !== 11) {
    return {
      valido: false,
      cpfFormatado: cpf,
      motivo: 'CPF deve conter exatamente 11 digitos',
    };
  }
  
  // Verificar se todos os digitos sao iguais (CPF invalido)
  if (/^(\d)\1{10}$/.test(cpfLimpo)) {
    return {
      valido: false,
      cpfFormatado: formatarCPF(cpfLimpo),
      motivo: 'CPF com todos os digitos iguais e invalido',
    };
  }
  
  // Calcular primeiro digito verificador
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
      motivo: 'Primeiro digito verificador invalido',
    };
  }
  
  // Calcular segundo digito verificador
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
      motivo: 'Segundo digito verificador invalido',
    };
  }
  
  return {
    valido: true,
    cpfFormatado: formatarCPF(cpfLimpo),
  };
}

/**
 * @function validarCNPJ
 * @description Valida um CNPJ matematicamente usando o algoritmo oficial
 * AIDEV-NOTE: Esta validacao e LOCAL e nao consulta nenhuma base de dados
 */
function validarCNPJ(cnpj: string): { valido: boolean; cnpjFormatado: string; motivo?: string } {
  // Remover caracteres nao numericos
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  
  // Verificar se tem 14 digitos
  if (cnpjLimpo.length !== 14) {
    return {
      valido: false,
      cnpjFormatado: cnpj,
      motivo: 'CNPJ deve conter exatamente 14 digitos',
    };
  }
  
  // Verificar se todos os digitos sao iguais (CNPJ invalido)
  if (/^(\d)\1{13}$/.test(cnpjLimpo)) {
    return {
      valido: false,
      cnpjFormatado: formatarCNPJ(cnpjLimpo),
      motivo: 'CNPJ com todos os digitos iguais e invalido',
    };
  }
  
  // Pesos para calculo do primeiro digito
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
      motivo: 'Primeiro digito verificador invalido',
    };
  }
  
  // Pesos para calculo do segundo digito
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
      motivo: 'Segundo digito verificador invalido',
    };
  }
  
  return {
    valido: true,
    cnpjFormatado: formatarCNPJ(cnpjLimpo),
  };
}

/**
 * @function formatarCPF
 * @description Formata CPF com pontuacao
 */
function formatarCPF(cpf: string): string {
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11) return cpf;
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
}

/**
 * @function formatarCNPJ
 * @description Formata CNPJ com pontuacao
 */
function formatarCNPJ(cnpj: string): string {
  const limpo = cnpj.replace(/\D/g, '');
  if (limpo.length !== 14) return cnpj;
  return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12)}`;
}

/**
 * @function formatarCEP
 * @description Formata CEP com hifen
 */
function formatarCEP(cep: string): string {
  const limpo = cep.replace(/\D/g, '');
  if (limpo.length !== 8) return cep;
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
}

// ============================================================================
// AIDEV-NOTE: Interfaces para respostas
// ============================================================================

interface UrlSugerida {
  url: string;
  descricao: string;
  prioridade: number;
  tem_captcha?: boolean;
}

interface BrowserAction {
  action: string;
  url?: string;
  selector?: string;
  text?: string;
  pressEnter?: boolean;
  skipIfNotFound?: boolean;
  timeout?: number;
}

interface InstrucoesNavegacao {
  tipo: 'instrucoes_navegacao';
  descricao: string;
  validacao_previa?: {
    valido: boolean;
    documento_formatado: string;
    motivo?: string;
  };
  urls_sugeridas: UrlSugerida[];
  passos: string[];
  browser_script_sugerido?: {
    actions: BrowserAction[];
  };
  seletores_uteis?: Record<string, string>;
  dicas: string[];
}

interface ResultadoValidacao {
  tipo: 'validacao_local';
  documento: 'CPF' | 'CNPJ';
  numero_formatado: string;
  valido: boolean;
  mensagem: string;
  motivo?: string;
  aviso: string;
}

// ============================================================================
// AIDEV-NOTE: Funcoes geradoras de instrucoes de navegacao
// ============================================================================

/**
 * @function criarInstrucoesConsultaCNPJ
 * @description Cria instrucoes para consultar CNPJ na Receita Federal
 */
function criarInstrucoesConsultaCNPJ(cnpj: string): InstrucoesNavegacao {
  const validacao = validarCNPJ(cnpj);
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Consulta do CNPJ ${validacao.cnpjFormatado} na Receita Federal`,
    validacao_previa: {
      valido: validacao.valido,
      documento_formatado: validacao.cnpjFormatado,
      motivo: validacao.motivo,
    },
    urls_sugeridas: [
      {
        url: SITES_CONSULTA.cnpj.receita.url,
        descricao: SITES_CONSULTA.cnpj.receita.descricao,
        prioridade: 1,
        tem_captcha: SITES_CONSULTA.cnpj.receita.tem_captcha,
      },
      {
        url: `https://www.google.com/search?q=CNPJ+${cnpjLimpo}`,
        descricao: 'Busca no Google como alternativa',
        prioridade: 2,
        tem_captcha: false,
      },
    ],
    passos: validacao.valido ? [
      `1. Navegue ate a pagina de consulta da Receita Federal`,
      `2. Localize o campo de CNPJ`,
      `3. Preencha com o numero: ${validacao.cnpjFormatado}`,
      `4. Resolva o captcha (use browser_screenshot e peca ao usuario)`,
      `5. Clique no botao de consultar`,
      `6. Aguarde os resultados carregarem`,
      `7. Extraia os dados: razao social, nome fantasia, situacao, endereco, socios`,
    ] : [
      `1. ATENCAO: O CNPJ informado e INVALIDO (${validacao.motivo})`,
      `2. Verifique se o numero foi digitado corretamente`,
      `3. Se o numero estiver correto, nao sera possivel consultar na Receita`,
    ],
    browser_script_sugerido: validacao.valido ? {
      actions: [
        { action: 'goto', url: SITES_CONSULTA.cnpj.receita.url },
        { action: 'waitForLoad', timeout: 15000 },
        { action: 'snapshot' },
        { action: 'findAndFill', selector: 'input[name="cnpj"], #cnpj, input[type="text"]', text: cnpjLimpo, skipIfNotFound: true },
        { action: 'screenshot' }, // Para mostrar o captcha ao usuario
      ],
    } : undefined,
    seletores_uteis: {
      campo_cnpj: 'input[name="cnpj"], #cnpj, input[type="text"]',
      botao_consultar: 'input[type="submit"], button[type="submit"]',
      captcha: 'img[id*="captcha"], #captcha, .captcha',
      resultado: '.dados, table, .resultado',
    },
    dicas: [
      validacao.valido 
        ? 'O CNPJ e matematicamente valido' 
        : `ATENCAO: CNPJ invalido - ${validacao.motivo}`,
      'A Receita Federal usa captcha - sera necessario resolver manualmente',
      'Use browser_screenshot para mostrar o captcha ao usuario',
      'Apos o usuario resolver, continue com browser_click no botao de consultar',
      'Os dados retornados incluem: razao social, situacao cadastral, endereco, socios',
    ],
  };
}

/**
 * @function criarInstrucoesConsultaCEP
 * @description Cria instrucoes para consultar CEP nos Correios
 */
function criarInstrucoesConsultaCEP(cep: string): InstrucoesNavegacao {
  const cepLimpo = cep.replace(/\D/g, '');
  const cepFormatado = formatarCEP(cepLimpo);
  const cepValido = cepLimpo.length === 8;
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Consulta do CEP ${cepFormatado}`,
    validacao_previa: {
      valido: cepValido,
      documento_formatado: cepFormatado,
      motivo: cepValido ? undefined : 'CEP deve conter 8 digitos',
    },
    urls_sugeridas: [
      {
        url: SITES_CONSULTA.cep.correios.url,
        descricao: SITES_CONSULTA.cep.correios.descricao,
        prioridade: 1,
        tem_captcha: false,
      },
      {
        url: `${SITES_CONSULTA.cep.viaCep.url}ws/${cepLimpo}/json/`,
        descricao: 'ViaCEP - Retorna JSON diretamente (acesso direto)',
        prioridade: 2,
        tem_captcha: false,
      },
      {
        url: `https://www.google.com/search?q=CEP+${cepLimpo}`,
        descricao: 'Busca no Google como alternativa',
        prioridade: 3,
        tem_captcha: false,
      },
    ],
    passos: cepValido ? [
      `1. Navegue ate o site dos Correios ou ViaCEP`,
      `2. Se usar Correios: preencha o campo de CEP com ${cepFormatado}`,
      `3. Se usar ViaCEP: acesse a URL direta que retorna JSON`,
      `4. Clique em buscar (Correios) ou extraia o JSON (ViaCEP)`,
      `5. Extraia os dados: logradouro, bairro, cidade, estado`,
    ] : [
      `1. ATENCAO: O CEP informado e INVALIDO (deve ter 8 digitos)`,
      `2. Verifique se o numero foi digitado corretamente`,
    ],
    browser_script_sugerido: cepValido ? {
      actions: [
        { action: 'goto', url: `${SITES_CONSULTA.cep.viaCep.url}ws/${cepLimpo}/json/` },
        { action: 'waitForLoad', timeout: 10000 },
        { action: 'snapshot' },
      ],
    } : undefined,
    seletores_uteis: {
      campo_cep_correios: 'input[name="endereco"], #endereco, input[type="text"]',
      botao_buscar_correios: 'button[type="submit"], input[type="submit"], #btn_pesquisar',
      resultado_correios: '.resultado, table, .dados',
    },
    dicas: [
      cepValido 
        ? 'O formato do CEP esta correto' 
        : `ATENCAO: CEP invalido - deve ter 8 digitos`,
      'O ViaCEP retorna JSON diretamente, sem necessidade de preencher formulario',
      'Use browser_evaluate para extrair o JSON do ViaCEP',
      'Os Correios podem ter interface mais complexa, mas sao a fonte oficial',
    ],
  };
}

/**
 * @function criarResultadoValidacaoCPF
 * @description Cria resultado de validacao de CPF
 */
function criarResultadoValidacaoCPF(cpf: string): ResultadoValidacao {
  const validacao = validarCPF(cpf);
  
  return {
    tipo: 'validacao_local',
    documento: 'CPF',
    numero_formatado: validacao.cpfFormatado,
    valido: validacao.valido,
    mensagem: validacao.valido 
      ? 'CPF matematicamente valido'
      : `CPF invalido: ${validacao.motivo}`,
    motivo: validacao.motivo,
    aviso: 'Esta validacao verifica apenas a estrutura matematica do CPF. NAO confirma se o CPF esta cadastrado na Receita Federal ou pertence a uma pessoa real.',
  };
}

/**
 * @function criarResultadoValidacaoCNPJ
 * @description Cria resultado de validacao de CNPJ
 */
function criarResultadoValidacaoCNPJ(cnpj: string): ResultadoValidacao {
  const validacao = validarCNPJ(cnpj);
  
  return {
    tipo: 'validacao_local',
    documento: 'CNPJ',
    numero_formatado: validacao.cnpjFormatado,
    valido: validacao.valido,
    mensagem: validacao.valido 
      ? 'CNPJ matematicamente valido'
      : `CNPJ invalido: ${validacao.motivo}`,
    motivo: validacao.motivo,
    aviso: 'Esta validacao verifica apenas a estrutura matematica do CNPJ. NAO confirma se o CNPJ esta cadastrado ou ativo na Receita Federal.',
  };
}

// ============================================================================
// AIDEV-NOTE: Schemas de validacao Zod
// ============================================================================

const ConsultarCNPJSchema = z.object({
  cnpj: z.string().describe('CNPJ da empresa (com ou sem formatacao)'),
});

const ConsultarCEPSchema = z.object({
  cep: z.string().describe('CEP para consulta (com ou sem formatacao)'),
});

const ValidarCPFSchema = z.object({
  cpf: z.string().describe('CPF para validar (com ou sem formatacao)'),
});

const ValidarCNPJSchema = z.object({
  cnpj: z.string().describe('CNPJ para validar (com ou sem formatacao)'),
});

// ============================================================================
// AIDEV-NOTE: Servidor MCP
// ============================================================================

const server = new Server(
  {
    name: 'consulta-cadastros',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler para listar as ferramentas disponiveis
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'consultar_cnpj',
        description:
          'Retorna instrucoes de navegacao para consultar dados de uma empresa pelo CNPJ na Receita Federal. ' +
          'Inclui validacao matematica previa do CNPJ. Use as instrucoes com o dev-browser.',
        inputSchema: {
          type: 'object',
          properties: {
            cnpj: {
              type: 'string',
              description: 'CNPJ da empresa (com ou sem formatacao, ex: 00.000.000/0001-00 ou 00000000000100)',
            },
          },
          required: ['cnpj'],
        },
      },
      {
        name: 'consultar_cep',
        description:
          'Retorna instrucoes de navegacao para consultar endereco completo pelo CEP. ' +
          'Inclui URL direta para o ViaCEP que retorna JSON.',
        inputSchema: {
          type: 'object',
          properties: {
            cep: {
              type: 'string',
              description: 'CEP para consulta (com ou sem formatacao, ex: 01310-100 ou 01310100)',
            },
          },
          required: ['cep'],
        },
      },
      {
        name: 'validar_cpf',
        description:
          'Valida matematicamente um CPF usando o algoritmo oficial de digitos verificadores. ' +
          'FUNCIONA OFFLINE. NAO consulta nenhuma base de dados.',
        inputSchema: {
          type: 'object',
          properties: {
            cpf: {
              type: 'string',
              description: 'CPF para validar (com ou sem formatacao, ex: 000.000.000-00 ou 00000000000)',
            },
          },
          required: ['cpf'],
        },
      },
      {
        name: 'validar_cnpj',
        description:
          'Valida matematicamente um CNPJ usando o algoritmo oficial de digitos verificadores. ' +
          'FUNCIONA OFFLINE. NAO consulta nenhuma base de dados.',
        inputSchema: {
          type: 'object',
          properties: {
            cnpj: {
              type: 'string',
              description: 'CNPJ para validar (com ou sem formatacao, ex: 00.000.000/0001-00 ou 00000000000100)',
            },
          },
          required: ['cnpj'],
        },
      },
    ],
  };
});

// Handler para execucao das ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  console.error(`[consulta-cadastros] Executando ferramenta: ${name}`);
  console.error(`[consulta-cadastros] Argumentos:`, JSON.stringify(args));

  try {
    switch (name) {
      case 'consultar_cnpj': {
        const params = ConsultarCNPJSchema.parse(args);
        const instrucoes = criarInstrucoesConsultaCNPJ(params.cnpj);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(instrucoes, null, 2),
            },
          ],
        };
      }

      case 'consultar_cep': {
        const params = ConsultarCEPSchema.parse(args);
        const instrucoes = criarInstrucoesConsultaCEP(params.cep);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(instrucoes, null, 2),
            },
          ],
        };
      }

      case 'validar_cpf': {
        const params = ValidarCPFSchema.parse(args);
        const resultado = criarResultadoValidacaoCPF(params.cpf);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultado, null, 2),
            },
          ],
        };
      }

      case 'validar_cnpj': {
        const params = ValidarCNPJSchema.parse(args);
        const resultado = criarResultadoValidacaoCNPJ(params.cnpj);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultado, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                erro: `Ferramenta desconhecida: ${name}`,
                ferramentas_disponiveis: [
                  'consultar_cnpj',
                  'consultar_cep',
                  'validar_cpf',
                  'validar_cnpj',
                ],
              }),
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
          text: JSON.stringify({
            erro: mensagemErro,
            dica: 'Verifique os parametros e tente novamente',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Iniciar o servidor
async function main() {
  console.error('[consulta-cadastros] Iniciando servidor MCP v2.0 (navegador + validacao local)...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[consulta-cadastros] Servidor MCP conectado e pronto');
  console.error('[consulta-cadastros] MODO: Instrucoes de navegacao + Validacao local');
  console.error('[consulta-cadastros] Ferramentas disponiveis:');
  console.error('[consulta-cadastros]   - consultar_cnpj (navegador)');
  console.error('[consulta-cadastros]   - consultar_cep (navegador)');
  console.error('[consulta-cadastros]   - validar_cpf (local)');
  console.error('[consulta-cadastros]   - validar_cnpj (local)');
}

main().catch((error) => {
  console.error('[consulta-cadastros] Erro fatal:', error);
  process.exit(1);
});
