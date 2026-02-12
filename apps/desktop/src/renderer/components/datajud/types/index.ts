/**
 * @module datajud/types
 * @description Tipos TypeScript para o componente DataJud
 *
 * @context Compartilhado entre todos os componentes do DataJud
 *
 * @relatedFiles
 * - components/datajud/DataJudQueryForm.tsx
 * - components/datajud/DataJudResultCard.tsx
 * - components/datajud/DataJudMovementTimeline.tsx
 */

/**
 * Tipo de busca suportado pelo DataJud
 */
export type DataJudSearchType = 'number' | 'class' | 'party' | 'dateRange';

/**
 * Grau do processo (instancia)
 */
export type DataJudInstance = 'g1' | 'g2' | 'je';

/**
 * Tribunais suportados pelo DataJud
 */
export type DataJudCourt =
  | 'stj'  // Superior Tribunal de Justica
  | 'tst'  // Tribunal Superior do Trabalho
  | 'tse'  // Tribunal Superior Eleitoral
  | 'stm'  // Tribunal Superior Militar
  | 'trf1' // Tribunal Regional Federal 1
  | 'trf2' // Tribunal Regional Federal 2
  | 'trf3' // Tribunal Regional Federal 3
  | 'trf4' // Tribunal Regional Federal 4
  | 'trf5' // Tribunal Regional Federal 5
  | 'tjsp' // Tribunal de Justica de Sao Paulo
  | 'tjrj' // Tribunal de Justica do Rio de Janeiro
  | 'tjmg' // Tribunal de Justica de Minas Gerais
  | 'trt1' // Tribunal Regional do Trabalho 1
  | 'trt2' // Tribunal Regional do Trabalho 2
  | 'trt3' // Tribunal Regional do Trabalho 3
  | 'trt4'; // Tribunal Regional do Trabalho 4

/**
 * Parametros de busca para o DataJud
 */
export interface DataJudQueryParams {
  searchType: DataJudSearchType;
  court: DataJudCourt | 'all';
  instance?: DataJudInstance;
  value: string;
  dateFrom?: string;
  dateTo?: string;
  /** Numero maximo de resultados (default: 10) */
  size?: number;
  /** Filtros adicionais */
  filters?: Record<string, unknown>;
}

/**
 * Dados basicos de um processo retornado pela API
 */
export interface DataJudProcess {
  /** Numero do processo formatado (NPU) */
  numeroProcesso: string;
  /** Classe do processo */
  classe: string;
  /** Assunto do processo */
  assunto?: string;
  /** Data de autuacao do processo */
  dataAutuacao: string;
  /** Tribunal responsavel */
  tribunal: DataJudCourt;
  /** Grau do processo */
  grau: DataJudInstance;
  /** Nivel de sigilo (0 = sem sigilo, >0 = sigiloso) */
  nivelSigilo: number;
  /** Data da ultima movimentacao */
  dataUltimaMovimentacao?: string;
}

/**
 * Dados de uma parte do processo
 */
export interface DataJudParty {
  /** Tipo de parte: autor, reu, terceiro, etc. */
  tipo: 'autor' | 'reu' | 'interessado' | 'advogado' | 'outro';
  /** Nome da parte */
  nome: string;
  /** CPF ou CNPJ (quando disponivel) */
  cpfCnpj?: string;
  /** Tipo de documento (CPF/CNPJ) */
  tipoDocumento?: 'CPF' | 'CNPJ';
  /** Nome do advogado (quando aplicavel) */
  advogado?: string;
  /** OAB do advogado (quando aplicavel) */
  oab?: string;
}

/**
 * Dados de uma movimentacao do processo
 */
export interface DataJudMovement {
  /** Data da movimentacao */
  data: string;
  /** Codigo do tipo de movimentacao */
  tipoCodigo?: string;
  /** Descricao da movimentacao */
  descricao: string;
  /** Tipo de movimentacao para exibicao */
  tipo?: 'normal' | 'despacho' | 'decisao' | 'sentenca' | 'agendamento';
}

/**
 * Resultado completo de um processo
 */
export interface DataJudSearchResult {
  /** Processo basico */
  process: DataJudProcess;
  /** Partes do processo (ocultas se nivelSigilo > 0) */
  partes?: DataJudParty[];
  /** Movimentacoes do processo (ocultas se nivelSigilo > 0) */
  movimentacoes?: DataJudMovement[];
  /** URL para visualizar no PJE */
  pjeUrl?: string;
}

/**
 * Resposta paginada da API de busca
 */
export interface DataJudSearchResponse {
  /** Total de processos encontrados */
  total: number;
  /** Lista de processos */
  hits: DataJudSearchResult[];
  /** Proxima pagina de resultados (cursor para paginacao) */
  nextCursor?: string;
  /** Timestamp da busca */
  timestamp: string;
}

/**
 * Status de conexao com a API do DataJud
 */
export type DataJudConnectionStatus = 'disconnected' | 'validating' | 'connected' | 'error';

/**
 * Erro retornado pela API do DataJud
 */
export interface DataJudError {
  /** Codigo do erro */
  code: string;
  /** Mensagem de erro */
  message: string;
  /** Status HTTP */
  statusCode?: number;
}

/**
 * Configuracao do DataJud armazenada
 */
export interface DataJudConfig {
  /** Chave de API (armazenada de forma segura) */
  apiKey?: string;
  /** Tribunal padrao */
  defaultCourt?: DataJudCourt | 'all';
  /** Ultima validacao bem-sucedida */
  lastValidated?: number;
}

export default DataJudQueryParams;
