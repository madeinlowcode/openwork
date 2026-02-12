'use client';

/**
 * @hook useDataJud
 * @description Hook para gerenciar o estado e operacoes do DataJud
 *
 * @context Componentes React que precisam interagir com o servico DataJud
 *
 * @returns {Object} Objeto com estado e funcoes do DataJud
 * @returns {string | null} apiKey - Chave de API armazenada
 * @returns {boolean} isLoading - Estado de carregamento
 * @returns {boolean} isConnected - Status de conexao
 * @returns {string | null} error - Mensagem de erro, se houver
 * @returns {Function} setApiKey - Define a chave de API
 * @returns {Function} validateKey - Valida a chave de API
 * @returns {Function} clearKey - Remove a chave de API
 * @returns {Function} clearHistory - Limpa o historico de buscas
 *
 * @dependencies
 * - react (useState, useCallback)
 *
 * @usedBy
 * - components/settings/DataJudSettings.tsx
 * - components/datajud/DataJudQueryForm.tsx
 * - components/datajud/DataJudResultCard.tsx
 *
 * AIDEV-WARNING: IPC handlers devem estar implementados em window.jurisiar.datajud
 * AIDEV-NOTE: Atualizar para usar IPC quando TASK-007/TASK-008 estiverem prontos
 */

import { useState, useCallback } from 'react';

/**
 * Tipo de status de conexao do DataJud
 */
export type DataJudStatus = 'disconnected' | 'validating' | 'connected' | 'error';

interface DataJudState {
  apiKey: string | null;
  status: DataJudStatus;
  error: string | null;
  isLoading: boolean;
}

interface UseDataJudReturn extends DataJudState {
  setApiKey: (key: string) => Promise<void>;
  validateKey: (key: string) => Promise<{ valid: boolean; error?: string }>;
  clearKey: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

/**
 * hook useDataJud
 * Gerencia o estado e operacoes do servico DataJud
 */
export function useDataJud(): UseDataJudReturn {
  const [state, setState] = useState<DataJudState>({
    apiKey: null,
    status: 'disconnected',
    error: null,
    isLoading: false,
  });

  /**
   * Salva a API key no armazenamento seguro
   */
  const setApiKey = useCallback(async (key: string) => {
    // TODO: Substituir por chamada IPC quando TASK-007/TASK-008 estiverem implementados
    // await window.jurisiar.datajud?.setApiKey(key);

    console.log('[useDataJud] Salvando API key (simulado):', key.substring(0, 4) + '...');
    setState(prev => ({
      ...prev,
      apiKey: key,
      status: key ? 'connected' : 'disconnected',
      error: null,
    }));
  }, []);

  /**
   * Valida a chave de API
   */
  const validateKey = useCallback(async (key: string): Promise<{ valid: boolean; error?: string }> => {
    // TODO: Substituir por chamada IPC quando TASK-007/TASK-008 estiverem implementados
    // return await window.jurisiar.datajud?.validateKey(key);

    // Simulacao temporaria
    if (key.length < 10) {
      return { valid: false, error: 'Chave muito curta' };
    }
    return { valid: true };
  }, []);

  /**
   * Remove a API key do armazenamento
   */
  const clearKey = useCallback(async () => {
    // TODO: Substituir por chamada IPC quando TASK-007/TASK-008 estiverem implementados
    // await window.jurisiar.datajud?.clearApiKey();

    setState({
      apiKey: null,
      status: 'disconnected',
      error: null,
      isLoading: false,
    });
  }, []);

  /**
   * Limpa o historico de buscas
   */
  const clearHistory = useCallback(async () => {
    // TODO: Substituir por chamada IPC quando TASK-007/TASK-008 estiverem implementados
    // await window.jurisiar.datajud?.clearHistory();
    console.log('[useDataJud] Historico limpo (simulado)');
  }, []);

  return {
    ...state,
    setApiKey,
    validateKey,
    clearKey,
    clearHistory,
  };
}

export default useDataJud;
