/**
 * Cliente HTTP para a API DataJud do CNJ
 * 
 * API Base: https://api-publica.datajud.cnj.jus.br
 * Documentação: https://datajud-wiki.cnj.jus.br/
 */

import {
  type TribunalSigla,
  type DataJudResponse,
  type ProcessoDataJud,
  type Movimento,
  type PesquisaParams,
  type ResultadoConsulta,
  TRIBUNAIS,
} from './types.js';

const API_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';

/**
 * Cliente para consultas à API DataJud
 */
export class DataJudClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API Key do DataJud é obrigatória. Obtenha em: https://datajud-wiki.cnj.jus.br/');
    }
    this.apiKey = apiKey;
  }

  /**
   * Faz uma requisição para a API DataJud
   */
  private async request(
    tribunal: TribunalSigla,
    body: Record<string, unknown>
  ): Promise<DataJudResponse> {
    const url = `${API_BASE_URL}/api_publica_${tribunal}/_search`;

    console.error(`[consulta-processos] Requisição para: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `APIKey ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[consulta-processos] Erro na API: ${response.status} - ${errorText}`);
      throw new Error(
        `Erro na API DataJud: ${response.status} ${response.statusText}. ` +
        `Verifique se o tribunal "${tribunal}" é válido e se a API Key está correta.`
      );
    }

    const data = await response.json() as DataJudResponse;
    return data;
  }

  /**
   * Consulta um processo específico pelo número NPU
   * 
   * @param tribunal Sigla do tribunal (ex: "tjsp", "stj")
   * @param numeroProcesso Número do processo no formato NPU (NNNNNNN-NN.NNNN.N.NN.NNNN)
   * @returns Dados do processo ou null se não encontrado
   */
  async consultarProcesso(
    tribunal: TribunalSigla,
    numeroProcesso: string
  ): Promise<ProcessoDataJud | null> {
    // Remove caracteres não numéricos e pontuação para normalização
    const numeroNormalizado = numeroProcesso.replace(/\D/g, '');

    const query = {
      query: {
        bool: {
          must: [
            {
              match: {
                numeroProcesso: numeroNormalizado,
              },
            },
          ],
        },
      },
      size: 1,
    };

    const response = await this.request(tribunal, query);

    if (response.hits.hits.length === 0) {
      return null;
    }

    return response.hits.hits[0]._source;
  }

  /**
   * Pesquisa processos por diversos critérios
   * 
   * @param params Parâmetros de pesquisa
   * @returns Resultado da pesquisa com lista de processos
   */
  async pesquisarProcessos(params: PesquisaParams): Promise<ResultadoConsulta> {
    const { tribunal, tamanho = 10, pagina = 0 } = params;
    const must: Array<Record<string, unknown>> = [];
    const filter: Array<Record<string, unknown>> = [];

    // Filtro por número do processo
    if (params.numeroProcesso) {
      const numeroNormalizado = params.numeroProcesso.replace(/\D/g, '');
      must.push({
        match: {
          numeroProcesso: numeroNormalizado,
        },
      });
    }

    // Filtro por classe processual
    if (params.classe) {
      filter.push({
        term: {
          'classe.codigo': params.classe,
        },
      });
    }

    // Filtro por órgão julgador
    if (params.orgaoJulgador) {
      filter.push({
        term: {
          'orgaoJulgador.codigo': params.orgaoJulgador,
        },
      });
    }

    // Filtro por assunto
    if (params.assunto) {
      filter.push({
        nested: {
          path: 'assuntos',
          query: {
            term: {
              'assuntos.codigo': params.assunto,
            },
          },
        },
      });
    }

    // Filtro por data de ajuizamento
    if (params.dataAjuizamentoInicio || params.dataAjuizamentoFim) {
      const range: Record<string, string> = {};
      if (params.dataAjuizamentoInicio) {
        range.gte = params.dataAjuizamentoInicio;
      }
      if (params.dataAjuizamentoFim) {
        range.lte = params.dataAjuizamentoFim;
      }
      filter.push({
        range: {
          dataAjuizamento: range,
        },
      });
    }

    // Filtro por nome da parte
    if (params.nomeParte) {
      must.push({
        nested: {
          path: 'partes',
          query: {
            match: {
              'partes.nome': {
                query: params.nomeParte,
                fuzziness: 'AUTO',
              },
            },
          },
        },
      });
    }

    // Se não há filtros, busca todos com ordenação por data
    const queryBody: Record<string, unknown> = {
      size: tamanho,
      from: pagina * tamanho,
      sort: [
        {
          dataAjuizamento: {
            order: 'desc',
          },
        },
      ],
    };

    if (must.length > 0 || filter.length > 0) {
      queryBody.query = {
        bool: {
          ...(must.length > 0 && { must }),
          ...(filter.length > 0 && { filter }),
        },
      };
    } else {
      queryBody.query = {
        match_all: {},
      };
    }

    const response = await this.request(tribunal, queryBody);

    return {
      total: response.hits.total.value,
      processos: response.hits.hits.map((hit) => hit._source),
      pagina,
      tamanho,
    };
  }

  /**
   * Lista as movimentações de um processo
   * 
   * @param tribunal Sigla do tribunal
   * @param numeroProcesso Número do processo
   * @returns Lista de movimentações ordenadas por data (mais recente primeiro)
   */
  async listarMovimentacoes(
    tribunal: TribunalSigla,
    numeroProcesso: string
  ): Promise<Movimento[]> {
    const processo = await this.consultarProcesso(tribunal, numeroProcesso);

    if (!processo) {
      throw new Error(
        `Processo ${numeroProcesso} não encontrado no tribunal ${tribunal.toUpperCase()}`
      );
    }

    // Ordenar movimentações por data (mais recente primeiro)
    const movimentacoes = [...processo.movimentos];
    movimentacoes.sort((a, b) => {
      return new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime();
    });

    return movimentacoes;
  }

  /**
   * Lista todos os tribunais disponíveis
   * 
   * @returns Lista de tribunais com sigla e nome completo
   */
  static listarTribunais(): Array<{ sigla: TribunalSigla; nome: string }> {
    return Object.entries(TRIBUNAIS).map(([sigla, nome]) => ({
      sigla: sigla as TribunalSigla,
      nome,
    }));
  }

  /**
   * Valida se um tribunal existe
   * 
   * @param tribunal Sigla do tribunal
   * @returns true se válido
   */
  static validarTribunal(tribunal: string): tribunal is TribunalSigla {
    return tribunal.toLowerCase() in TRIBUNAIS;
  }

  /**
   * Formata o número do processo para exibição
   * 
   * @param numero Número do processo (só dígitos ou formatado)
   * @returns Número formatado no padrão NPU
   */
  static formatarNumeroProcesso(numero: string): string {
    // Remove tudo que não é dígito
    const digitos = numero.replace(/\D/g, '');

    // NPU: NNNNNNN-NN.NNNN.N.NN.NNNN (20 dígitos)
    if (digitos.length === 20) {
      return `${digitos.slice(0, 7)}-${digitos.slice(7, 9)}.${digitos.slice(9, 13)}.${digitos.slice(13, 14)}.${digitos.slice(14, 16)}.${digitos.slice(16, 20)}`;
    }

    // Retorna o número original se não puder formatar
    return numero;
  }
}
