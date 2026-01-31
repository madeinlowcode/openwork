#!/usr/bin/env node
/**
 * MCP Server para consulta de legislacao brasileira via API LexML do Senado
 *
 * Este servidor expoe ferramentas para consultar leis, codigos, decretos,
 * medidas provisorias e jurisprudencia usando a API publica do LexML.
 *
 * API: https://www.lexml.gov.br/busca/SRU (publica, sem autenticacao)
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
import { LexMLClient, type ResultadoBusca, type RegistroLexML } from './lexml-client.js';

console.error('[consulta-legislacao] All imports completed successfully');

// Cliente LexML (singleton)
const client = new LexMLClient();

// Schemas de validacao para os parametros das ferramentas
const PesquisarLeiSchema = z.object({
  numero: z.union([z.number(), z.string()]).describe('Numero da lei'),
  ano: z.number().describe('Ano da lei'),
  complementar: z.boolean().optional().default(false).describe('Se e lei complementar'),
});

const PesquisarLegislacaoSchema = z.object({
  termo: z.string().describe('Termo de busca nas ementas'),
  maxResultados: z.number().min(1).max(50).optional().default(10).describe('Quantidade maxima de resultados'),
});

const ConsultarCodigoSchema = z.object({
  codigo: z.enum(['civil', 'penal', 'clt', 'cdc', 'cpc', 'cpp', 'ctb', 'eca']).describe(
    'Codigo a consultar: civil (Codigo Civil), penal (Codigo Penal), clt (CLT), cdc (CDC), cpc (CPC), cpp (CPP), ctb (CTB), eca (ECA)'
  ),
  artigo: z.number().optional().describe('Numero do artigo (opcional)'),
});

const BuscarJurisprudenciaSchema = z.object({
  termo: z.string().describe('Termo de busca na jurisprudencia'),
  maxResultados: z.number().min(1).max(50).optional().default(10).describe('Quantidade maxima de resultados'),
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

const PesquisarAvancadaSchema = z.object({
  query: z.string().describe('Query CQL para busca avancada'),
  maxResultados: z.number().min(1).max(50).optional().default(10).describe('Quantidade maxima de resultados'),
});

// Funcao helper para formatar resultados
function formatarResultado(resultado: ResultadoBusca): object {
  return {
    sucesso: true,
    total: resultado.total,
    quantidadeRetornada: resultado.registros.length,
    query: resultado.query,
    registros: resultado.registros.map((r: RegistroLexML) => ({
      titulo: r.titulo || r.ementa?.substring(0, 100) || 'Sem titulo',
      tipoDocumento: r.tipoDocumento,
      numero: r.numero,
      ano: r.ano,
      data: r.data,
      ementa: r.ementa,
      autoridade: r.autoridade,
      localidade: r.localidade,
      url: r.url,
      urlTextoIntegral: r.urlTextoIntegral,
      descritores: r.descritores,
      urn: r.urn,
    })),
  };
}

// Criar o servidor MCP
const server = new Server(
  {
    name: 'consulta-legislacao',
    version: '1.0.0',
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
          'Pesquisa uma lei especifica pelo numero e ano. ' +
          'Pode buscar leis ordinarias ou complementares. ' +
          'Retorna informacoes como ementa, data, URN e link para texto integral.',
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
          'Pesquisa legislacao por termo livre nas ementas. ' +
          'Util para encontrar leis sobre um determinado assunto. ' +
          'Exemplo: "direito do consumidor", "meio ambiente", "trabalho".',
        inputSchema: {
          type: 'object',
          properties: {
            termo: {
              type: 'string',
              description: 'Termo de busca (ex: "direito do consumidor")',
            },
            maxResultados: {
              type: 'number',
              description: 'Quantidade maxima de resultados (padrao: 10, max: 50)',
              default: 10,
            },
          },
          required: ['termo'],
        },
      },
      {
        name: 'consultar_codigo',
        description:
          'Consulta um dos principais codigos brasileiros. ' +
          'Codigos disponiveis: civil (CC), penal (CP), clt, cdc, cpc, cpp, ctb, eca. ' +
          'Pode filtrar por numero do artigo.',
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
        name: 'buscar_jurisprudencia_termo',
        description:
          'Busca jurisprudencia (acordaos, decisoes) por termo nas ementas. ' +
          'Util para encontrar decisoes sobre um tema especifico.',
        inputSchema: {
          type: 'object',
          properties: {
            termo: {
              type: 'string',
              description: 'Termo de busca na jurisprudencia',
            },
            maxResultados: {
              type: 'number',
              description: 'Quantidade maxima de resultados (padrao: 10, max: 50)',
              default: 10,
            },
          },
          required: ['termo'],
        },
      },
      {
        name: 'pesquisar_decreto',
        description:
          'Pesquisa um decreto especifico pelo numero e ano. ' +
          'Retorna informacoes do decreto incluindo ementa e link.',
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
          'Pesquisa uma medida provisoria pelo numero. ' +
          'O ano e opcional mas ajuda a refinar a busca.',
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
          'Pesquisa sumulas de tribunais superiores (STF, STJ, TST). ' +
          'Pode buscar todas as sumulas de um tribunal ou uma sumula especifica por numero.',
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
          'Pesquisa na Constituicao Federal de 1988. ' +
          'Pode filtrar por numero do artigo.',
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
        name: 'pesquisar_avancada',
        description:
          'Pesquisa avancada usando query CQL (Contextual Query Language). ' +
          'Permite combinar multiplos criterios como tipoDocumento, numero, ano, ementa, autoridade. ' +
          'Exemplo: tipoDocumento=lei AND numero=8078 AND ano=1990',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query CQL para busca avancada',
            },
            maxResultados: {
              type: 'number',
              description: 'Quantidade maxima de resultados (padrao: 10, max: 50)',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'listar_codigos_disponiveis',
        description:
          'Lista todos os codigos brasileiros disponiveis para consulta com suas informacoes.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'listar_tipos_documento',
        description:
          'Lista todos os tipos de documento disponiveis para busca no LexML.',
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
        let resultado: ResultadoBusca;

        if (params.complementar) {
          resultado = await client.pesquisarLeiComplementar(params.numero, params.ano);
        } else {
          resultado = await client.pesquisarLei(params.numero, params.ano);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatarResultado(resultado), null, 2),
            },
          ],
        };
      }

      case 'pesquisar_legislacao': {
        const params = PesquisarLegislacaoSchema.parse(args);
        const resultado = await client.pesquisarPorTermo(params.termo, params.maxResultados);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatarResultado(resultado), null, 2),
            },
          ],
        };
      }

      case 'consultar_codigo': {
        const params = ConsultarCodigoSchema.parse(args);
        const resultado = await client.pesquisarCodigo(params.codigo, params.artigo);

        const codigos = LexMLClient.listarCodigos();
        const infoCodigo = codigos.find(c => c.codigo === params.codigo);

        const resposta = {
          ...formatarResultado(resultado),
          codigoConsultado: {
            sigla: params.codigo.toUpperCase(),
            nome: infoCodigo?.nome,
            lei: infoCodigo ? `Lei ${infoCodigo.numero}/${infoCodigo.ano}` : null,
            artigoFiltrado: params.artigo || null,
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

      case 'buscar_jurisprudencia_termo': {
        const params = BuscarJurisprudenciaSchema.parse(args);
        const resultado = await client.pesquisarJurisprudencia(params.termo, params.maxResultados);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatarResultado(resultado), null, 2),
            },
          ],
        };
      }

      case 'pesquisar_decreto': {
        const params = PesquisarDecretoSchema.parse(args);
        const resultado = await client.pesquisarDecreto(params.numero, params.ano);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatarResultado(resultado), null, 2),
            },
          ],
        };
      }

      case 'pesquisar_medida_provisoria': {
        const params = PesquisarMedidaProvisoriaSchema.parse(args);
        const resultado = await client.pesquisarMedidaProvisoria(params.numero, params.ano);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatarResultado(resultado), null, 2),
            },
          ],
        };
      }

      case 'pesquisar_sumula': {
        const params = PesquisarSumulaSchema.parse(args);
        const resultado = await client.pesquisarSumula(params.tribunal, params.numero);

        const tribunaisNomes: Record<string, string> = {
          stf: 'Supremo Tribunal Federal',
          stj: 'Superior Tribunal de Justica',
          tst: 'Tribunal Superior do Trabalho',
        };

        const resposta = {
          ...formatarResultado(resultado),
          tribunal: {
            sigla: params.tribunal.toUpperCase(),
            nome: tribunaisNomes[params.tribunal],
          },
          sumulaNumero: params.numero || 'todas',
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

      case 'pesquisar_constituicao': {
        const params = PesquisarConstituicaoSchema.parse(args);
        const resultado = await client.pesquisarConstituicao(params.artigo);

        const resposta = {
          ...formatarResultado(resultado),
          constituicao: {
            nome: 'Constituicao da Republica Federativa do Brasil de 1988',
            artigoFiltrado: params.artigo || null,
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

      case 'pesquisar_avancada': {
        const params = PesquisarAvancadaSchema.parse(args);
        const resultado = await client.pesquisarAvancada(params.query, params.maxResultados);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatarResultado(resultado), null, 2),
            },
          ],
        };
      }

      case 'listar_codigos_disponiveis': {
        const codigos = LexMLClient.listarCodigos();

        const resposta = {
          sucesso: true,
          descricao: 'Codigos brasileiros disponiveis para consulta',
          total: codigos.length,
          codigos: codigos.map(c => ({
            sigla: c.codigo,
            nome: c.nome,
            lei: `Lei ${c.numero}/${c.ano}`,
            numero: c.numero,
            ano: c.ano,
          })),
          exemplosUso: [
            'consultar_codigo(codigo="civil") - Consulta o Codigo Civil',
            'consultar_codigo(codigo="cdc", artigo=6) - Consulta Art. 6 do CDC',
            'consultar_codigo(codigo="clt", artigo=473) - Consulta Art. 473 da CLT',
          ],
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

      case 'listar_tipos_documento': {
        const tipos = LexMLClient.listarTiposDocumento();

        const resposta = {
          sucesso: true,
          descricao: 'Tipos de documento disponiveis para busca no LexML',
          total: tipos.length,
          tipos: tipos,
          exemplosQuery: [
            'tipoDocumento=lei AND numero=8078 AND ano=1990',
            'tipoDocumento=decreto AND ano=2024',
            'tipoDocumento=sumula AND autoridade=supremo.tribunal.federal',
            'tipoDocumento=jurisprudencia AND ementa all "direito consumidor"',
          ],
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
    console.error(`[consulta-legislacao] Erro:`, error);

    const mensagemErro = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sucesso: false,
              erro: mensagemErro,
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
  console.error('[consulta-legislacao] Iniciando servidor MCP...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[consulta-legislacao] Servidor MCP conectado e pronto');
  console.error('[consulta-legislacao] Ferramentas disponiveis:');
  console.error('[consulta-legislacao]   - pesquisar_lei');
  console.error('[consulta-legislacao]   - pesquisar_legislacao');
  console.error('[consulta-legislacao]   - consultar_codigo');
  console.error('[consulta-legislacao]   - buscar_jurisprudencia_termo');
  console.error('[consulta-legislacao]   - pesquisar_decreto');
  console.error('[consulta-legislacao]   - pesquisar_medida_provisoria');
  console.error('[consulta-legislacao]   - pesquisar_sumula');
  console.error('[consulta-legislacao]   - pesquisar_constituicao');
  console.error('[consulta-legislacao]   - pesquisar_avancada');
  console.error('[consulta-legislacao]   - listar_codigos_disponiveis');
  console.error('[consulta-legislacao]   - listar_tipos_documento');
}

main().catch((error) => {
  console.error('[consulta-legislacao] Erro fatal:', error);
  process.exit(1);
});
