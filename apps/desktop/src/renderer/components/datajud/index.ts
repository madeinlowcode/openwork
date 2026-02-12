/**
 * @module datajud
 * @description Componentes do modulo DataJud para busca processual
 *
 * @context Modulo para interacao com a API do DataJud (CNJ)
 *
 * @exports
 * - DataJudQueryForm: Formulario modal para buscas
 * - DataJudResultCard: Cartao de resultado de processo
 * - DataJudMovementTimeline: Timeline de movimentacoes
 * - useDataJud: Hook para gerenciamento de estado
 *
 * @relatedFiles
 * - locales/pt-BR/datajud.json
 * - locales/en/datajud.json
 * - types/index.ts
 */

export { DataJudQueryForm } from './DataJudQueryForm';
export { DataJudResults } from './DataJudResults';
export { DataJudResultCard } from './DataJudResultCard';
export { DataJudMovementTimeline } from './DataJudMovementTimeline';
export { DataJudResultsRenderer } from './DataJudResultsRenderer';
export { useDataJud } from './hooks/useDataJud';

// Tipos
export type {
  DataJudSearchType,
  DataJudInstance,
  DataJudCourt,
  DataJudQueryParams,
  DataJudProcess,
  DataJudParty,
  DataJudMovement,
  DataJudSearchResult,
  DataJudSearchResponse,
  DataJudConnectionStatus,
  DataJudError,
  DataJudConfig,
} from './types';
