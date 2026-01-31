#!/usr/bin/env node
/**
 * MCP Server para consulta de processos judiciais via API DataJud do CNJ
 * 
 * Este servidor expõe ferramentas para consultar processos em todos os
 * tribunais brasileiros usando a API pública do DataJud.
 * 
 * Variáveis de ambiente:
 * - DATAJUD_API_KEY: Chave de API do DataJud (obrigatória)
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
import { DataJudClient } from './datajud-client.js';
import { TRIBUNAIS, type TribunalSigla } from './types.js';

console.error('[consulta-processos] All imports completed successfully');

// API Key do DataJud
const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY;

if (!DATAJUD_API_KEY) {
  console.error('[consulta-processos] AVISO: DATAJUD_API_KEY não configurada');
  console.error('[consulta-processos] Obtenha sua chave em: https://datajud-wiki.cnj.jus.br/');
}

// Cliente DataJud (inicializado com lazy loading)
let client: DataJudClient | null = null;

function getClient(): DataJudClient {
  if (!client) {
    if (!DATAJUD_API_KEY) {
      throw new Error(
        'API Key do DataJud não configurada. ' +
        'Configure a variável de ambiente DATAJUD_API_KEY. ' +
        'Obtenha sua chave em: https://datajud-wiki.cnj.jus.br/'
      );
    }
    client = new DataJudClient(DATAJUD_API_KEY);
  }
  return client;
}

// Schemas de validação para os parâmetros das ferramentas
const TribunalSchema = z.enum(Object.keys(TRIBUNAIS) as [TribunalSigla, ...TribunalSigla[]]);

const ConsultarProcessoSchema = z.object({
  tribunal: TribunalSchema.describe('Sigla do tribunal (ex: tjsp, stj, trf3)'),
  numeroProcesso: z.string().describe('Número do processo no formato NPU (ex: 0000000-00.0000.0.00.0000) ou apenas dígitos'),
});

const PesquisarProcessosSchema = z.object({
  tribunal: TribunalSchema.describe('Sigla do tribunal (ex: tjsp, stj, trf3)'),
  numeroProcesso: z.string().optional().describe('Número parcial ou completo do processo'),
  classe: z.number().optional().describe('Código da classe processual'),
  orgaoJulgador: z.number().optional().describe('Código do órgão julgador'),
  dataAjuizamentoInicio: z.string().optional().describe('Data inicial de ajuizamento (formato: YYYY-MM-DD)'),
  dataAjuizamentoFim: z.string().optional().describe('Data final de ajuizamento (formato: YYYY-MM-DD)'),
  assunto: z.number().optional().describe('Código do assunto'),
  nomeParte: z.string().optional().describe('Nome da parte (autor, réu, etc.)'),
  tamanho: z.number().min(1).max(100).default(10).describe('Quantidade de resultados por página (máx: 100)'),
  pagina: z.number().min(0).default(0).describe('Número da página (começa em 0)'),
});

const ListarMovimentacoesSchema = z.object({
  tribunal: TribunalSchema.describe('Sigla do tribunal (ex: tjsp, stj, trf3)'),
  numeroProcesso: z.string().describe('Número do processo no formato NPU ou apenas dígitos'),
  limite: z.number().min(1).max(100).default(20).describe('Quantidade máxima de movimentações a retornar'),
});

// Criar o servidor MCP
const server = new Server(
  {
    name: 'consulta-processos',
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
        name: 'consultar_processo',
        description:
          'Consulta um processo judicial específico pelo número NPU em um tribunal. ' +
          'Retorna informações completas do processo incluindo classe, órgão julgador, ' +
          'partes, assuntos e movimentações.',
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
              description: 'Número do processo no formato NPU (ex: 0000000-00.0000.0.00.0000) ou apenas dígitos',
            },
          },
          required: ['tribunal', 'numeroProcesso'],
        },
      },
      {
        name: 'pesquisar_processos',
        description:
          'Pesquisa processos em um tribunal por diversos critérios como número, ' +
          'classe processual, órgão julgador, data de ajuizamento, assunto ou nome da parte. ' +
          'Retorna uma lista paginada de processos.',
        inputSchema: {
          type: 'object',
          properties: {
            tribunal: {
              type: 'string',
              description: 'Sigla do tribunal (ex: tjsp, stj, trf3)',
              enum: Object.keys(TRIBUNAIS),
            },
            numeroProcesso: {
              type: 'string',
              description: 'Número parcial ou completo do processo (opcional)',
            },
            classe: {
              type: 'number',
              description: 'Código da classe processual (opcional)',
            },
            orgaoJulgador: {
              type: 'number',
              description: 'Código do órgão julgador (opcional)',
            },
            dataAjuizamentoInicio: {
              type: 'string',
              description: 'Data inicial de ajuizamento no formato YYYY-MM-DD (opcional)',
            },
            dataAjuizamentoFim: {
              type: 'string',
              description: 'Data final de ajuizamento no formato YYYY-MM-DD (opcional)',
            },
            assunto: {
              type: 'number',
              description: 'Código do assunto (opcional)',
            },
            nomeParte: {
              type: 'string',
              description: 'Nome da parte - autor, réu, etc. (opcional)',
            },
            tamanho: {
              type: 'number',
              description: 'Quantidade de resultados por página (padrão: 10, máx: 100)',
              default: 10,
            },
            pagina: {
              type: 'number',
              description: 'Número da página, começando em 0 (padrão: 0)',
              default: 0,
            },
          },
          required: ['tribunal'],
        },
      },
      {
        name: 'listar_movimentacoes',
        description:
          'Lista as movimentações (andamentos) de um processo específico. ' +
          'Retorna a lista ordenada da mais recente para a mais antiga.',
        inputSchema: {
          type: 'object',
          properties: {
            tribunal: {
              type: 'string',
              description: 'Sigla do tribunal (ex: tjsp, stj, trf3)',
              enum: Object.keys(TRIBUNAIS),
            },
            numeroProcesso: {
              type: 'string',
              description: 'Número do processo no formato NPU ou apenas dígitos',
            },
            limite: {
              type: 'number',
              description: 'Quantidade máxima de movimentações (padrão: 20, máx: 100)',
              default: 20,
            },
          },
          required: ['tribunal', 'numeroProcesso'],
        },
      },
      {
        name: 'listar_tribunais',
        description:
          'Lista todos os tribunais disponíveis para consulta na API DataJud. ' +
          'Inclui tribunais superiores, regionais federais, estaduais, do trabalho e eleitorais.',
        inputSchema: {
          type: 'object',
          properties: {
            filtro: {
              type: 'string',
              description: 'Filtrar tribunais por tipo: "superiores", "trf", "tj", "trt", "tre" ou "todos" (padrão)',
              enum: ['superiores', 'trf', 'tj', 'trt', 'tre', 'todos'],
            },
          },
          required: [],
        },
      },
    ],
  };
});

// Handler para execução das ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  console.error(`[consulta-processos] Executando ferramenta: ${name}`);
  console.error(`[consulta-processos] Argumentos:`, JSON.stringify(args));

  try {
    switch (name) {
      case 'consultar_processo': {
        const params = ConsultarProcessoSchema.parse(args);
        const dataClient = getClient();
        const processo = await dataClient.consultarProcesso(
          params.tribunal,
          params.numeroProcesso
        );

        if (!processo) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  sucesso: false,
                  mensagem: `Processo ${params.numeroProcesso} não encontrado no ${TRIBUNAIS[params.tribunal]}`,
                  tribunal: params.tribunal,
                  numeroProcesso: params.numeroProcesso,
                }, null, 2),
              },
            ],
          };
        }

        // Formatar resposta de forma mais legível
        const resposta = {
          sucesso: true,
          processo: {
            numero: DataJudClient.formatarNumeroProcesso(processo.numeroProcesso),
            tribunal: processo.tribunal,
            classe: processo.classe,
            dataAjuizamento: processo.dataAjuizamento,
            dataUltimaAtualizacao: processo.dataUltimaAtualizacao,
            grau: processo.grau,
            orgaoJulgador: processo.orgaoJulgador,
            valorCausa: processo.valorCausa,
            assuntos: processo.assuntos,
            partes: processo.partes,
            totalMovimentacoes: processo.movimentos.length,
            ultimasMovimentacoes: processo.movimentos.slice(0, 5),
          },
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

      case 'pesquisar_processos': {
        const params = PesquisarProcessosSchema.parse(args);
        const dataClient = getClient();
        const resultado = await dataClient.pesquisarProcessos(params);

        const resposta = {
          sucesso: true,
          tribunal: TRIBUNAIS[params.tribunal],
          total: resultado.total,
          pagina: resultado.pagina,
          tamanho: resultado.tamanho,
          totalPaginas: Math.ceil(resultado.total / resultado.tamanho),
          processos: resultado.processos.map((p) => ({
            numero: DataJudClient.formatarNumeroProcesso(p.numeroProcesso),
            classe: p.classe.nome,
            dataAjuizamento: p.dataAjuizamento,
            orgaoJulgador: p.orgaoJulgador.nome,
            assuntoPrincipal: p.assuntos[0]?.nome || 'N/A',
          })),
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

      case 'listar_movimentacoes': {
        const params = ListarMovimentacoesSchema.parse(args);
        const dataClient = getClient();
        const movimentacoes = await dataClient.listarMovimentacoes(
          params.tribunal,
          params.numeroProcesso
        );

        // Limitar quantidade de movimentações
        const movimentacoesLimitadas = movimentacoes.slice(0, params.limite);

        const resposta = {
          sucesso: true,
          tribunal: TRIBUNAIS[params.tribunal],
          numeroProcesso: DataJudClient.formatarNumeroProcesso(params.numeroProcesso),
          totalMovimentacoes: movimentacoes.length,
          movimentacoesExibidas: movimentacoesLimitadas.length,
          movimentacoes: movimentacoesLimitadas.map((m) => ({
            data: m.dataHora,
            codigo: m.codigo,
            descricao: m.nome,
            complemento: m.complemento || null,
            complementosTabelados: m.complementosTabelados || [],
          })),
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

      case 'listar_tribunais': {
        const filtro = (args as { filtro?: string })?.filtro || 'todos';
        let tribunais = DataJudClient.listarTribunais();

        // Aplicar filtro por tipo
        switch (filtro) {
          case 'superiores':
            tribunais = tribunais.filter((t) =>
              ['stf', 'stj', 'tst', 'tse', 'stm'].includes(t.sigla)
            );
            break;
          case 'trf':
            tribunais = tribunais.filter((t) => t.sigla.startsWith('trf'));
            break;
          case 'tj':
            tribunais = tribunais.filter((t) => t.sigla.startsWith('tj'));
            break;
          case 'trt':
            tribunais = tribunais.filter((t) => t.sigla.startsWith('trt'));
            break;
          case 'tre':
            tribunais = tribunais.filter((t) => t.sigla.startsWith('tre'));
            break;
        }

        const resposta = {
          sucesso: true,
          filtro,
          total: tribunais.length,
          tribunais: tribunais.map((t) => ({
            sigla: t.sigla,
            nome: t.nome,
          })),
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
                sucesso: false,
                erro: `Ferramenta desconhecida: ${name}`,
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
  console.error('[consulta-processos] Iniciando servidor MCP...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[consulta-processos] Servidor MCP conectado e pronto');
  console.error('[consulta-processos] Ferramentas disponíveis:');
  console.error('[consulta-processos]   - consultar_processo');
  console.error('[consulta-processos]   - pesquisar_processos');
  console.error('[consulta-processos]   - listar_movimentacoes');
  console.error('[consulta-processos]   - listar_tribunais');
}

main().catch((error) => {
  console.error('[consulta-processos] Erro fatal:', error);
  process.exit(1);
});
