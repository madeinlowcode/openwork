#!/usr/bin/env node
/**
 * @skill consulta-legislacao
 * @description MCP Server para consulta de legislacao brasileira via navegador web
 *
 * Este servidor retorna INSTRUCOES DE NAVEGACAO para o agente usar o dev-browser
 * para buscar leis, codigos, decretos e jurisprudencia em portais oficiais.
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

console.error('[consulta-legislacao] Script starting...');
console.error('[consulta-legislacao] Node version:', process.version);

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

console.error('[consulta-legislacao] All imports completed successfully');

// ============================================================================
// AIDEV-NOTE: Configuracao de URLs oficiais de legislacao brasileira
// ============================================================================

/**
 * @constant SITES_LEGISLACAO
 * @description URLs dos principais portais de legislacao brasileira
 * AIDEV-WARNING: Atualizar URLs se os sites mudarem de endereco
 */
const SITES_LEGISLACAO = {
  planalto: {
    base: 'https://www.planalto.gov.br/ccivil_03/',
    leis: 'https://www.planalto.gov.br/ccivil_03/leis/',
    decretos: 'https://www.planalto.gov.br/ccivil_03/decreto/',
    medidas_provisorias: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/mpv/',
    descricao: 'Portal da Legislacao Federal (Planalto)',
  },
  senado: {
    base: 'https://www.senado.leg.br/',
    constituicao: 'https://www.senado.leg.br/atividade/const/constituicao-federal.asp',
    legislacao: 'https://www.senado.leg.br/atividade/legislacao',
    descricao: 'Senado Federal - Legislacao e Constituicao',
  },
  lexml: {
    base: 'https://www.lexml.gov.br/',
    busca: 'https://www.lexml.gov.br/busca/search',
    descricao: 'LexML - Rede de Informacao Legislativa e Juridica',
  },
  stf: {
    base: 'https://portal.stf.jus.br/',
    jurisprudencia: 'https://portal.stf.jus.br/jurisprudencia/',
    sumulas: 'https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp',
    descricao: 'Supremo Tribunal Federal - Jurisprudencia',
  },
  stj: {
    base: 'https://www.stj.jus.br/',
    jurisprudencia: 'https://scon.stj.jus.br/SCON/',
    sumulas: 'https://www.stj.jus.br/sites/portalp/Paginas/Juridico/Sumulas.aspx',
    descricao: 'Superior Tribunal de Justica - Jurisprudencia',
  },
  tst: {
    base: 'https://www.tst.jus.br/',
    jurisprudencia: 'https://jurisprudencia.tst.jus.br/',
    sumulas: 'https://www.tst.jus.br/sumulas',
    descricao: 'Tribunal Superior do Trabalho - Jurisprudencia',
  },
} as const;

/**
 * @constant CODIGOS_BRASILEIROS
 * @description Mapeamento dos principais codigos brasileiros para URLs diretas
 */
const CODIGOS_BRASILEIROS = {
  civil: {
    nome: 'Codigo Civil',
    lei: 'Lei 10.406/2002',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
    numero: 10406,
    ano: 2002,
  },
  penal: {
    nome: 'Codigo Penal',
    lei: 'Decreto-Lei 2.848/1940',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
    numero: 2848,
    ano: 1940,
  },
  clt: {
    nome: 'Consolidacao das Leis do Trabalho',
    lei: 'Decreto-Lei 5.452/1943',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm',
    numero: 5452,
    ano: 1943,
  },
  cdc: {
    nome: 'Codigo de Defesa do Consumidor',
    lei: 'Lei 8.078/1990',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
    numero: 8078,
    ano: 1990,
  },
  cpc: {
    nome: 'Codigo de Processo Civil',
    lei: 'Lei 13.105/2015',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm',
    numero: 13105,
    ano: 2015,
  },
  cpp: {
    nome: 'Codigo de Processo Penal',
    lei: 'Decreto-Lei 3.689/1941',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm',
    numero: 3689,
    ano: 1941,
  },
  ctb: {
    nome: 'Codigo de Transito Brasileiro',
    lei: 'Lei 9.503/1997',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l9503compilado.htm',
    numero: 9503,
    ano: 1997,
  },
  eca: {
    nome: 'Estatuto da Crianca e do Adolescente',
    lei: 'Lei 8.069/1990',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/l8069.htm',
    numero: 8069,
    ano: 1990,
  },
} as const;

type CodigoSigla = keyof typeof CODIGOS_BRASILEIROS;
type TribunalSigla = 'stf' | 'stj' | 'tst';

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
  urls_sugeridas: UrlSugerida[];
  passos: string[];
  browser_script_sugerido?: {
    actions: BrowserAction[];
  };
  seletores_uteis?: Record<string, string>;
  dicas: string[];
}

// ============================================================================
// AIDEV-NOTE: Funcoes geradoras de instrucoes de navegacao
// ============================================================================

/**
 * @function gerarUrlLei
 * @description Gera URL direta para uma lei no Planalto
 * AIDEV-NOTE: O padrao de URL do Planalto e: l{numero}.htm ou l{numero}compilado.htm
 */
function gerarUrlLei(numero: number | string, ano: number, complementar: boolean = false): string {
  const numStr = String(numero);
  const prefixo = complementar ? 'lcp' : 'l';
  
  // Leis mais antigas (antes de 2000) usam formato diferente
  if (ano < 2000) {
    return `https://www.planalto.gov.br/ccivil_03/leis/${prefixo}${numStr}.htm`;
  }
  
  // Leis de 2000 em diante
  const faixa = ano <= 2002 ? '2002' : 
                ano <= 2006 ? `2004-2006` :
                ano <= 2010 ? `2007-2010` :
                ano <= 2014 ? `2011-2014` :
                ano <= 2018 ? `2015-2018` :
                ano <= 2022 ? `2019-2022` : `2023-2026`;
  
  return `https://www.planalto.gov.br/ccivil_03/_ato${faixa}/lei/${prefixo}${numStr}.htm`;
}

/**
 * @function criarInstrucoesPesquisaLei
 * @description Cria instrucoes de navegacao para pesquisar uma lei especifica
 */
function criarInstrucoesPesquisaLei(numero: number | string, ano: number, complementar: boolean): InstrucoesNavegacao {
  const tipoLei = complementar ? 'Lei Complementar' : 'Lei';
  const urlDireta = gerarUrlLei(numero, ano, complementar);
  const termoBusca = `${tipoLei} ${numero} ${ano}`.toLowerCase().replace(/\s+/g, '+');
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Pesquisa da ${tipoLei} ${numero}/${ano}`,
    urls_sugeridas: [
      {
        url: urlDireta,
        descricao: `Link direto no Planalto (pode nao existir se a lei for muito nova/antiga)`,
        prioridade: 1,
      },
      {
        url: `https://www.planalto.gov.br/ccivil_03/leis/l${numero}.htm`,
        descricao: `Link alternativo no Planalto (formato antigo)`,
        prioridade: 2,
      },
      {
        url: `https://www.lexml.gov.br/busca/search?keyword=${termoBusca}`,
        descricao: `Busca no LexML (agregador de legislacao)`,
        prioridade: 3,
      },
      {
        url: `https://www.google.com/search?q=${tipoLei.toLowerCase()}+${numero}+${ano}+texto+completo+site:planalto.gov.br`,
        descricao: `Busca no Google restrita ao Planalto`,
        prioridade: 4,
      },
    ],
    passos: [
      `1. Use browser_script para navegar ate a primeira URL de prioridade 1`,
      `2. Aguarde a pagina carregar completamente (waitForLoad)`,
      `3. Use browser_snapshot para verificar se a pagina contem o texto da lei`,
      `4. Se a pagina retornar erro 404 ou nao carregar, tente a proxima URL da lista`,
      `5. Quando encontrar a lei, extraia o texto relevante usando browser_evaluate`,
      `6. Se precisar de um artigo especifico, use Ctrl+F (browser_keyboard) para localizar`,
    ],
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: urlDireta },
        { action: 'waitForLoad', timeout: 10000 },
        { action: 'snapshot' },
      ],
    },
    seletores_uteis: {
      conteudo_lei: '#conteudo, .texto-lei, article, main',
      titulo: 'h1, h2, .titulo-lei',
      artigos: 'p, .artigo',
    },
    dicas: [
      'O site do Planalto pode demorar para carregar, use timeout de 10-15 segundos',
      'Se o link direto nao funcionar, use a busca no Google com site:planalto.gov.br',
      'Para leis compiladas (com alteracoes), procure por "compilado" no nome do arquivo',
      'O LexML e uma boa alternativa para encontrar leis de diferentes esferas',
    ],
  };
}

/**
 * @function criarInstrucoesPesquisaLegislacao
 * @description Cria instrucoes de navegacao para pesquisar legislacao por termo
 */
function criarInstrucoesPesquisaLegislacao(termo: string): InstrucoesNavegacao {
  const termoEncoded = encodeURIComponent(termo);
  const termoUrl = termo.toLowerCase().replace(/\s+/g, '+');
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Pesquisa de legislacao sobre: "${termo}"`,
    urls_sugeridas: [
      {
        url: `https://www.lexml.gov.br/busca/search?keyword=${termoEncoded}`,
        descricao: 'Busca no LexML (melhor para pesquisa por termo)',
        prioridade: 1,
      },
      {
        url: `https://www.planalto.gov.br/ccivil_03/leis/`,
        descricao: 'Pagina de leis do Planalto (navegue e use busca do navegador)',
        prioridade: 2,
      },
      {
        url: `https://www.google.com/search?q=${termoUrl}+legislacao+site:planalto.gov.br`,
        descricao: 'Busca no Google restrita ao Planalto',
        prioridade: 3,
      },
      {
        url: `https://www.senado.leg.br/atividade/legislacao`,
        descricao: 'Legislacao no Senado Federal',
        prioridade: 4,
      },
    ],
    passos: [
      `1. Use browser_script para navegar ate o LexML`,
      `2. Se o LexML tiver campo de busca, preencha com o termo "${termo}"`,
      `3. Aguarde os resultados carregarem`,
      `4. Use browser_snapshot para ver os resultados`,
      `5. Clique nos links relevantes para ver o texto completo das leis`,
      `6. Se necessario, tente as URLs alternativas`,
    ],
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: `https://www.lexml.gov.br/busca/search?keyword=${termoEncoded}` },
        { action: 'waitForLoad', timeout: 10000 },
        { action: 'snapshot' },
      ],
    },
    seletores_uteis: {
      campo_busca: 'input[type="search"], input[name="keyword"], #search',
      resultados: '.resultado, .result-item, .search-result',
      links_leis: 'a[href*="lexml"], a[href*="planalto"]',
    },
    dicas: [
      'O LexML agrega legislacao de varias fontes (federal, estadual, municipal)',
      'Use termos especificos para refinar a busca',
      'Procure por palavras-chave na ementa das leis',
    ],
  };
}

/**
 * @function criarInstrucoesConsultaCodigo
 * @description Cria instrucoes de navegacao para consultar um codigo especifico
 */
function criarInstrucoesConsultaCodigo(codigo: CodigoSigla, artigo?: number): InstrucoesNavegacao {
  const info = CODIGOS_BRASILEIROS[codigo];
  const descricaoArtigo = artigo ? ` - Artigo ${artigo}` : '';
  
  const urls: UrlSugerida[] = [
    {
      url: info.url,
      descricao: `Link direto para o ${info.nome} no Planalto`,
      prioridade: 1,
    },
  ];
  
  if (artigo) {
    urls.push({
      url: `${info.url}#art${artigo}`,
      descricao: `Link direto para o Art. ${artigo} (se houver ancora)`,
      prioridade: 0, // Maior prioridade se tiver artigo especifico
    });
    urls.push({
      url: `https://www.google.com/search?q=${info.nome.replace(/\s+/g, '+')}+artigo+${artigo}`,
      descricao: 'Busca no Google pelo artigo especifico',
      prioridade: 2,
    });
  }
  
  urls.push({
    url: `https://www.lexml.gov.br/busca/search?keyword=${encodeURIComponent(info.lei)}`,
    descricao: 'Busca no LexML',
    prioridade: 3,
  });
  
  // Ordenar por prioridade
  urls.sort((a, b) => a.prioridade - b.prioridade);
  
  const passos = [
    `1. Use browser_script para navegar ate a URL do ${info.nome}`,
    `2. Aguarde a pagina carregar completamente`,
  ];
  
  if (artigo) {
    passos.push(
      `3. Use browser_keyboard com Ctrl+F para abrir busca do navegador`,
      `4. Busque por "Art. ${artigo}" ou "Artigo ${artigo}"`,
      `5. Extraia o texto do artigo e seus paragrafos/incisos`,
    );
  } else {
    passos.push(
      `3. Use browser_snapshot para ver a estrutura do codigo`,
      `4. Navegue pelos artigos conforme necessario`,
    );
  }
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Consulta do ${info.nome} (${info.lei})${descricaoArtigo}`,
    urls_sugeridas: urls,
    passos,
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: info.url },
        { action: 'waitForLoad', timeout: 15000 },
        { action: 'snapshot' },
      ],
    },
    seletores_uteis: {
      conteudo: '#conteudo, .texto-lei, article',
      artigos: 'p, .artigo, [id^="art"]',
    },
    dicas: [
      `O ${info.nome} e a ${info.lei}`,
      'Os codigos no Planalto geralmente tem versao compilada (com alteracoes)',
      'Use Ctrl+F para localizar artigos especificos rapidamente',
      artigo ? `Procure por "Art. ${artigo}" com ponto ou sem` : '',
    ].filter(Boolean),
  };
}

/**
 * @function criarInstrucoesBuscarJurisprudencia
 * @description Cria instrucoes de navegacao para buscar jurisprudencia
 */
function criarInstrucoesBuscarJurisprudencia(termo: string, tribunal?: TribunalSigla): InstrucoesNavegacao {
  const termoEncoded = encodeURIComponent(termo);
  const urls: UrlSugerida[] = [];
  
  if (!tribunal || tribunal === 'stf') {
    urls.push({
      url: `https://portal.stf.jus.br/jurisprudencia/`,
      descricao: 'Jurisprudencia do STF - Supremo Tribunal Federal',
      prioridade: tribunal === 'stf' ? 1 : 2,
    });
  }
  
  if (!tribunal || tribunal === 'stj') {
    urls.push({
      url: `https://scon.stj.jus.br/SCON/`,
      descricao: 'Jurisprudencia do STJ - Superior Tribunal de Justica',
      prioridade: tribunal === 'stj' ? 1 : 2,
    });
  }
  
  if (!tribunal || tribunal === 'tst') {
    urls.push({
      url: `https://jurisprudencia.tst.jus.br/`,
      descricao: 'Jurisprudencia do TST - Tribunal Superior do Trabalho',
      prioridade: tribunal === 'tst' ? 1 : 2,
    });
  }
  
  urls.push({
    url: `https://www.google.com/search?q=${termoEncoded}+jurisprudencia+${tribunal || 'stf+stj'}`,
    descricao: 'Busca no Google por jurisprudencia',
    prioridade: 4,
  });
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Busca de jurisprudencia sobre: "${termo}"${tribunal ? ` no ${tribunal.toUpperCase()}` : ''}`,
    urls_sugeridas: urls,
    passos: [
      `1. Navegue ate o portal de jurisprudencia do tribunal`,
      `2. Localize o campo de busca/pesquisa livre`,
      `3. Digite o termo de busca: "${termo}"`,
      `4. Execute a busca (Enter ou clique no botao)`,
      `5. Aguarde os resultados carregarem`,
      `6. Analise as ementas dos acordaos encontrados`,
      `7. Clique em um resultado para ver o inteiro teor`,
    ],
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: urls[0].url },
        { action: 'waitForLoad', timeout: 15000 },
        { action: 'findAndFill', selector: 'input[type="text"], input[type="search"], #txtPesquisaLivre', text: termo, skipIfNotFound: true },
        { action: 'snapshot' },
      ],
    },
    seletores_uteis: {
      campo_busca_stf: '#txtPesquisaLivre, input[name="pesquisaLivre"]',
      campo_busca_stj: '#pesquisaLivre, input[type="text"]',
      campo_busca_tst: 'input[type="search"], #termo',
      botao_buscar: 'button[type="submit"], input[type="submit"], .btn-pesquisar',
      resultados: '.resultado, .acordao, .ementa',
    },
    dicas: [
      'Os portais de jurisprudencia podem ter interfaces diferentes',
      'Use browser_snapshot apos carregar para identificar os campos corretos',
      'Procure por "pesquisa livre" ou "pesquisa por palavra-chave"',
      'Os resultados geralmente mostram ementa e numero do acordao',
      'Para texto completo, clique no link do acordao',
    ],
  };
}

/**
 * @function criarInstrucoesPesquisaSumula
 * @description Cria instrucoes de navegacao para pesquisar sumulas
 */
function criarInstrucoesPesquisaSumula(tribunal: TribunalSigla, numero?: number): InstrucoesNavegacao {
  const urlsSumulas: Record<TribunalSigla, string> = {
    stf: 'https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp',
    stj: 'https://www.stj.jus.br/sites/portalp/Paginas/Juridico/Sumulas.aspx',
    tst: 'https://www.tst.jus.br/sumulas',
  };
  
  const nomesTribunais: Record<TribunalSigla, string> = {
    stf: 'Supremo Tribunal Federal',
    stj: 'Superior Tribunal de Justica',
    tst: 'Tribunal Superior do Trabalho',
  };
  
  const descricaoNumero = numero ? ` - Sumula ${numero}` : '';
  
  const urls: UrlSugerida[] = [
    {
      url: urlsSumulas[tribunal],
      descricao: `Pagina de sumulas do ${nomesTribunais[tribunal]}`,
      prioridade: 1,
    },
  ];
  
  if (numero) {
    urls.push({
      url: `https://www.google.com/search?q=sumula+${numero}+${tribunal.toUpperCase()}`,
      descricao: `Busca direta pela Sumula ${numero} do ${tribunal.toUpperCase()}`,
      prioridade: 2,
    });
  }
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Pesquisa de sumulas do ${tribunal.toUpperCase()}${descricaoNumero}`,
    urls_sugeridas: urls,
    passos: numero ? [
      `1. Navegue ate a pagina de sumulas do ${tribunal.toUpperCase()}`,
      `2. Use Ctrl+F para buscar "Sumula ${numero}" ou apenas "${numero}"`,
      `3. Extraia o texto da sumula encontrada`,
      `4. Se nao encontrar, use a busca do Google como alternativa`,
    ] : [
      `1. Navegue ate a pagina de sumulas do ${tribunal.toUpperCase()}`,
      `2. Use browser_snapshot para ver a lista de sumulas`,
      `3. As sumulas geralmente estao em formato de lista ou tabela`,
      `4. Clique na sumula desejada para ver detalhes`,
    ],
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: urlsSumulas[tribunal] },
        { action: 'waitForLoad', timeout: 15000 },
        { action: 'snapshot' },
      ],
    },
    seletores_uteis: {
      lista_sumulas: '.sumula, .sumulas, table, ul, ol',
      item_sumula: 'li, tr, .sumula-item',
    },
    dicas: [
      `O ${tribunal.toUpperCase()} e o ${nomesTribunais[tribunal]}`,
      'Sumulas vinculantes do STF tem forca de lei',
      'Sumulas do STJ orientam a interpretacao das leis',
      numero ? `A Sumula ${numero} do ${tribunal.toUpperCase()} pode ter sido cancelada ou alterada` : '',
    ].filter(Boolean),
  };
}

/**
 * @function criarInstrucoesPesquisaConstituicao
 * @description Cria instrucoes de navegacao para pesquisar na Constituicao Federal
 */
function criarInstrucoesPesquisaConstituicao(artigo?: number): InstrucoesNavegacao {
  const descricaoArtigo = artigo ? ` - Artigo ${artigo}` : '';
  
  const urls: UrlSugerida[] = [
    {
      url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
      descricao: 'Constituicao Federal no Planalto (texto atualizado)',
      prioridade: 1,
    },
    {
      url: 'https://www.senado.leg.br/atividade/const/constituicao-federal.asp',
      descricao: 'Constituicao Federal no Senado (com notas)',
      prioridade: 2,
    },
  ];
  
  if (artigo) {
    urls.unshift({
      url: `https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm#art${artigo}`,
      descricao: `Link direto para o Art. ${artigo} da CF/88`,
      prioridade: 0,
    });
  }
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Consulta da Constituicao Federal de 1988${descricaoArtigo}`,
    urls_sugeridas: urls,
    passos: artigo ? [
      `1. Navegue ate a Constituicao Federal no Planalto`,
      `2. Use Ctrl+F para buscar "Art. ${artigo}"`,
      `3. Leia o artigo e seus paragrafos/incisos`,
      `4. Verifique se ha alteracoes por emendas constitucionais`,
    ] : [
      `1. Navegue ate a Constituicao Federal`,
      `2. Use browser_snapshot para ver a estrutura`,
      `3. A CF/88 esta dividida em Titulos, Capitulos e Artigos`,
      `4. Navegue pelo sumario ou use Ctrl+F para localizar`,
    ],
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: urls[0].url },
        { action: 'waitForLoad', timeout: 15000 },
        { action: 'snapshot' },
      ],
    },
    seletores_uteis: {
      conteudo: '#conteudo, .constituicao, article',
      artigos: 'p, .artigo, [id^="art"]',
    },
    dicas: [
      'A CF/88 tem mais de 250 artigos no texto permanente',
      'O ADCT (Ato das Disposicoes Constitucionais Transitorias) esta no final',
      'Verifique as emendas constitucionais para alteracoes recentes',
      'O site do Senado tem notas explicativas uteis',
    ],
  };
}

/**
 * @function criarInstrucoesPesquisaDecreto
 * @description Cria instrucoes de navegacao para pesquisar um decreto
 */
function criarInstrucoesPesquisaDecreto(numero: number, ano: number): InstrucoesNavegacao {
  const urls: UrlSugerida[] = [
    {
      url: `https://www.planalto.gov.br/ccivil_03/_ato2019-2022/decreto/d${numero}.htm`,
      descricao: 'Link direto no Planalto (decretos recentes)',
      prioridade: 1,
    },
    {
      url: `https://www.planalto.gov.br/ccivil_03/decreto/d${numero}.htm`,
      descricao: 'Link alternativo no Planalto (decretos antigos)',
      prioridade: 2,
    },
    {
      url: `https://www.lexml.gov.br/busca/search?keyword=decreto+${numero}+${ano}`,
      descricao: 'Busca no LexML',
      prioridade: 3,
    },
    {
      url: `https://www.google.com/search?q=decreto+${numero}+${ano}+site:planalto.gov.br`,
      descricao: 'Busca no Google',
      prioridade: 4,
    },
  ];
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Pesquisa do Decreto ${numero}/${ano}`,
    urls_sugeridas: urls,
    passos: [
      `1. Tente o link direto no Planalto primeiro`,
      `2. Se retornar 404, tente o link alternativo`,
      `3. Se nao encontrar, use o LexML ou Google`,
      `4. Verifique se o decreto ainda esta vigente`,
    ],
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: urls[0].url },
        { action: 'waitForLoad', timeout: 10000 },
        { action: 'snapshot' },
      ],
    },
    dicas: [
      'Decretos podem ser regulamentadores (regulamentam leis) ou autonomos',
      'Verifique se o decreto nao foi revogado por outro mais recente',
      'O padrao de URL do Planalto varia conforme a data do decreto',
    ],
  };
}

/**
 * @function criarInstrucoesPesquisaMedidaProvisoria
 * @description Cria instrucoes de navegacao para pesquisar uma medida provisoria
 */
function criarInstrucoesPesquisaMedidaProvisoria(numero: number, ano?: number): InstrucoesNavegacao {
  const anoTexto = ano ? `/${ano}` : '';
  const urls: UrlSugerida[] = [
    {
      url: `https://www.planalto.gov.br/ccivil_03/_ato2019-2022/mpv/mpv${numero}.htm`,
      descricao: 'Link direto no Planalto (MPs recentes)',
      prioridade: 1,
    },
    {
      url: `https://www.planalto.gov.br/ccivil_03/mpv/mpv${numero}.htm`,
      descricao: 'Link alternativo no Planalto',
      prioridade: 2,
    },
    {
      url: `https://www.lexml.gov.br/busca/search?keyword=medida+provisoria+${numero}`,
      descricao: 'Busca no LexML',
      prioridade: 3,
    },
    {
      url: `https://www.google.com/search?q=medida+provisoria+${numero}${ano ? `+${ano}` : ''}+site:planalto.gov.br`,
      descricao: 'Busca no Google',
      prioridade: 4,
    },
  ];
  
  return {
    tipo: 'instrucoes_navegacao',
    descricao: `Pesquisa da Medida Provisoria ${numero}${anoTexto}`,
    urls_sugeridas: urls,
    passos: [
      `1. Tente o link direto no Planalto primeiro`,
      `2. Se nao encontrar, use alternativas`,
      `3. Verifique se a MP foi convertida em lei`,
      `4. MPs tem validade de 60 dias, prorrogaveis por mais 60`,
    ],
    browser_script_sugerido: {
      actions: [
        { action: 'goto', url: urls[0].url },
        { action: 'waitForLoad', timeout: 10000 },
        { action: 'snapshot' },
      ],
    },
    dicas: [
      'Medidas Provisorias tem forca de lei mas precisam de conversao pelo Congresso',
      'Verifique se a MP foi convertida em lei ou se perdeu eficacia',
      'O site do Planalto indica o status da MP (vigente, convertida, rejeitada)',
    ],
  };
}

// ============================================================================
// AIDEV-NOTE: Schemas de validacao Zod
// ============================================================================

const PesquisarLeiSchema = z.object({
  numero: z.union([z.number(), z.string()]).describe('Numero da lei'),
  ano: z.number().describe('Ano da lei'),
  complementar: z.boolean().optional().default(false).describe('Se e lei complementar'),
});

const PesquisarLegislacaoSchema = z.object({
  termo: z.string().describe('Termo de busca nas ementas'),
});

const ConsultarCodigoSchema = z.object({
  codigo: z.enum(['civil', 'penal', 'clt', 'cdc', 'cpc', 'cpp', 'ctb', 'eca']).describe(
    'Codigo a consultar: civil, penal, clt, cdc, cpc, cpp, ctb, eca'
  ),
  artigo: z.number().optional().describe('Numero do artigo (opcional)'),
});

const BuscarJurisprudenciaSchema = z.object({
  termo: z.string().describe('Termo de busca na jurisprudencia'),
  tribunal: z.enum(['stf', 'stj', 'tst']).optional().describe('Tribunal: stf, stj, tst ou todos'),
});

const PesquisarDecretoSchema = z.object({
  numero: z.number().describe('Numero do decreto'),
  ano: z.number().describe('Ano do decreto'),
});

const PesquisarMedidaProvisoriaSchema = z.object({
  numero: z.number().describe('Numero da medida provisoria'),
  ano: z.number().optional().describe('Ano da medida provisoria (opcional)'),
});

const PesquisarSumulaSchema = z.object({
  tribunal: z.enum(['stf', 'stj', 'tst']).describe('Tribunal: stf, stj ou tst'),
  numero: z.number().optional().describe('Numero da sumula (opcional)'),
});

const PesquisarConstituicaoSchema = z.object({
  artigo: z.number().optional().describe('Numero do artigo da Constituicao Federal'),
});

// ============================================================================
// AIDEV-NOTE: Servidor MCP
// ============================================================================

const server = new Server(
  {
    name: 'consulta-legislacao',
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
        name: 'pesquisar_lei',
        description:
          'Retorna instrucoes de navegacao para pesquisar uma lei especifica pelo numero e ano. ' +
          'Use as URLs e passos retornados com o dev-browser para acessar o texto da lei.',
        inputSchema: {
          type: 'object',
          properties: {
            numero: {
              type: 'number',
              description: 'Numero da lei (ex: 8078 para CDC)',
            },
            ano: {
              type: 'number',
              description: 'Ano da lei (ex: 1990)',
            },
            complementar: {
              type: 'boolean',
              description: 'Se e lei complementar (padrao: false)',
              default: false,
            },
          },
          required: ['numero', 'ano'],
        },
      },
      {
        name: 'pesquisar_legislacao',
        description:
          'Retorna instrucoes de navegacao para pesquisar legislacao por termo livre. ' +
          'Util para encontrar leis sobre um determinado assunto.',
        inputSchema: {
          type: 'object',
          properties: {
            termo: {
              type: 'string',
              description: 'Termo de busca (ex: "direito do consumidor")',
            },
          },
          required: ['termo'],
        },
      },
      {
        name: 'consultar_codigo',
        description:
          'Retorna instrucoes de navegacao para consultar um dos principais codigos brasileiros. ' +
          'Codigos disponiveis: civil, penal, clt, cdc, cpc, cpp, ctb, eca.',
        inputSchema: {
          type: 'object',
          properties: {
            codigo: {
              type: 'string',
              description: 'Codigo a consultar',
              enum: ['civil', 'penal', 'clt', 'cdc', 'cpc', 'cpp', 'ctb', 'eca'],
            },
            artigo: {
              type: 'number',
              description: 'Numero do artigo para filtrar (opcional)',
            },
          },
          required: ['codigo'],
        },
      },
      {
        name: 'buscar_jurisprudencia',
        description:
          'Retorna instrucoes de navegacao para buscar jurisprudencia (acordaos, decisoes) ' +
          'nos tribunais superiores (STF, STJ, TST).',
        inputSchema: {
          type: 'object',
          properties: {
            termo: {
              type: 'string',
              description: 'Termo de busca na jurisprudencia',
            },
            tribunal: {
              type: 'string',
              description: 'Tribunal especifico: stf, stj, tst (opcional, padrao: todos)',
              enum: ['stf', 'stj', 'tst'],
            },
          },
          required: ['termo'],
        },
      },
      {
        name: 'pesquisar_decreto',
        description:
          'Retorna instrucoes de navegacao para pesquisar um decreto especifico.',
        inputSchema: {
          type: 'object',
          properties: {
            numero: {
              type: 'number',
              description: 'Numero do decreto',
            },
            ano: {
              type: 'number',
              description: 'Ano do decreto',
            },
          },
          required: ['numero', 'ano'],
        },
      },
      {
        name: 'pesquisar_medida_provisoria',
        description:
          'Retorna instrucoes de navegacao para pesquisar uma medida provisoria.',
        inputSchema: {
          type: 'object',
          properties: {
            numero: {
              type: 'number',
              description: 'Numero da medida provisoria',
            },
            ano: {
              type: 'number',
              description: 'Ano da medida provisoria (opcional)',
            },
          },
          required: ['numero'],
        },
      },
      {
        name: 'pesquisar_sumula',
        description:
          'Retorna instrucoes de navegacao para pesquisar sumulas de tribunais superiores (STF, STJ, TST).',
        inputSchema: {
          type: 'object',
          properties: {
            tribunal: {
              type: 'string',
              description: 'Tribunal (stf, stj ou tst)',
              enum: ['stf', 'stj', 'tst'],
            },
            numero: {
              type: 'number',
              description: 'Numero da sumula (opcional)',
            },
          },
          required: ['tribunal'],
        },
      },
      {
        name: 'pesquisar_constituicao',
        description:
          'Retorna instrucoes de navegacao para consultar a Constituicao Federal de 1988.',
        inputSchema: {
          type: 'object',
          properties: {
            artigo: {
              type: 'number',
              description: 'Numero do artigo da CF/88 (opcional)',
            },
          },
          required: [],
        },
      },
      {
        name: 'listar_codigos_disponiveis',
        description:
          'Lista todos os codigos brasileiros disponiveis para consulta com URLs diretas.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'listar_sites_legislacao',
        description:
          'Lista todos os sites oficiais de legislacao brasileira com URLs e descricoes.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handler para execucao das ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  console.error(`[consulta-legislacao] Executando ferramenta: ${name}`);
  console.error(`[consulta-legislacao] Argumentos:`, JSON.stringify(args));

  try {
    switch (name) {
      case 'pesquisar_lei': {
        const params = PesquisarLeiSchema.parse(args);
        const instrucoes = criarInstrucoesPesquisaLei(
          params.numero,
          params.ano,
          params.complementar
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

      case 'pesquisar_legislacao': {
        const params = PesquisarLegislacaoSchema.parse(args);
        const instrucoes = criarInstrucoesPesquisaLegislacao(params.termo);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(instrucoes, null, 2),
            },
          ],
        };
      }

      case 'consultar_codigo': {
        const params = ConsultarCodigoSchema.parse(args);
        const instrucoes = criarInstrucoesConsultaCodigo(
          params.codigo as CodigoSigla,
          params.artigo
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

      case 'buscar_jurisprudencia': {
        const params = BuscarJurisprudenciaSchema.parse(args);
        const instrucoes = criarInstrucoesBuscarJurisprudencia(
          params.termo,
          params.tribunal as TribunalSigla | undefined
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

      case 'pesquisar_decreto': {
        const params = PesquisarDecretoSchema.parse(args);
        const instrucoes = criarInstrucoesPesquisaDecreto(params.numero, params.ano);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(instrucoes, null, 2),
            },
          ],
        };
      }

      case 'pesquisar_medida_provisoria': {
        const params = PesquisarMedidaProvisoriaSchema.parse(args);
        const instrucoes = criarInstrucoesPesquisaMedidaProvisoria(
          params.numero,
          params.ano
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

      case 'pesquisar_sumula': {
        const params = PesquisarSumulaSchema.parse(args);
        const instrucoes = criarInstrucoesPesquisaSumula(
          params.tribunal as TribunalSigla,
          params.numero
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

      case 'pesquisar_constituicao': {
        const params = PesquisarConstituicaoSchema.parse(args);
        const instrucoes = criarInstrucoesPesquisaConstituicao(params.artigo);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(instrucoes, null, 2),
            },
          ],
        };
      }

      case 'listar_codigos_disponiveis': {
        const codigos = Object.entries(CODIGOS_BRASILEIROS).map(([sigla, info]) => ({
          sigla,
          nome: info.nome,
          lei: info.lei,
          url: info.url,
        }));

        const resposta = {
          tipo: 'lista_codigos',
          descricao: 'Codigos brasileiros disponiveis para consulta direta',
          total: codigos.length,
          codigos,
          instrucao: 'Use consultar_codigo(codigo="sigla") para obter instrucoes de navegacao',
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resposta, null, 2),
            },
          ],
        };
      }

      case 'listar_sites_legislacao': {
        const sites = Object.entries(SITES_LEGISLACAO).map(([nome, info]) => ({
          nome,
          descricao: info.descricao,
          url_base: info.base,
          urls_especificas: Object.entries(info)
            .filter(([key]) => key !== 'base' && key !== 'descricao')
            .map(([tipo, url]) => ({ tipo, url })),
        }));

        const resposta = {
          tipo: 'lista_sites',
          descricao: 'Sites oficiais de legislacao brasileira',
          total: sites.length,
          sites,
          instrucao: 'Use browser_navigate para acessar qualquer uma dessas URLs',
        };

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
                  'pesquisar_lei',
                  'pesquisar_legislacao',
                  'consultar_codigo',
                  'buscar_jurisprudencia',
                  'pesquisar_decreto',
                  'pesquisar_medida_provisoria',
                  'pesquisar_sumula',
                  'pesquisar_constituicao',
                  'listar_codigos_disponiveis',
                  'listar_sites_legislacao',
                ],
              }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`[consulta-legislacao] Erro:`, error);

    const mensagemErro = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              erro: mensagemErro,
              dica: 'Verifique os parametros e tente novamente',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Iniciar o servidor
async function main() {
  console.error('[consulta-legislacao] Iniciando servidor MCP v2.0 (navegador)...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[consulta-legislacao] Servidor MCP conectado e pronto');
  console.error('[consulta-legislacao] MODO: Instrucoes de navegacao (use dev-browser)');
  console.error('[consulta-legislacao] Ferramentas disponiveis:');
  console.error('[consulta-legislacao]   - pesquisar_lei');
  console.error('[consulta-legislacao]   - pesquisar_legislacao');
  console.error('[consulta-legislacao]   - consultar_codigo');
  console.error('[consulta-legislacao]   - buscar_jurisprudencia');
  console.error('[consulta-legislacao]   - pesquisar_decreto');
  console.error('[consulta-legislacao]   - pesquisar_medida_provisoria');
  console.error('[consulta-legislacao]   - pesquisar_sumula');
  console.error('[consulta-legislacao]   - pesquisar_constituicao');
  console.error('[consulta-legislacao]   - listar_codigos_disponiveis');
  console.error('[consulta-legislacao]   - listar_sites_legislacao');
}

main().catch((error) => {
  console.error('[consulta-legislacao] Erro fatal:', error);
  process.exit(1);
});
