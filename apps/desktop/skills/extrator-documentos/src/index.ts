#!/usr/bin/env node
/**
 * MCP Server para extração de texto e análise de documentos PDF e DOCX jurídicos
 * 
 * Este servidor expõe ferramentas para:
 * - Extrair texto de documentos (PDF, DOCX, TXT)
 * - Analisar peças jurídicas (identificar partes, pedidos, fundamentos)
 * - Extrair cláusulas de contratos
 * - Comparar documentos
 */

console.error('[extrator-documentos] Script starting...');
console.error('[extrator-documentos] Node version:', process.version);

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { extractPDF } from './extractors/pdf-extractor.js';
import { extractDOCX } from './extractors/docx-extractor.js';

console.error('[extrator-documentos] All imports completed successfully');

// ============================================================================
// Tipos e interfaces
// ============================================================================

interface InformacaoEstruturada {
  numeroProcesso: string | null;
  partes: {
    autor: string[];
    reu: string[];
    outros: string[];
  };
  valorCausa: string | null;
  pedidos: string[];
  fundamentos: string[];
  tipoDocumento: string | null;
}

interface ClausulaContrato {
  numero: string;
  titulo: string;
  conteudo: string;
}

interface ResultadoComparacao {
  similaridade: number;
  diferencas: {
    apenasDocumento1: string[];
    apenasDocumento2: string[];
    emComum: string[];
  };
  resumo: string;
}

// ============================================================================
// Schemas de validação Zod
// ============================================================================

const FormatoSaidaSchema = z.enum(['texto', 'resumo', 'estruturado']).default('texto');

const ExtrairDocumentoSchema = z.object({
  caminhoArquivo: z.string().describe('Caminho completo para o arquivo (PDF, DOCX ou TXT)'),
  formato: FormatoSaidaSchema.describe('Formato de saída: texto (completo), resumo (primeiros 2000 chars), estruturado (com metadados)'),
});

const AnalisarPecaJuridicaSchema = z.object({
  caminhoArquivo: z.string().describe('Caminho para o arquivo da peça jurídica'),
  tipoPeca: z.string().optional().describe('Tipo da peça (petição inicial, contestação, sentença, etc.)'),
});

const ExtrairClausulasContratoSchema = z.object({
  caminhoArquivo: z.string().describe('Caminho para o arquivo do contrato'),
  filtroClausulas: z.array(z.string()).optional().describe('Filtrar cláusulas por palavras-chave'),
});

const CompararDocumentosSchema = z.object({
  caminhoArquivo1: z.string().describe('Caminho para o primeiro documento'),
  caminhoArquivo2: z.string().describe('Caminho para o segundo documento'),
});

// ============================================================================
// Funções auxiliares
// ============================================================================

/**
 * Extrai texto de qualquer tipo de arquivo suportado
 */
async function extrairTexto(caminhoArquivo: string): Promise<{ texto: string; erro?: string }> {
  const ext = path.extname(caminhoArquivo).toLowerCase();

  switch (ext) {
    case '.pdf': {
      const result = await extractPDF(caminhoArquivo);
      return result.sucesso 
        ? { texto: result.texto } 
        : { texto: '', erro: result.erro };
    }
    case '.docx': {
      const result = await extractDOCX(caminhoArquivo);
      return result.sucesso 
        ? { texto: result.texto } 
        : { texto: '', erro: result.erro };
    }
    case '.txt': {
      try {
        const texto = fs.readFileSync(caminhoArquivo, 'utf-8');
        return { texto };
      } catch (error) {
        return { texto: '', erro: error instanceof Error ? error.message : String(error) };
      }
    }
    default:
      return { texto: '', erro: `Formato não suportado: ${ext}. Use PDF, DOCX ou TXT.` };
  }
}

/**
 * Extrai informações estruturadas de um texto jurídico usando regex
 */
function extractStructuredInfo(texto: string): InformacaoEstruturada {
  const info: InformacaoEstruturada = {
    numeroProcesso: null,
    partes: {
      autor: [],
      reu: [],
      outros: [],
    },
    valorCausa: null,
    pedidos: [],
    fundamentos: [],
    tipoDocumento: null,
  };

  // Número do processo (formato NPU)
  // Padrão: NNNNNNN-DD.AAAA.J.TR.OOOO
  const processoRegex = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
  const processoMatch = texto.match(processoRegex);
  if (processoMatch) {
    info.numeroProcesso = processoMatch[0];
  }

  // Tentar outros formatos de número de processo
  if (!info.numeroProcesso) {
    const processoAltRegex = /(?:processo|autos|proc\.?)\s*(?:n[º°]?\.?\s*)?\s*:?\s*(\d[\d./-]+\d)/i;
    const altMatch = texto.match(processoAltRegex);
    if (altMatch) {
      info.numeroProcesso = altMatch[1];
    }
  }

  // Autor/Requerente
  const autorPatterns = [
    /(?:autor|requerente|demandante|exequente|reclamante)\s*[:;]?\s*([^\n\r]+)/gi,
    /([^\n\r]+?)\s*,?\s*(?:qualificad[oa]s? nos autos|já qualificad[oa])/gi,
  ];
  for (const pattern of autorPatterns) {
    const matches = texto.matchAll(pattern);
    for (const match of matches) {
      const autor = match[1].trim();
      if (autor.length > 2 && autor.length < 200 && !info.partes.autor.includes(autor)) {
        info.partes.autor.push(autor);
      }
    }
  }

  // Réu/Requerido
  const reuPatterns = [
    /(?:réu|ré|requerid[oa]|demandad[oa]|executad[oa]|reclamad[oa])\s*[:;]?\s*([^\n\r]+)/gi,
    /(?:em face de|contra)\s+([^\n\r,]+)/gi,
  ];
  for (const pattern of reuPatterns) {
    const matches = texto.matchAll(pattern);
    for (const match of matches) {
      const reu = match[1].trim();
      if (reu.length > 2 && reu.length < 200 && !info.partes.reu.includes(reu)) {
        info.partes.reu.push(reu);
      }
    }
  }

  // Valor da causa
  const valorPatterns = [
    /valor\s*(?:da\s*)?causa\s*[:;]?\s*R?\$?\s*([\d.,]+)/i,
    /R\$\s*([\d.,]+(?:\s*(?:mil|milhões?|bilhões?))?)/gi,
  ];
  for (const pattern of valorPatterns) {
    const match = texto.match(pattern);
    if (match) {
      info.valorCausa = `R$ ${match[1].trim()}`;
      break;
    }
  }

  // Pedidos
  const pedidoPatterns = [
    /(?:requer|pede|pleiteia|postula)\s*[:;]?\s*([^\n\r]+)/gi,
    /(?:dos pedidos|pedidos?)\s*[:;]?\s*\n([^]+?)(?:\n\s*\n|\n\s*(?:ii|iii|iv|v|vi|\d+\.|fundament))/gi,
  ];
  for (const pattern of pedidoPatterns) {
    const matches = texto.matchAll(pattern);
    for (const match of matches) {
      const pedido = match[1].trim();
      if (pedido.length > 10 && pedido.length < 500 && !info.pedidos.includes(pedido)) {
        info.pedidos.push(pedido);
      }
    }
  }
  // Limitar a 10 pedidos
  info.pedidos = info.pedidos.slice(0, 10);

  // Fundamentos jurídicos
  const fundamentoPatterns = [
    /(?:art(?:igo)?\.?\s*\d+[^\n\r]{0,100})/gi,
    /(?:lei\s*(?:n[º°]?\.?)?\s*[\d.]+\/\d+[^\n\r]{0,50})/gi,
    /(?:código\s+(?:civil|penal|de\s+processo)[^\n\r]{0,50})/gi,
    /(?:súmula\s*(?:n[º°]?\.?)?\s*\d+[^\n\r]{0,100})/gi,
    /(?:constituição\s+federal[^\n\r]{0,100})/gi,
  ];
  for (const pattern of fundamentoPatterns) {
    const matches = texto.matchAll(pattern);
    for (const match of matches) {
      const fundamento = match[0].trim();
      if (fundamento.length > 5 && !info.fundamentos.includes(fundamento)) {
        info.fundamentos.push(fundamento);
      }
    }
  }
  // Limitar a 20 fundamentos
  info.fundamentos = info.fundamentos.slice(0, 20);

  // Tipo de documento
  const tipoPatterns = [
    { pattern: /petição\s+inicial/i, tipo: 'Petição Inicial' },
    { pattern: /contestação/i, tipo: 'Contestação' },
    { pattern: /sentença/i, tipo: 'Sentença' },
    { pattern: /acórdão/i, tipo: 'Acórdão' },
    { pattern: /recurso\s+(?:de\s+)?apelação/i, tipo: 'Recurso de Apelação' },
    { pattern: /agravo\s+de\s+instrumento/i, tipo: 'Agravo de Instrumento' },
    { pattern: /mandado\s+de\s+segurança/i, tipo: 'Mandado de Segurança' },
    { pattern: /habeas\s+corpus/i, tipo: 'Habeas Corpus' },
    { pattern: /contrato/i, tipo: 'Contrato' },
    { pattern: /procuração/i, tipo: 'Procuração' },
    { pattern: /parecer/i, tipo: 'Parecer' },
    { pattern: /laudo/i, tipo: 'Laudo' },
    { pattern: /notificação\s+extrajudicial/i, tipo: 'Notificação Extrajudicial' },
  ];
  for (const { pattern, tipo } of tipoPatterns) {
    if (pattern.test(texto)) {
      info.tipoDocumento = tipo;
      break;
    }
  }

  return info;
}

/**
 * Extrai cláusulas de um contrato
 */
function extractClausulas(texto: string, filtro?: string[]): ClausulaContrato[] {
  const clausulas: ClausulaContrato[] = [];

  // Padrões para identificar cláusulas
  const clausulaPatterns = [
    // CLÁUSULA PRIMEIRA, CLÁUSULA 1, etc.
    /(?:cláusula|clausula)\s+(?:(\w+)|(\d+[ªº]?))\s*[-–:]?\s*([^\n]+)\n([^]*?)(?=(?:cláusula|clausula)\s+(?:\w+|\d+)|$)/gi,
    // 1. TÍTULO, 1 - TÍTULO, etc.
    /^(\d+(?:\.\d+)?)\s*[-–.)]?\s*([A-Z][^\n]+)\n([^]*?)(?=^\d+(?:\.\d+)?\s*[-–.)]?\s*[A-Z]|$)/gim,
  ];

  for (const pattern of clausulaPatterns) {
    const matches = texto.matchAll(pattern);
    for (const match of matches) {
      let numero: string;
      let titulo: string;
      let conteudo: string;

      if (match[1] && (match[1].match(/^\d/) || match[1].match(/^primeiro|segund|terceir|quart|quint|sext|sétim|oitav|non|décim/i))) {
        // Padrão CLÁUSULA PRIMEIRA/1
        numero = match[1] || match[2] || '';
        titulo = match[3]?.trim() || '';
        conteudo = match[4]?.trim() || '';
      } else {
        // Padrão numérico
        numero = match[1] || '';
        titulo = match[2]?.trim() || '';
        conteudo = match[3]?.trim() || '';
      }

      // Aplicar filtro se fornecido
      if (filtro && filtro.length > 0) {
        const textoClausula = `${titulo} ${conteudo}`.toLowerCase();
        const passaFiltro = filtro.some(palavra => 
          textoClausula.includes(palavra.toLowerCase())
        );
        if (!passaFiltro) continue;
      }

      if (titulo || conteudo) {
        clausulas.push({
          numero: numero.toUpperCase(),
          titulo,
          conteudo: conteudo.substring(0, 2000), // Limitar tamanho
        });
      }
    }
  }

  return clausulas;
}

/**
 * Compara dois textos e retorna diferenças
 */
function compararTextos(texto1: string, texto2: string): ResultadoComparacao {
  // Normalizar e tokenizar
  const normalizar = (texto: string) => 
    texto.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

  const palavras1 = new Set(normalizar(texto1));
  const palavras2 = new Set(normalizar(texto2));

  const apenasDoc1: string[] = [];
  const apenasDoc2: string[] = [];
  const emComum: string[] = [];

  // Encontrar palavras exclusivas e em comum
  for (const palavra of palavras1) {
    if (palavras2.has(palavra)) {
      emComum.push(palavra);
    } else {
      apenasDoc1.push(palavra);
    }
  }

  for (const palavra of palavras2) {
    if (!palavras1.has(palavra)) {
      apenasDoc2.push(palavra);
    }
  }

  // Calcular similaridade (Jaccard)
  const totalUnico = palavras1.size + palavras2.size - emComum.length;
  const similaridade = totalUnico > 0 ? (emComum.length / totalUnico) * 100 : 0;

  // Gerar resumo
  let resumo: string;
  if (similaridade > 90) {
    resumo = 'Os documentos são muito similares (>90% de similaridade)';
  } else if (similaridade > 70) {
    resumo = 'Os documentos têm alta similaridade (70-90%)';
  } else if (similaridade > 50) {
    resumo = 'Os documentos têm similaridade moderada (50-70%)';
  } else if (similaridade > 30) {
    resumo = 'Os documentos têm baixa similaridade (30-50%)';
  } else {
    resumo = 'Os documentos são muito diferentes (<30% de similaridade)';
  }

  return {
    similaridade: Math.round(similaridade * 100) / 100,
    diferencas: {
      apenasDocumento1: apenasDoc1.slice(0, 50),
      apenasDocumento2: apenasDoc2.slice(0, 50),
      emComum: emComum.slice(0, 50),
    },
    resumo,
  };
}

// ============================================================================
// Servidor MCP
// ============================================================================

const server = new Server(
  {
    name: 'extrator-documentos',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler para listar ferramentas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'extrair_documento',
        description:
          'Extrai texto de documentos PDF, DOCX ou TXT. ' +
          'Suporta três formatos de saída: texto (completo), resumo (primeiros 2000 caracteres) ' +
          'ou estruturado (com metadados e informações extraídas).',
        inputSchema: {
          type: 'object',
          properties: {
            caminhoArquivo: {
              type: 'string',
              description: 'Caminho completo para o arquivo (PDF, DOCX ou TXT)',
            },
            formato: {
              type: 'string',
              enum: ['texto', 'resumo', 'estruturado'],
              description: 'Formato de saída desejado',
              default: 'texto',
            },
          },
          required: ['caminhoArquivo'],
        },
      },
      {
        name: 'analisar_peca_juridica',
        description:
          'Analisa peças jurídicas identificando automaticamente: ' +
          'número do processo (NPU), partes (autor/réu), valor da causa, ' +
          'pedidos, fundamentos jurídicos e tipo de documento.',
        inputSchema: {
          type: 'object',
          properties: {
            caminhoArquivo: {
              type: 'string',
              description: 'Caminho para o arquivo da peça jurídica',
            },
            tipoPeca: {
              type: 'string',
              description: 'Tipo da peça (opcional: petição inicial, contestação, sentença, etc.)',
            },
          },
          required: ['caminhoArquivo'],
        },
      },
      {
        name: 'extrair_clausulas_contrato',
        description:
          'Extrai e lista cláusulas de contratos jurídicos. ' +
          'Retorna número, título e conteúdo de cada cláusula. ' +
          'Permite filtrar cláusulas por palavras-chave.',
        inputSchema: {
          type: 'object',
          properties: {
            caminhoArquivo: {
              type: 'string',
              description: 'Caminho para o arquivo do contrato',
            },
            filtroClausulas: {
              type: 'array',
              items: { type: 'string' },
              description: 'Lista de palavras-chave para filtrar cláusulas',
            },
          },
          required: ['caminhoArquivo'],
        },
      },
      {
        name: 'comparar_documentos',
        description:
          'Compara dois documentos jurídicos, calculando a similaridade ' +
          'e identificando diferenças. Útil para verificar versões de contratos ' +
          'ou comparar peças processuais.',
        inputSchema: {
          type: 'object',
          properties: {
            caminhoArquivo1: {
              type: 'string',
              description: 'Caminho para o primeiro documento',
            },
            caminhoArquivo2: {
              type: 'string',
              description: 'Caminho para o segundo documento',
            },
          },
          required: ['caminhoArquivo1', 'caminhoArquivo2'],
        },
      },
    ],
  };
});

// Handler para execução das ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  console.error(`[extrator-documentos] Executando ferramenta: ${name}`);
  console.error(`[extrator-documentos] Argumentos:`, JSON.stringify(args));

  try {
    switch (name) {
      case 'extrair_documento': {
        const params = ExtrairDocumentoSchema.parse(args);
        const { texto, erro } = await extrairTexto(params.caminhoArquivo);

        if (erro) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  sucesso: false,
                  erro,
                  caminhoArquivo: params.caminhoArquivo,
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        let resultado: Record<string, unknown>;

        switch (params.formato) {
          case 'resumo':
            resultado = {
              sucesso: true,
              formato: 'resumo',
              caminhoArquivo: params.caminhoArquivo,
              tamanhoTextoTotal: texto.length,
              resumo: texto.substring(0, 2000) + (texto.length > 2000 ? '...' : ''),
            };
            break;

          case 'estruturado': {
            const ext = path.extname(params.caminhoArquivo).toLowerCase();
            let metadados: Record<string, unknown> = {};

            if (ext === '.pdf') {
              const pdfResult = await extractPDF(params.caminhoArquivo);
              metadados = {
                numeroPaginas: pdfResult.numeroPaginas,
                tamanhoBytes: pdfResult.tamanhoBytes,
                ...pdfResult.metadados,
              };
            } else if (ext === '.docx') {
              const docxResult = await extractDOCX(params.caminhoArquivo);
              metadados = {
                tamanhoBytes: docxResult.tamanhoBytes,
                mensagensConversao: docxResult.mensagensConversao,
              };
            }

            const infoEstruturada = extractStructuredInfo(texto);

            resultado = {
              sucesso: true,
              formato: 'estruturado',
              caminhoArquivo: params.caminhoArquivo,
              metadados,
              informacoesExtraidas: infoEstruturada,
              texto: texto.substring(0, 5000) + (texto.length > 5000 ? '...' : ''),
            };
            break;
          }

          default:
            resultado = {
              sucesso: true,
              formato: 'texto',
              caminhoArquivo: params.caminhoArquivo,
              tamanhoTexto: texto.length,
              texto,
            };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultado, null, 2),
            },
          ],
        };
      }

      case 'analisar_peca_juridica': {
        const params = AnalisarPecaJuridicaSchema.parse(args);
        const { texto, erro } = await extrairTexto(params.caminhoArquivo);

        if (erro) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  sucesso: false,
                  erro,
                  caminhoArquivo: params.caminhoArquivo,
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        const analise = extractStructuredInfo(texto);

        // Sobrescrever tipo se fornecido
        if (params.tipoPeca) {
          analise.tipoDocumento = params.tipoPeca;
        }

        const resultado = {
          sucesso: true,
          caminhoArquivo: params.caminhoArquivo,
          tamanhoTexto: texto.length,
          analise: {
            tipoDocumento: analise.tipoDocumento || 'Não identificado',
            numeroProcesso: analise.numeroProcesso || 'Não encontrado',
            partes: {
              autor: analise.partes.autor.length > 0 ? analise.partes.autor : ['Não identificado'],
              reu: analise.partes.reu.length > 0 ? analise.partes.reu : ['Não identificado'],
            },
            valorCausa: analise.valorCausa || 'Não informado',
            pedidos: analise.pedidos.length > 0 ? analise.pedidos : ['Nenhum pedido identificado'],
            fundamentosJuridicos: analise.fundamentos.length > 0 ? analise.fundamentos : ['Nenhum fundamento identificado'],
          },
          trechoInicial: texto.substring(0, 1000) + (texto.length > 1000 ? '...' : ''),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultado, null, 2),
            },
          ],
        };
      }

      case 'extrair_clausulas_contrato': {
        const params = ExtrairClausulasContratoSchema.parse(args);
        const { texto, erro } = await extrairTexto(params.caminhoArquivo);

        if (erro) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  sucesso: false,
                  erro,
                  caminhoArquivo: params.caminhoArquivo,
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        const clausulas = extractClausulas(texto, params.filtroClausulas);

        const resultado = {
          sucesso: true,
          caminhoArquivo: params.caminhoArquivo,
          totalClausulas: clausulas.length,
          filtroAplicado: params.filtroClausulas || null,
          clausulas: clausulas.map((c, idx) => ({
            indice: idx + 1,
            numero: c.numero || `${idx + 1}`,
            titulo: c.titulo || 'Sem título',
            conteudo: c.conteudo,
          })),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultado, null, 2),
            },
          ],
        };
      }

      case 'comparar_documentos': {
        const params = CompararDocumentosSchema.parse(args);

        // Extrair texto de ambos os documentos
        const [resultado1, resultado2] = await Promise.all([
          extrairTexto(params.caminhoArquivo1),
          extrairTexto(params.caminhoArquivo2),
        ]);

        if (resultado1.erro || resultado2.erro) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  sucesso: false,
                  erros: {
                    documento1: resultado1.erro || null,
                    documento2: resultado2.erro || null,
                  },
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        const comparacao = compararTextos(resultado1.texto, resultado2.texto);

        const resultado = {
          sucesso: true,
          documento1: {
            caminho: params.caminhoArquivo1,
            tamanhoTexto: resultado1.texto.length,
          },
          documento2: {
            caminho: params.caminhoArquivo2,
            tamanhoTexto: resultado2.texto.length,
          },
          comparacao: {
            similaridadePercentual: comparacao.similaridade,
            resumo: comparacao.resumo,
            palavrasExclusivasDocumento1: comparacao.diferencas.apenasDocumento1,
            palavrasExclusivasDocumento2: comparacao.diferencas.apenasDocumento2,
            palavrasEmComum: comparacao.diferencas.emComum,
          },
        };

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
                sucesso: false,
                erro: `Ferramenta desconhecida: ${name}`,
              }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`[extrator-documentos] Erro:`, error);

    const mensagemErro = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            sucesso: false,
            erro: mensagemErro,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Iniciar o servidor
async function main() {
  console.error('[extrator-documentos] Iniciando servidor MCP...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[extrator-documentos] Servidor MCP conectado e pronto');
  console.error('[extrator-documentos] Ferramentas disponíveis:');
  console.error('[extrator-documentos]   - extrair_documento');
  console.error('[extrator-documentos]   - analisar_peca_juridica');
  console.error('[extrator-documentos]   - extrair_clausulas_contrato');
  console.error('[extrator-documentos]   - comparar_documentos');
}

main().catch((error) => {
  console.error('[extrator-documentos] Erro fatal:', error);
  process.exit(1);
});
