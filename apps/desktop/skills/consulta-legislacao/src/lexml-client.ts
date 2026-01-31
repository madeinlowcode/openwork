/**
 * Cliente HTTP para a API LexML do Senado Federal
 *
 * A API LexML utiliza o protocolo SRU (Search/Retrieval via URL) com
 * queries em CQL (Contextual Query Language) para buscar legislacao
 * brasileira.
 *
 * Documentacao: https://www.lexml.gov.br/
 * Endpoint: https://www.lexml.gov.br/busca/SRU
 */

import { XMLParser } from 'fast-xml-parser';

// Base URL da API LexML
const LEXML_BASE_URL = 'https://www.lexml.gov.br/busca/SRU';

// Codigos dos principais tipos de documento
export const TIPOS_DOCUMENTO = {
  lei: 'lei',
  leiComplementar: 'lei.complementar',
  leiOrdinaria: 'lei.ordinaria',
  decretoLei: 'decreto.lei',
  decreto: 'decreto',
  medidaProvisoria: 'medida.provisoria',
  emendaConstitucional: 'emenda.constitucional',
  resolucao: 'resolucao',
  portaria: 'portaria',
  instrucaoNormativa: 'instrucao.normativa',
  jurisprudencia: 'jurisprudencia',
  sumula: 'sumula',
  acordao: 'acordao',
} as const;

export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

// Codigos dos principais orgaos
export const ORGAOS = {
  federal: 'federal',
  senado: 'senado.federal',
  camara: 'camara.deputados',
  stf: 'supremo.tribunal.federal',
  stj: 'superior.tribunal.justica',
  tst: 'tribunal.superior.trabalho',
  tcu: 'tribunal.contas.uniao',
} as const;

export type Orgao = keyof typeof ORGAOS;

// Interface para resultado da busca
export interface ResultadoBusca {
  total: number;
  registros: RegistroLexML[];
  query: string;
}

// Interface para um registro do LexML
export interface RegistroLexML {
  urn: string;
  tipoDocumento: string;
  localidade: string;
  autoridade: string;
  numero?: string;
  ano?: number;
  data?: string;
  ementa?: string;
  titulo?: string;
  url?: string;
  urlTextoIntegral?: string;
  descritores?: string[];
}

// Interface para resposta XML do SRU
interface SRUResponse {
  'srw:searchRetrieveResponse'?: {
    'srw:numberOfRecords'?: string;
    'srw:records'?: {
      'srw:record'?: SRURecord | SRURecord[];
    };
  };
  searchRetrieveResponse?: {
    numberOfRecords?: string;
    records?: {
      record?: SRURecord | SRURecord[];
    };
  };
}

interface SRURecord {
  'srw:recordData'?: {
    'srw_dc:dc'?: DCRecord;
    dc?: DCRecord;
  };
  recordData?: {
    'srw_dc:dc'?: DCRecord;
    dc?: DCRecord;
  };
}

interface DCRecord {
  'dc:identifier'?: string | string[];
  'dc:title'?: string | string[];
  'dc:description'?: string | string[];
  'dc:date'?: string | string[];
  'dc:type'?: string | string[];
  'dc:subject'?: string | string[];
  'dc:publisher'?: string | string[];
  'dc:source'?: string | string[];
  identifier?: string | string[];
  title?: string | string[];
  description?: string | string[];
  date?: string | string[];
  type?: string | string[];
  subject?: string | string[];
  publisher?: string | string[];
  source?: string | string[];
}

/**
 * Cliente para a API LexML do Senado Federal
 */
export class LexMLClient {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: false,
      parseTagValue: true,
      trimValues: true,
    });
  }

  /**
   * Constroi a URL de busca SRU
   */
  private buildSearchUrl(query: string, maxRecords: number = 10): string {
    const params = new URLSearchParams({
      operation: 'searchRetrieve',
      version: '1.1',
      query: query,
      maximumRecords: maxRecords.toString(),
      recordSchema: 'dc',
    });

    return `${LEXML_BASE_URL}?${params.toString()}`;
  }

  /**
   * Extrai o primeiro valor de um campo que pode ser string ou array
   */
  private getFirstValue(value: string | string[] | undefined): string | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value[0];
    return value;
  }

  /**
   * Extrai todos os valores de um campo que pode ser string ou array
   */
  private getAllValues(value: string | string[] | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
  }

  /**
   * Parseia a URN do LexML para extrair informacoes
   */
  private parseUrn(urn: string): Partial<RegistroLexML> {
    // URN formato: urn:lex:br:federal:lei:1990-09-11;8078
    const parts = urn.split(':');
    const result: Partial<RegistroLexML> = { urn };

    if (parts.length >= 5) {
      result.localidade = parts[2] || '';
      result.autoridade = parts[3] || '';
      result.tipoDocumento = parts[4] || '';

      // Extrai numero e data
      if (parts[5]) {
        const infoparts = parts[5].split(';');
        if (infoparts[0]) {
          const dataMatch = infoparts[0].match(/(\d{4})-(\d{2})-(\d{2})/);
          if (dataMatch) {
            result.data = infoparts[0];
            result.ano = parseInt(dataMatch[1], 10);
          }
        }
        if (infoparts[1]) {
          result.numero = infoparts[1];
        }
      }
    }

    return result;
  }

  /**
   * Parseia um registro DC para RegistroLexML
   */
  private parseDCRecord(record: SRURecord): RegistroLexML | null {
    const dc = record['srw:recordData']?.['srw_dc:dc'] ||
               record['srw:recordData']?.dc ||
               record.recordData?.['srw_dc:dc'] ||
               record.recordData?.dc;

    if (!dc) return null;

    const identifier = this.getFirstValue(dc['dc:identifier'] || dc.identifier);
    if (!identifier) return null;

    const urnInfo = this.parseUrn(identifier);
    const descritores = this.getAllValues(dc['dc:subject'] || dc.subject);
    const sources = this.getAllValues(dc['dc:source'] || dc.source);

    return {
      urn: identifier,
      tipoDocumento: urnInfo.tipoDocumento || this.getFirstValue(dc['dc:type'] || dc.type) || '',
      localidade: urnInfo.localidade || '',
      autoridade: urnInfo.autoridade || this.getFirstValue(dc['dc:publisher'] || dc.publisher) || '',
      numero: urnInfo.numero,
      ano: urnInfo.ano,
      data: urnInfo.data || this.getFirstValue(dc['dc:date'] || dc.date),
      ementa: this.getFirstValue(dc['dc:description'] || dc.description),
      titulo: this.getFirstValue(dc['dc:title'] || dc.title),
      url: `https://www.lexml.gov.br/urn/${identifier}`,
      urlTextoIntegral: sources.find(s => s.includes('http')) || undefined,
      descritores,
    };
  }

  /**
   * Executa uma busca no LexML
   */
  async pesquisar(query: string, maxResults: number = 10): Promise<ResultadoBusca> {
    const url = this.buildSearchUrl(query, maxResults);
    console.error(`[lexml-client] Buscando: ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parsed = this.parser.parse(xmlText) as SRUResponse;

      // Extrair dados da resposta SRU
      const sruResponse = parsed['srw:searchRetrieveResponse'] || parsed.searchRetrieveResponse;

      if (!sruResponse) {
        console.error('[lexml-client] Resposta vazia ou invalida');
        return { total: 0, registros: [], query };
      }

      const numberOfRecords = parseInt(
        sruResponse['srw:numberOfRecords'] || sruResponse.numberOfRecords || '0',
        10
      );

      const records = sruResponse['srw:records']?.['srw:record'] ||
                     sruResponse.records?.record ||
                     [];

      const recordArray = Array.isArray(records) ? records : (records ? [records] : []);

      const registros: RegistroLexML[] = [];
      for (const record of recordArray) {
        const parsed = this.parseDCRecord(record);
        if (parsed) {
          registros.push(parsed);
        }
      }

      console.error(`[lexml-client] Encontrados ${numberOfRecords} resultados, retornando ${registros.length}`);

      return {
        total: numberOfRecords,
        registros,
        query,
      };
    } catch (error) {
      console.error('[lexml-client] Erro na busca:', error);
      throw error;
    }
  }

  /**
   * Pesquisa uma lei especifica por numero e ano
   */
  async pesquisarLei(numero: number | string, ano: number): Promise<ResultadoBusca> {
    const query = `tipoDocumento=lei AND numero=${numero} AND ano=${ano}`;
    return this.pesquisar(query, 10);
  }

  /**
   * Pesquisa lei complementar por numero e ano
   */
  async pesquisarLeiComplementar(numero: number | string, ano: number): Promise<ResultadoBusca> {
    const query = `tipoDocumento=lei.complementar AND numero=${numero} AND ano=${ano}`;
    return this.pesquisar(query, 10);
  }

  /**
   * Pesquisa por termo nas ementas
   */
  async pesquisarPorTermo(termo: string, maxResults: number = 10): Promise<ResultadoBusca> {
    // Usar operador "all" para buscar todas as palavras na ementa
    const query = `ementa all "${termo}"`;
    return this.pesquisar(query, maxResults);
  }

  /**
   * Pesquisa na Constituicao Federal de 1988
   * @param artigo Opcional: numero do artigo
   */
  async pesquisarConstituicao(artigo?: number): Promise<ResultadoBusca> {
    let query = 'tipoDocumento=constituicao AND localidade=br';
    if (artigo) {
      query += ` AND texto all "art. ${artigo}"`;
    }
    return this.pesquisar(query, 20);
  }

  /**
   * Pesquisa em um codigo especifico
   * @param codigo Nome do codigo (civil, penal, clt, cdc, cpc, cpp)
   * @param artigo Opcional: numero do artigo
   */
  async pesquisarCodigo(
    codigo: 'civil' | 'penal' | 'clt' | 'cdc' | 'cpc' | 'cpp' | 'ctb' | 'eca',
    artigo?: number
  ): Promise<ResultadoBusca> {
    // Mapeamento de codigos para suas leis
    const codigos: Record<string, { numero: number; ano: number; nome: string }> = {
      civil: { numero: 10406, ano: 2002, nome: 'Codigo Civil' },
      penal: { numero: 2848, ano: 1940, nome: 'Codigo Penal' },
      clt: { numero: 5452, ano: 1943, nome: 'Consolidacao das Leis do Trabalho' },
      cdc: { numero: 8078, ano: 1990, nome: 'Codigo de Defesa do Consumidor' },
      cpc: { numero: 13105, ano: 2015, nome: 'Codigo de Processo Civil' },
      cpp: { numero: 3689, ano: 1941, nome: 'Codigo de Processo Penal' },
      ctb: { numero: 9503, ano: 1997, nome: 'Codigo de Transito Brasileiro' },
      eca: { numero: 8069, ano: 1990, nome: 'Estatuto da Crianca e do Adolescente' },
    };

    const info = codigos[codigo];
    if (!info) {
      throw new Error(`Codigo desconhecido: ${codigo}. Opcoes: ${Object.keys(codigos).join(', ')}`);
    }

    let query = `tipoDocumento=lei AND numero=${info.numero} AND ano=${info.ano}`;
    if (artigo) {
      query += ` AND texto all "art. ${artigo}"`;
    }

    return this.pesquisar(query, 20);
  }

  /**
   * Pesquisa decretos
   */
  async pesquisarDecreto(numero: number, ano: number): Promise<ResultadoBusca> {
    const query = `tipoDocumento=decreto AND numero=${numero} AND ano=${ano}`;
    return this.pesquisar(query, 10);
  }

  /**
   * Pesquisa medidas provisorias
   */
  async pesquisarMedidaProvisoria(numero: number, ano?: number): Promise<ResultadoBusca> {
    let query = `tipoDocumento=medida.provisoria AND numero=${numero}`;
    if (ano) {
      query += ` AND ano=${ano}`;
    }
    return this.pesquisar(query, 10);
  }

  /**
   * Pesquisa jurisprudencia por termo
   */
  async pesquisarJurisprudencia(termo: string, maxResults: number = 10): Promise<ResultadoBusca> {
    const query = `tipoDocumento=jurisprudencia AND ementa all "${termo}"`;
    return this.pesquisar(query, maxResults);
  }

  /**
   * Pesquisa sumulas
   */
  async pesquisarSumula(tribunal: 'stf' | 'stj' | 'tst', numero?: number): Promise<ResultadoBusca> {
    const tribunais: Record<string, string> = {
      stf: 'supremo.tribunal.federal',
      stj: 'superior.tribunal.justica',
      tst: 'tribunal.superior.trabalho',
    };

    let query = `tipoDocumento=sumula AND autoridade=${tribunais[tribunal]}`;
    if (numero) {
      query += ` AND numero=${numero}`;
    }
    return this.pesquisar(query, 20);
  }

  /**
   * Pesquisa avancada com query CQL personalizada
   */
  async pesquisarAvancada(queryCQL: string, maxResults: number = 10): Promise<ResultadoBusca> {
    return this.pesquisar(queryCQL, maxResults);
  }

  /**
   * Lista os tipos de documento disponiveis
   */
  static listarTiposDocumento(): Array<{ codigo: string; descricao: string }> {
    return [
      { codigo: 'lei', descricao: 'Lei (generica)' },
      { codigo: 'lei.complementar', descricao: 'Lei Complementar' },
      { codigo: 'lei.ordinaria', descricao: 'Lei Ordinaria' },
      { codigo: 'decreto.lei', descricao: 'Decreto-Lei' },
      { codigo: 'decreto', descricao: 'Decreto' },
      { codigo: 'medida.provisoria', descricao: 'Medida Provisoria' },
      { codigo: 'emenda.constitucional', descricao: 'Emenda Constitucional' },
      { codigo: 'resolucao', descricao: 'Resolucao' },
      { codigo: 'portaria', descricao: 'Portaria' },
      { codigo: 'instrucao.normativa', descricao: 'Instrucao Normativa' },
      { codigo: 'jurisprudencia', descricao: 'Jurisprudencia' },
      { codigo: 'sumula', descricao: 'Sumula' },
      { codigo: 'acordao', descricao: 'Acordao' },
      { codigo: 'constituicao', descricao: 'Constituicao' },
    ];
  }

  /**
   * Lista os codigos disponiveis para consulta
   */
  static listarCodigos(): Array<{ codigo: string; numero: number; ano: number; nome: string }> {
    return [
      { codigo: 'civil', numero: 10406, ano: 2002, nome: 'Codigo Civil' },
      { codigo: 'penal', numero: 2848, ano: 1940, nome: 'Codigo Penal' },
      { codigo: 'clt', numero: 5452, ano: 1943, nome: 'Consolidacao das Leis do Trabalho' },
      { codigo: 'cdc', numero: 8078, ano: 1990, nome: 'Codigo de Defesa do Consumidor' },
      { codigo: 'cpc', numero: 13105, ano: 2015, nome: 'Codigo de Processo Civil' },
      { codigo: 'cpp', numero: 3689, ano: 1941, nome: 'Codigo de Processo Penal' },
      { codigo: 'ctb', numero: 9503, ano: 1997, nome: 'Codigo de Transito Brasileiro' },
      { codigo: 'eca', numero: 8069, ano: 1990, nome: 'Estatuto da Crianca e do Adolescente' },
    ];
  }
}
