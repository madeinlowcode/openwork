#!/usr/bin/env node
/**
 * @skill consulta-processos
 * @description MCP Server para consulta de processos judiciais via navegador web
 *
 * Este servidor retorna INSTRUCOES DE NAVEGACAO para o agente usar o dev-browser
 * para buscar processos judiciais nos sites dos tribunais brasileiros.
 *
 * AIDEV-NOTE: Esta skill NAO faz chamadas de API diretamente.
 * Ela gera instrucoes para o agente usar browser_script/browser_navigate.
 *
 * @dependencies
 * - @modelcontextprotocol/sdk (Server, StdioServerTransport)
 * - zod (validacao de schemas)
 *
 * @relatedFiles
 * - apps/desktop/skills/dev-browser/SKILL.md (skill de navegador)
 * - apps/desktop/skills/dev-browser-mcp/src/index.ts (implementacao do navegador)
 */

console.error('[consulta-processos] Script starting...');
console.error('[consulta-processos] Node version:', process.version);

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

console.error('[consulta-processos] All imports completed successfully');

// ============================================================================
// AIDEV-NOTE: Configuracao de URLs dos tribunais brasileiros
// ============================================================================

/**
 * @constant TRIBUNAIS
 * @description Mapeamento completo dos tribunais brasileiros com URLs de consulta
 * AIDEV-WARNING: URLs podem mudar - verificar periodicamente
 */
const TRIBUNAIS = {
  // Tribunais Superiores
  stf: {
    nome: 'Supremo Tribunal Federal',
    sigla: 'STF',
    tipo: 'superiores',
    url_consulta: 'https://portal.stf.jus.br/processos/',
    url_base: 'https://portal.stf.jus.br/',
    sistema: 'Portal STF',
    seletores: {
      campo_processo: 'input[name="classe"], input[name="numero"], #numeroProcesso',
      botao_buscar: 'button[type="submit"], input[type="submit"]',
      resultados: '.processo, .resultado, table tbody tr',
    },
  },
  stj: {
    nome: 'Superior Tribunal de Justica',
    sigla: 'STJ',
    tipo: 'superiores',
    url_consulta: 'https://processo.stj.jus.br/processo/pesquisa/',
    url_base: 'https://www.stj.jus.br/',
    sistema: 'Portal STJ',
    seletores: {
      campo_processo: 'input[name="num_registro"], #num_registro',
      botao_buscar: 'button[type="submit"], input[type="submit"], .btn-pesquisar',
      resultados: '.processo, .resultado',
    },
  },
  tst: {
    nome: 'Tribunal Superior do Trabalho',
    sigla: 'TST',
    tipo: 'superiores',
    url_consulta: 'https://consultaprocessual.tst.jus.br/',
    url_base: 'https://www.tst.jus.br/',
    sistema: 'Consulta Processual TST',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"], input[type="submit"]',
      resultados: '.processo, .resultado',
    },
  },
  tse: {
    nome: 'Tribunal Superior Eleitoral',
    sigla: 'TSE',
    tipo: 'superiores',
    url_consulta: 'https://www.tse.jus.br/servicos-judiciais/processos',
    url_base: 'https://www.tse.jus.br/',
    sistema: 'Portal TSE',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"]',
      resultados: '.processo, .resultado',
    },
  },
  stm: {
    nome: 'Superior Tribunal Militar',
    sigla: 'STM',
    tipo: 'superiores',
    url_consulta: 'https://www.stm.jus.br/servicos-stm/processos',
    url_base: 'https://www.stm.jus.br/',
    sistema: 'Portal STM',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"]',
      botao_buscar: 'button[type="submit"]',
      resultados: '.processo',
    },
  },

  // Tribunais Regionais Federais
  trf1: {
    nome: 'Tribunal Regional Federal da 1a Regiao',
    sigla: 'TRF1',
    tipo: 'trf',
    url_consulta: 'https://processual.trf1.jus.br/consultaProcessual/',
    url_base: 'https://www.trf1.jus.br/',
    sistema: 'Consulta Processual TRF1',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"], #btnConsultar',
      resultados: '.processo, table tbody tr',
    },
  },
  trf2: {
    nome: 'Tribunal Regional Federal da 2a Regiao',
    sigla: 'TRF2',
    tipo: 'trf',
    url_consulta: 'https://eproc.trf2.jus.br/eproc/externo_controlador.php?acao=processo_consulta_publica',
    url_base: 'https://www.trf2.jus.br/',
    sistema: 'e-Proc TRF2',
    seletores: {
      campo_processo: 'input[name="txtNumProcesso"], #txtNumProcesso',
      botao_buscar: 'button[type="submit"], #btnPesquisar',
      resultados: '.infraTable, table tbody tr',
    },
  },
  trf3: {
    nome: 'Tribunal Regional Federal da 3a Regiao',
    sigla: 'TRF3',
    tipo: 'trf',
    url_consulta: 'https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam',
    url_base: 'https://www.trf3.jus.br/',
    sistema: 'PJe TRF3',
    seletores: {
      campo_processo: 'input[name*="numeroProcesso"], #fPP\\:numProcesso-inputNumeroProcessoDecoration\\:numProcesso-inputNumeroProcesso',
      botao_buscar: 'button[type="submit"], input[value="Pesquisar"]',
      resultados: '.rich-table, table tbody tr',
    },
  },
  trf4: {
    nome: 'Tribunal Regional Federal da 4a Regiao',
    sigla: 'TRF4',
    tipo: 'trf',
    url_consulta: 'https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_pesquisar',
    url_base: 'https://www.trf4.jus.br/',
    sistema: 'Consulta TRF4',
    seletores: {
      campo_processo: 'input[name="txtValor"], #txtValor',
      botao_buscar: 'button[type="submit"], input[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  trf5: {
    nome: 'Tribunal Regional Federal da 5a Regiao',
    sigla: 'TRF5',
    tipo: 'trf',
    url_consulta: 'https://pje.trf5.jus.br/pje/ConsultaPublica/listView.seam',
    url_base: 'https://www.trf5.jus.br/',
    sistema: 'PJe TRF5',
    seletores: {
      campo_processo: 'input[name*="numeroProcesso"]',
      botao_buscar: 'button[type="submit"], input[value="Pesquisar"]',
      resultados: '.rich-table, table tbody tr',
    },
  },
  trf6: {
    nome: 'Tribunal Regional Federal da 6a Regiao',
    sigla: 'TRF6',
    tipo: 'trf',
    url_consulta: 'https://pje.trf6.jus.br/pje/ConsultaPublica/listView.seam',
    url_base: 'https://www.trf6.jus.br/',
    sistema: 'PJe TRF6',
    seletores: {
      campo_processo: 'input[name*="numeroProcesso"]',
      botao_buscar: 'button[type="submit"], input[value="Pesquisar"]',
      resultados: '.rich-table, table tbody tr',
    },
  },

  // Tribunais de Justica Estaduais (principais)
  tjsp: {
    nome: 'Tribunal de Justica de Sao Paulo',
    sigla: 'TJSP',
    tipo: 'tj',
    url_consulta: 'https://esaj.tjsp.jus.br/cpopg/open.do',
    url_base: 'https://www.tjsp.jus.br/',
    sistema: 'e-SAJ TJSP',
    seletores: {
      campo_processo: 'input[name="unifiedSearch"], #unifiedSearch, input[name="numeroProcesso"]',
      botao_buscar: 'input[type="submit"], button[type="submit"], #botaoConsultarProcessos',
      resultados: '.fundoClaro, table tbody tr, .processosLista',
    },
  },
  tjrj: {
    nome: 'Tribunal de Justica do Rio de Janeiro',
    sigla: 'TJRJ',
    tipo: 'tj',
    url_consulta: 'https://www3.tjrj.jus.br/consultaprocessual/',
    url_base: 'https://www.tjrj.jus.br/',
    sistema: 'Consulta TJRJ',
    seletores: {
      campo_processo: 'input[name="NumeroProcesso"], #NumeroProcesso',
      botao_buscar: 'button[type="submit"], input[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  tjmg: {
    nome: 'Tribunal de Justica de Minas Gerais',
    sigla: 'TJMG',
    tipo: 'tj',
    url_consulta: 'https://www4.tjmg.jus.br/juridico/sf/proc_complemento.jsp',
    url_base: 'https://www.tjmg.jus.br/',
    sistema: 'Consulta TJMG',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"], input[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  tjrs: {
    nome: 'Tribunal de Justica do Rio Grande do Sul',
    sigla: 'TJRS',
    tipo: 'tj',
    url_consulta: 'https://www.tjrs.jus.br/novo/consultas/processos/',
    url_base: 'https://www.tjrs.jus.br/',
    sistema: 'Consulta TJRS',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"], input[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  tjpr: {
    nome: 'Tribunal de Justica do Parana',
    sigla: 'TJPR',
    tipo: 'tj',
    url_consulta: 'https://portal.tjpr.jus.br/projudi/',
    url_base: 'https://www.tjpr.jus.br/',
    sistema: 'PROJUDI TJPR',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"], input[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  tjsc: {
    nome: 'Tribunal de Justica de Santa Catarina',
    sigla: 'TJSC',
    tipo: 'tj',
    url_consulta: 'https://esaj.tjsc.jus.br/cpopg/open.do',
    url_base: 'https://www.tjsc.jus.br/',
    sistema: 'e-SAJ TJSC',
    seletores: {
      campo_processo: 'input[name="unifiedSearch"], #unifiedSearch',
      botao_buscar: 'input[type="submit"], button[type="submit"]',
      resultados: '.fundoClaro, table tbody tr',
    },
  },
  tjba: {
    nome: 'Tribunal de Justica da Bahia',
    sigla: 'TJBA',
    tipo: 'tj',
    url_consulta: 'https://esaj.tjba.jus.br/cpopg/open.do',
    url_base: 'https://www.tjba.jus.br/',
    sistema: 'e-SAJ TJBA',
    seletores: {
      campo_processo: 'input[name="unifiedSearch"], #unifiedSearch',
      botao_buscar: 'input[type="submit"], button[type="submit"]',
      resultados: '.fundoClaro, table tbody tr',
    },
  },
  tjpe: {
    nome: 'Tribunal de Justica de Pernambuco',
    sigla: 'TJPE',
    tipo: 'tj',
    url_consulta: 'https://srv01.tjpe.jus.br/consultaprocessualunificada/',
    url_base: 'https://www.tjpe.jus.br/',
    sistema: 'Consulta TJPE',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"], input[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  tjce: {
    nome: 'Tribunal de Justica do Ceara',
    sigla: 'TJCE',
    tipo: 'tj',
    url_consulta: 'https://esaj.tjce.jus.br/cpopg/open.do',
    url_base: 'https://www.tjce.jus.br/',
    sistema: 'e-SAJ TJCE',
    seletores: {
      campo_processo: 'input[name="unifiedSearch"], #unifiedSearch',
      botao_buscar: 'input[type="submit"], button[type="submit"]',
      resultados: '.fundoClaro, table tbody tr',
    },
  },
  tjgo: {
    nome: 'Tribunal de Justica de Goias',
    sigla: 'TJGO',
    tipo: 'tj',
    url_consulta: 'https://projudi.tjgo.jus.br/',
    url_base: 'https://www.tjgo.jus.br/',
    sistema: 'PROJUDI TJGO',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"], input[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  tjdft: {
    nome: 'Tribunal de Justica do Distrito Federal e Territorios',
    sigla: 'TJDFT',
    tipo: 'tj',
    url_consulta: 'https://pje.tjdft.jus.br/pje/ConsultaPublica/listView.seam',
    url_base: 'https://www.tjdft.jus.br/',
    sistema: 'PJe TJDFT',
    seletores: {
      campo_processo: 'input[name*="numeroProcesso"]',
      botao_buscar: 'button[type="submit"], input[value="Pesquisar"]',
      resultados: '.rich-table, table tbody tr',
    },
  },

  // Tribunais Regionais do Trabalho (principais)
  trt1: {
    nome: 'Tribunal Regional do Trabalho da 1a Regiao (RJ)',
    sigla: 'TRT1',
    tipo: 'trt',
    url_consulta: 'https://consultapje.trt1.jus.br/consultaprocessual/',
    url_base: 'https://www.trt1.jus.br/',
    sistema: 'PJe TRT1',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  trt2: {
    nome: 'Tribunal Regional do Trabalho da 2a Regiao (SP)',
    sigla: 'TRT2',
    tipo: 'trt',
    url_consulta: 'https://pje.trt2.jus.br/consultaprocessual/',
    url_base: 'https://www.trt2.jus.br/',
    sistema: 'PJe TRT2',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  trt3: {
    nome: 'Tribunal Regional do Trabalho da 3a Regiao (MG)',
    sigla: 'TRT3',
    tipo: 'trt',
    url_consulta: 'https://pje.trt3.jus.br/consultaprocessual/',
    url_base: 'https://www.trt3.jus.br/',
    sistema: 'PJe TRT3',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  trt4: {
    nome: 'Tribunal Regional do Trabalho da 4a Regiao (RS)',
    sigla: 'TRT4',
    tipo: 'trt',
    url_consulta: 'https://pje.trt4.jus.br/consultaprocessual/',
    url_base: 'https://www.trt4.jus.br/',
    sistema: 'PJe TRT4',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
  trt15: {
    nome: 'Tribunal Regional do Trabalho da 15a Regiao (Campinas)',
    sigla: 'TRT15',
    tipo: 'trt',
    url_consulta: 'https://pje.trt15.jus.br/consultaprocessual/',
    url_base: 'https://www.trt15.jus.br/',
    sistema: 'PJe TRT15',
    seletores: {
      campo_processo: 'input[name="numeroProcesso"], #numeroProcesso',
      botao_buscar: 'button[type="submit"]',
      resultados: '.processo, table tbody tr',
    },
  },
} as const;

type TribunalSigla = keyof typeof TRIBUNAIS;
type TipoTribunal = 'superiores' | 'trf' | 'tj' | 'trt' | 'tre' | 'todos';

// ============================================================================
// AIDEV-NOTE: Interfaces para respostas de instrucoes de navegacao
// ============================================================================

interface UrlSugerida {
  url: string;
  descricao: string;
  prioridade: number;
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
  tribunal: {
    sigla: string;
    nome: string;
    sistema: string;
  };
  urls_sugeridas: UrlSugerida[];
  passos: string[];
  browser_script_sugerido?: {
    actions: BrowserAction[];
  };
  seletores_uteis?: Record<string, string>;
  dicas: string[];
}

// ============================================================================
// AIDEV-NOTE: Funcoes utilitarias
// ============================================================================

/**
 * @function formatarNumeroProcesso
 * @description Formata numero do processo no padrao NPU
 */
function formatarNumeroProcesso(numero: string): string {
  // Remove caracteres nao numericos
  const limpo = numero.replace(/\D/g, '');
  
  if (limpo.length === 20) {
    // Formato completo: NNNNNNN-DD.AAAA.J.TR.OOOO
    return `${limpo.slice(0, 7)}-${limpo.slice(7, 9)}.${limpo.slice(9, 13)}.${limpo.slice(13, 14)}.${limpo.slice(14, 16)}.${limpo.slice(16, 20)}`;
  }
  
  // Retorna o numero como esta se nao tiver 20 digitos
  return numero;
}

/**
 * @function extrairInfoProcesso
 * @description Extrai informacoes do numero do processo
 */
function extrairInfoProcesso(numero: string): { segmento: string; tribunal: string; ano: string } | null {
  const limpo = numero.replace(/\D/g, '');
  
  if (limpo.length !== 20) {
    return null;
  }
  
  const segmentos: Record<string, string> = {
    '1': 'Supremo Tribunal Federal',
    '2': 'Conselho Nacional de Justica',
    '3': 'Superior Tribunal de Justica',
    '4': 'Justica Federal',
    '5': 'Justica do Trabalho',
    '6': 'Justica Eleitoral',
    '7': 'Justica Militar da Uniao',
    '8': 'Justica Estadual',
    '9': 'Justica Militar Estadual',
  };
  
  return {
    segmento: segmentos[limpo.slice(13, 14)] || 'Desconhecido',
    tribunal: limpo.slice(14, 16),
    ano: limpo.slice(9, 13),
  };
}

// ============================================================================
// AIDEV-NOTE: Funcoes geradoras de instrucoes de navegacao
// ============================================================================

/**
 * @function criarInstrucoesConsultaProcesso
 * @description Cria instrucoes para consultar um processo especifico
 */
function criarInstrucoesConsultaProcesso(tribunal: TribunalSigla, numeroProcesso: string): InstrucoesNavegacao {
  const info = TRIBUNAIS[tribunal];
  const numeroFormatado = formatarNumeroProcesso(numeroProcesso);
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Consulta do processo ${numeroFormatado} no ${info.sigla}`,
    tribunal: {
      sigla: info.sigla,
      nome: info.nome,
      sistema: info.sistema,
    },
    urls_sugeridas: [
      {
        url: info.url_consulta,
        descricao: `Pagina de consulta processual do ${info.sigla}`,
        prioridade: 1,
      },
      {
        url: info.url_base,
        descricao: `Pagina inicial do ${info.sigla} (alternativa)`,
        prioridade: 2,
      },
      {
        url: `https://www.google.com/search?q=processo+${numeroFormatado}+${info.sigla}`,
        descricao: 'Busca no Google como ultima alternativa',
        prioridade: 3,
      },
    ],
    passos: [
      `1. Navegue ate a pagina de consulta do ${info.sigla}`,
      `2. Localize o campo de numero do processo`,
      `3. Preencha com o numero: ${numeroFormatado}`,
      `4. Clique no botao de consultar/pesquisar`,
      `5. Aguarde os resultados carregarem`,
      `6. Se houver captcha, solicite ao usuario para resolver`,
      `7. Extraia os dados do processo (partes, movimentacoes, etc.)`,
    ],
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: info.url_consulta },
        { action: 'waitForLoad', timeout: 15000 },
        { action: 'snapshot' },
        { action: 'findAndFill', selector: info.seletores.campo_processo, text: numeroFormatado, skipIfNotFound: true },
        { action: 'findAndClick', selector: info.seletores.botao_buscar, skipIfNotFound: true },
        { action: 'waitForNavigation', timeout: 15000 },
        { action: 'snapshot' },
      ],
    },
    seletores_uteis: info.seletores,
    dicas: [
      `O ${info.sigla} usa o sistema ${info.sistema}`,
      'Alguns processos podem estar em segredo de justica',
      'Se o processo nao for encontrado, verifique se o numero esta correto',
      'Processos muito antigos podem nao estar digitalizados',
      'Se houver captcha, use browser_screenshot e peca ao usuario para resolver',
    ],
  };
}

/**
 * @function criarInstrucoesPesquisaProcessos
 * @description Cria instrucoes para pesquisar processos por criterios
 */
function criarInstrucoesPesquisaProcessos(
  tribunal: TribunalSigla,
  nomeParte?: string,
  cpfCnpj?: string,
  numeroOab?: string
): InstrucoesNavegacao {
  const info = TRIBUNAIS[tribunal];
  
  const criterios: string[] = [];
  if (nomeParte) criterios.push(`Nome da parte: "${nomeParte}"`);
  if (cpfCnpj) criterios.push(`CPF/CNPJ: ${cpfCnpj}`);
  if (numeroOab) criterios.push(`OAB: ${numeroOab}`);
  
  const descricaoCriterios = criterios.length > 0 
    ? criterios.join(', ')
    : 'sem criterios especificos';
  
  const passos = [
    `1. Navegue ate a pagina de consulta do ${info.sigla}`,
    `2. Use browser_snapshot para identificar os campos disponiveis`,
  ];
  
  if (nomeParte) {
    passos.push(`3. Localize o campo de nome/parte e preencha com: "${nomeParte}"`);
  }
  if (cpfCnpj) {
    passos.push(`${passos.length + 1}. Localize o campo de CPF/CNPJ e preencha com: ${cpfCnpj}`);
  }
  if (numeroOab) {
    passos.push(`${passos.length + 1}. Localize o campo de OAB e preencha com: ${numeroOab}`);
  }
  
  passos.push(
    `${passos.length + 1}. Clique no botao de pesquisar`,
    `${passos.length + 2}. Aguarde os resultados`,
    `${passos.length + 3}. Se houver paginacao, navegue pelas paginas de resultados`,
  );
  
  const actions: BrowserAction[] = [
    { action: 'goto', url: info.url_consulta },
    { action: 'waitForLoad', timeout: 15000 },
    { action: 'snapshot' },
  ];
  
  if (nomeParte) {
    actions.push({
      action: 'findAndFill',
      selector: 'input[name*="parte"], input[name*="nome"], input[id*="parte"], input[id*="nome"]',
      text: nomeParte,
      skipIfNotFound: true,
    });
  }
  
  if (cpfCnpj) {
    actions.push({
      action: 'findAndFill',
      selector: 'input[name*="cpf"], input[name*="cnpj"], input[name*="documento"]',
      text: cpfCnpj,
      skipIfNotFound: true,
    });
  }
  
  if (numeroOab) {
    actions.push({
      action: 'findAndFill',
      selector: 'input[name*="oab"], input[name*="advogado"]',
      text: numeroOab,
      skipIfNotFound: true,
    });
  }
  
  actions.push(
    { action: 'findAndClick', selector: info.seletores.botao_buscar, skipIfNotFound: true },
    { action: 'waitForNavigation', timeout: 15000 },
    { action: 'snapshot' },
  );
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Pesquisa de processos no ${info.sigla} (${descricaoCriterios})`,
    tribunal: {
      sigla: info.sigla,
      nome: info.nome,
      sistema: info.sistema,
    },
    urls_sugeridas: [
      {
        url: info.url_consulta,
        descricao: `Pagina de consulta processual do ${info.sigla}`,
        prioridade: 1,
      },
    ],
    passos,
    browser_script_sugerido: { actions },
    seletores_uteis: {
      ...info.seletores,
      campo_nome: 'input[name*="parte"], input[name*="nome"], input[id*="parte"]',
      campo_cpf_cnpj: 'input[name*="cpf"], input[name*="cnpj"], input[name*="documento"]',
      campo_oab: 'input[name*="oab"], input[name*="advogado"]',
    },
    dicas: [
      'Use browser_snapshot primeiro para identificar os campos disponiveis',
      'Cada tribunal tem campos diferentes para pesquisa',
      'Pesquisas por nome podem retornar muitos resultados',
      'Pesquisas por CPF/CNPJ sao mais precisas',
      'O numero da OAB deve incluir a seccional (ex: 123456/SP)',
    ],
  };
}

/**
 * @function criarInstrucoesListarMovimentacoes
 * @description Cria instrucoes para listar movimentacoes de um processo
 */
function criarInstrucoesListarMovimentacoes(tribunal: TribunalSigla, numeroProcesso: string): InstrucoesNavegacao {
  const info = TRIBUNAIS[tribunal];
  const numeroFormatado = formatarNumeroProcesso(numeroProcesso);
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Listagem de movimentacoes do processo ${numeroFormatado} no ${info.sigla}`,
    tribunal: {
      sigla: info.sigla,
      nome: info.nome,
      sistema: info.sistema,
    },
    urls_sugeridas: [
      {
        url: info.url_consulta,
        descricao: `Pagina de consulta processual do ${info.sigla}`,
        prioridade: 1,
      },
    ],
    passos: [
      `1. Primeiro, consulte o processo ${numeroFormatado} usando consultar_processo`,
      `2. Na pagina de detalhes do processo, localize a aba/secao de movimentacoes`,
      `3. Clique em "Movimentacoes", "Andamentos" ou similar`,
      `4. As movimentacoes geralmente aparecem em ordem cronologica (mais recente primeiro)`,
      `5. Se houver paginacao, navegue para ver movimentacoes mais antigas`,
      `6. Extraia: data, tipo de movimentacao, descricao`,
    ],
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: info.url_consulta },
        { action: 'waitForLoad', timeout: 15000 },
        { action: 'findAndFill', selector: info.seletores.campo_processo, text: numeroFormatado, skipIfNotFound: true },
        { action: 'findAndClick', selector: info.seletores.botao_buscar, skipIfNotFound: true },
        { action: 'waitForNavigation', timeout: 15000 },
        { action: 'findAndClick', selector: 'a[href*="moviment"], button:contains("Moviment"), .aba-movimentacoes, #movimentacoes', skipIfNotFound: true },
        { action: 'waitForLoad', timeout: 10000 },
        { action: 'snapshot' },
      ],
    },
    seletores_uteis: {
      aba_movimentacoes: 'a[href*="moviment"], button:contains("Moviment"), .aba-movimentacoes, #tabMovimentacoes',
      lista_movimentacoes: '.movimentacao, .andamento, table tbody tr, .timeline-item',
      data_movimentacao: '.data, td:first-child, .movimentacao-data',
      descricao_movimentacao: '.descricao, td:nth-child(2), .movimentacao-descricao',
    },
    dicas: [
      'As movimentacoes podem estar em uma aba separada',
      'Alguns sistemas mostram apenas as ultimas movimentacoes por padrao',
      'Procure por opcao "Ver todas" ou "Expandir" para ver historico completo',
      'A ordem pode ser crescente ou decrescente (verifique)',
    ],
  };
}

/**
 * @function criarInstrucoesListarTribunais
 * @description Cria lista de tribunais disponiveis
 */
function criarInstrucoesListarTribunais(filtro: TipoTribunal = 'todos'): object {
  let tribunaisFiltrados = Object.entries(TRIBUNAIS);
  
  if (filtro !== 'todos') {
    tribunaisFiltrados = tribunaisFiltrados.filter(([_, info]) => info.tipo === filtro);
  }
  
  const tribunais = tribunaisFiltrados.map(([sigla, info]) => ({
    sigla,
    nome: info.nome,
    tipo: info.tipo,
    url_consulta: info.url_consulta,
    sistema: info.sistema,
  }));
  
  return {
    tipo: 'lista_tribunais',
    descricao: 'Tribunais disponiveis para consulta processual',
    filtro_aplicado: filtro,
    total: tribunais.length,
    tribunais,
    tipos_disponiveis: ['superiores', 'trf', 'tj', 'trt', 'todos'],
    instrucao: 'Use consultar_processo(tribunal="sigla", numeroProcesso="...") para consultar',
  };
}

// ============================================================================
// AIDEV-NOTE: Schemas de validacao Zod
// ============================================================================

const TribunalSchema = z.enum(Object.keys(TRIBUNAIS) as [TribunalSigla, ...TribunalSigla[]]);

const ConsultarProcessoSchema = z.object({
  tribunal: TribunalSchema.describe('Sigla do tribunal (ex: tjsp, stj, trf3)'),
  numeroProcesso: z.string().describe('Numero do processo no formato NPU ou apenas digitos'),
});

const PesquisarProcessosSchema = z.object({
  tribunal: TribunalSchema.describe('Sigla do tribunal'),
  nomeParte: z.string().optional().describe('Nome da parte (autor, reu, etc.)'),
  cpfCnpj: z.string().optional().describe('CPF ou CNPJ da parte'),
  numeroOab: z.string().optional().describe('Numero da OAB do advogado'),
});

const ListarMovimentacoesSchema = z.object({
  tribunal: TribunalSchema.describe('Sigla do tribunal'),
  numeroProcesso: z.string().describe('Numero do processo'),
});

const ListarTribunaisSchema = z.object({
  filtro: z.enum(['superiores', 'trf', 'tj', 'trt', 'tre', 'todos']).optional().default('todos').describe('Filtrar por tipo de tribunal'),
});

// ============================================================================
// AIDEV-NOTE: Servidor MCP
// ============================================================================

const server = new Server(
  {
    name: 'consulta-processos',
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
        name: 'consultar_processo',
        description:
          'Retorna instrucoes de navegacao para consultar um processo judicial especifico pelo numero NPU. ' +
          'Use as URLs e passos retornados com o dev-browser para acessar os dados do processo.',
        inputSchema: {
          type: 'object',
          properties: {
            tribunal: {
              type: 'string',
              description: 'Sigla do tribunal (ex: tjsp, stj, trf3, trt2)',
              enum: Object.keys(TRIBUNAIS),
            },
            numeroProcesso: {
              type: 'string',
              description: 'Numero do processo no formato NPU (ex: 0000000-00.0000.0.00.0000) ou apenas digitos',
            },
          },
          required: ['tribunal', 'numeroProcesso'],
        },
      },
      {
        name: 'pesquisar_processos',
        description:
          'Retorna instrucoes de navegacao para pesquisar processos por criterios como nome da parte, CPF/CNPJ ou OAB.',
        inputSchema: {
          type: 'object',
          properties: {
            tribunal: {
              type: 'string',
              description: 'Sigla do tribunal',
              enum: Object.keys(TRIBUNAIS),
            },
            nomeParte: {
              type: 'string',
              description: 'Nome da parte (autor, reu, etc.)',
            },
            cpfCnpj: {
              type: 'string',
              description: 'CPF ou CNPJ da parte',
            },
            numeroOab: {
              type: 'string',
              description: 'Numero da OAB do advogado (com seccional, ex: 123456/SP)',
            },
          },
          required: ['tribunal'],
        },
      },
      {
        name: 'listar_movimentacoes',
        description:
          'Retorna instrucoes de navegacao para listar as movimentacoes (andamentos) de um processo.',
        inputSchema: {
          type: 'object',
          properties: {
            tribunal: {
              type: 'string',
              description: 'Sigla do tribunal',
              enum: Object.keys(TRIBUNAIS),
            },
            numeroProcesso: {
              type: 'string',
              description: 'Numero do processo',
            },
          },
          required: ['tribunal', 'numeroProcesso'],
        },
      },
      {
        name: 'listar_tribunais',
        description:
          'Lista todos os tribunais disponiveis para consulta com suas URLs.',
        inputSchema: {
          type: 'object',
          properties: {
            filtro: {
              type: 'string',
              description: 'Filtrar tribunais por tipo: "superiores", "trf", "tj", "trt" ou "todos" (padrao)',
              enum: ['superiores', 'trf', 'tj', 'trt', 'tre', 'todos'],
            },
          },
          required: [],
        },
      },
    ],
  };
});

// Handler para execucao das ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  console.error(`[consulta-processos] Executando ferramenta: ${name}`);
  console.error(`[consulta-processos] Argumentos:`, JSON.stringify(args));

  try {
    switch (name) {
      case 'consultar_processo': {
        const params = ConsultarProcessoSchema.parse(args);
        const instrucoes = criarInstrucoesConsultaProcesso(
          params.tribunal,
          params.numeroProcesso
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(instrucoes, null, 2),
            },
          ],
        };
      }

      case 'pesquisar_processos': {
        const params = PesquisarProcessosSchema.parse(args);
        const instrucoes = criarInstrucoesPesquisaProcessos(
          params.tribunal,
          params.nomeParte,
          params.cpfCnpj,
          params.numeroOab
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(instrucoes, null, 2),
            },
          ],
        };
      }

      case 'listar_movimentacoes': {
        const params = ListarMovimentacoesSchema.parse(args);
        const instrucoes = criarInstrucoesListarMovimentacoes(
          params.tribunal,
          params.numeroProcesso
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(instrucoes, null, 2),
            },
          ],
        };
      }

      case 'listar_tribunais': {
        const params = ListarTribunaisSchema.parse(args);
        const resposta = criarInstrucoesListarTribunais(params.filtro);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resposta, null, 2),
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
                  'consultar_processo',
                  'pesquisar_processos',
                  'listar_movimentacoes',
                  'listar_tribunais',
                ],
              }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`[consulta-processos] Erro:`, error);

    const mensagemErro = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            erro: mensagemErro,
            dica: 'Verifique os parametros e tente novamente. Use listar_tribunais() para ver os tribunais disponiveis.',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Iniciar o servidor
async function main() {
  console.error('[consulta-processos] Iniciando servidor MCP v2.0 (navegador)...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[consulta-processos] Servidor MCP conectado e pronto');
  console.error('[consulta-processos] MODO: Instrucoes de navegacao (use dev-browser)');
  console.error('[consulta-processos] Ferramentas disponiveis:');
  console.error('[consulta-processos]   - consultar_processo');
  console.error('[consulta-processos]   - pesquisar_processos');
  console.error('[consulta-processos]   - listar_movimentacoes');
  console.error('[consulta-processos]   - listar_tribunais');
}

main().catch((error) => {
  console.error('[consulta-processos] Erro fatal:', error);
  process.exit(1);
});
