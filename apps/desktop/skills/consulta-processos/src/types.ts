/**
 * Tipos TypeScript para a API DataJud do CNJ
 */

/**
 * Mapeamento de tribunais disponíveis na API DataJud
 * Chave: sigla do tribunal (lowercase)
 * Valor: nome completo do tribunal
 */
export const TRIBUNAIS = {
  // Tribunais Superiores
  stf: 'Supremo Tribunal Federal',
  stj: 'Superior Tribunal de Justiça',
  tst: 'Tribunal Superior do Trabalho',
  tse: 'Tribunal Superior Eleitoral',
  stm: 'Superior Tribunal Militar',

  // Tribunais Regionais Federais
  trf1: 'Tribunal Regional Federal da 1ª Região',
  trf2: 'Tribunal Regional Federal da 2ª Região',
  trf3: 'Tribunal Regional Federal da 3ª Região',
  trf4: 'Tribunal Regional Federal da 4ª Região',
  trf5: 'Tribunal Regional Federal da 5ª Região',
  trf6: 'Tribunal Regional Federal da 6ª Região',

  // Tribunais de Justiça Estaduais
  tjac: 'Tribunal de Justiça do Acre',
  tjal: 'Tribunal de Justiça de Alagoas',
  tjam: 'Tribunal de Justiça do Amazonas',
  tjap: 'Tribunal de Justiça do Amapá',
  tjba: 'Tribunal de Justiça da Bahia',
  tjce: 'Tribunal de Justiça do Ceará',
  tjdft: 'Tribunal de Justiça do Distrito Federal e Territórios',
  tjes: 'Tribunal de Justiça do Espírito Santo',
  tjgo: 'Tribunal de Justiça de Goiás',
  tjma: 'Tribunal de Justiça do Maranhão',
  tjmg: 'Tribunal de Justiça de Minas Gerais',
  tjms: 'Tribunal de Justiça de Mato Grosso do Sul',
  tjmt: 'Tribunal de Justiça de Mato Grosso',
  tjpa: 'Tribunal de Justiça do Pará',
  tjpb: 'Tribunal de Justiça da Paraíba',
  tjpe: 'Tribunal de Justiça de Pernambuco',
  tjpi: 'Tribunal de Justiça do Piauí',
  tjpr: 'Tribunal de Justiça do Paraná',
  tjrj: 'Tribunal de Justiça do Rio de Janeiro',
  tjrn: 'Tribunal de Justiça do Rio Grande do Norte',
  tjro: 'Tribunal de Justiça de Rondônia',
  tjrr: 'Tribunal de Justiça de Roraima',
  tjrs: 'Tribunal de Justiça do Rio Grande do Sul',
  tjsc: 'Tribunal de Justiça de Santa Catarina',
  tjse: 'Tribunal de Justiça de Sergipe',
  tjsp: 'Tribunal de Justiça de São Paulo',
  tjto: 'Tribunal de Justiça do Tocantins',

  // Tribunais Regionais do Trabalho
  trt1: 'Tribunal Regional do Trabalho da 1ª Região (RJ)',
  trt2: 'Tribunal Regional do Trabalho da 2ª Região (SP)',
  trt3: 'Tribunal Regional do Trabalho da 3ª Região (MG)',
  trt4: 'Tribunal Regional do Trabalho da 4ª Região (RS)',
  trt5: 'Tribunal Regional do Trabalho da 5ª Região (BA)',
  trt6: 'Tribunal Regional do Trabalho da 6ª Região (PE)',
  trt7: 'Tribunal Regional do Trabalho da 7ª Região (CE)',
  trt8: 'Tribunal Regional do Trabalho da 8ª Região (PA/AP)',
  trt9: 'Tribunal Regional do Trabalho da 9ª Região (PR)',
  trt10: 'Tribunal Regional do Trabalho da 10ª Região (DF/TO)',
  trt11: 'Tribunal Regional do Trabalho da 11ª Região (AM/RR)',
  trt12: 'Tribunal Regional do Trabalho da 12ª Região (SC)',
  trt13: 'Tribunal Regional do Trabalho da 13ª Região (PB)',
  trt14: 'Tribunal Regional do Trabalho da 14ª Região (RO/AC)',
  trt15: 'Tribunal Regional do Trabalho da 15ª Região (Campinas)',
  trt16: 'Tribunal Regional do Trabalho da 16ª Região (MA)',
  trt17: 'Tribunal Regional do Trabalho da 17ª Região (ES)',
  trt18: 'Tribunal Regional do Trabalho da 18ª Região (GO)',
  trt19: 'Tribunal Regional do Trabalho da 19ª Região (AL)',
  trt20: 'Tribunal Regional do Trabalho da 20ª Região (SE)',
  trt21: 'Tribunal Regional do Trabalho da 21ª Região (RN)',
  trt22: 'Tribunal Regional do Trabalho da 22ª Região (PI)',
  trt23: 'Tribunal Regional do Trabalho da 23ª Região (MT)',
  trt24: 'Tribunal Regional do Trabalho da 24ª Região (MS)',

  // Tribunais Regionais Eleitorais
  tre_ac: 'Tribunal Regional Eleitoral do Acre',
  tre_al: 'Tribunal Regional Eleitoral de Alagoas',
  tre_am: 'Tribunal Regional Eleitoral do Amazonas',
  tre_ap: 'Tribunal Regional Eleitoral do Amapá',
  tre_ba: 'Tribunal Regional Eleitoral da Bahia',
  tre_ce: 'Tribunal Regional Eleitoral do Ceará',
  tre_df: 'Tribunal Regional Eleitoral do Distrito Federal',
  tre_es: 'Tribunal Regional Eleitoral do Espírito Santo',
  tre_go: 'Tribunal Regional Eleitoral de Goiás',
  tre_ma: 'Tribunal Regional Eleitoral do Maranhão',
  tre_mg: 'Tribunal Regional Eleitoral de Minas Gerais',
  tre_ms: 'Tribunal Regional Eleitoral de Mato Grosso do Sul',
  tre_mt: 'Tribunal Regional Eleitoral de Mato Grosso',
  tre_pa: 'Tribunal Regional Eleitoral do Pará',
  tre_pb: 'Tribunal Regional Eleitoral da Paraíba',
  tre_pe: 'Tribunal Regional Eleitoral de Pernambuco',
  tre_pi: 'Tribunal Regional Eleitoral do Piauí',
  tre_pr: 'Tribunal Regional Eleitoral do Paraná',
  tre_rj: 'Tribunal Regional Eleitoral do Rio de Janeiro',
  tre_rn: 'Tribunal Regional Eleitoral do Rio Grande do Norte',
  tre_ro: 'Tribunal Regional Eleitoral de Rondônia',
  tre_rr: 'Tribunal Regional Eleitoral de Roraima',
  tre_rs: 'Tribunal Regional Eleitoral do Rio Grande do Sul',
  tre_sc: 'Tribunal Regional Eleitoral de Santa Catarina',
  tre_se: 'Tribunal Regional Eleitoral de Sergipe',
  tre_sp: 'Tribunal Regional Eleitoral de São Paulo',
  tre_to: 'Tribunal Regional Eleitoral do Tocantins',
} as const;

export type TribunalSigla = keyof typeof TRIBUNAIS;

/**
 * Assunto do processo
 */
export interface Assunto {
  codigo: number;
  nome: string;
  codigoNacional?: number;
  nomeNacional?: string;
}

/**
 * Movimento processual
 */
export interface Movimento {
  codigo: number;
  nome: string;
  dataHora: string;
  complemento?: string;
  complementosTabelados?: Array<{
    codigo: number;
    nome: string;
    valor?: string;
  }>;
}

/**
 * Parte do processo
 */
export interface Parte {
  tipo: string;
  nome: string;
  documento?: string;
  advogados?: Array<{
    nome: string;
    inscricao?: string;
  }>;
}

/**
 * Órgão julgador
 */
export interface OrgaoJulgador {
  codigo: number;
  nome: string;
  codigoMunicipioIBGE?: number;
}

/**
 * Formato do valor da causa
 */
export interface ValorCausa {
  valor: number;
  moeda?: string;
}

/**
 * Classe processual
 */
export interface ClasseProcessual {
  codigo: number;
  nome: string;
  sigla?: string;
}

/**
 * Dados completos de um processo retornado pela API DataJud
 */
export interface ProcessoDataJud {
  id: string;
  numeroProcesso: string;
  classe: ClasseProcessual;
  sistema?: {
    codigo: number;
    nome: string;
  };
  formato?: {
    codigo: number;
    nome: string;
  };
  tribunal: string;
  dataAjuizamento: string;
  dataUltimaAtualizacao?: string;
  grau: string;
  nivelSigilo?: number;
  orgaoJulgador: OrgaoJulgador;
  assuntos: Assunto[];
  movimentos: Movimento[];
  partes?: Parte[];
  valorCausa?: ValorCausa;
  prioridade?: string[];
}

/**
 * Resposta da API DataJud (formato Elasticsearch)
 */
export interface DataJudResponse {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number | null;
    hits: Array<{
      _index: string;
      _type?: string;
      _id: string;
      _score: number | null;
      _source: ProcessoDataJud;
    }>;
  };
}

/**
 * Parâmetros para pesquisa de processos
 */
export interface PesquisaParams {
  tribunal: TribunalSigla;
  numeroProcesso?: string;
  classe?: number;
  orgaoJulgador?: number;
  dataAjuizamentoInicio?: string;
  dataAjuizamentoFim?: string;
  assunto?: number;
  nomeParte?: string;
  tamanho?: number;
  pagina?: number;
}

/**
 * Resultado formatado de uma consulta
 */
export interface ResultadoConsulta {
  total: number;
  processos: ProcessoDataJud[];
  pagina: number;
  tamanho: number;
}

/**
 * Erro da API DataJud
 */
export interface DataJudError {
  error: {
    root_cause?: Array<{
      type: string;
      reason: string;
    }>;
    type: string;
    reason: string;
  };
  status: number;
}
