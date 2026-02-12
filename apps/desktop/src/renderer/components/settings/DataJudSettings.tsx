'use client';

/**
 * @component DataJudSettings
 * @description Configuracao da API do DataJud - gerencia API key, validacao e status de conexao
 *
 * @context Settings Dialog - aba "DataJud" para configuracao do servico de busca processual
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes 'datajud')
 * - hooks/useDataJud (gerenciamento de estado do DataJud)
 * - components/ui/button (botao de validacao)
 * - components/ui/input (campo de API key)
 * - components/ui/badge (status de conexao)
 *
 * @relatedFiles
 * - locales/pt-BR/datajud.json (traducoes PT)
 * - locales/en/datajud.json (traducoes EN)
 * - components/layout/SettingsDialog.tsx (integra este componente)
 *
 * AIDEV-WARNING: Requer API do DataJud exposta via window.jurisiar
 * AIDEV-NOTE: Usa namespace 'datajud' para traducoes
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Tipo de status de conexao do DataJud
 */
export type DataJudStatus = 'disconnected' | 'validating' | 'connected' | 'error';

/**
 * Resposta da validacao de API key
 */
interface ValidateResult {
  valid: boolean;
  error?: string;
}

interface DataJudSettingsProps {
  /** Callback executado quando a API key e salva com sucesso */
  onSave?: () => void;
}

export function DataJudSettings({ onSave }: DataJudSettingsProps) {
  const { t } = useTranslation('datajud');

  // AIDEV-NOTE: Estado gerenciado localmente ate que IPC handlers estejam implementados
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<DataJudStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Valida a API key chamando o endpoint de validacao
   */
  const validateApiKey = useCallback(async (key: string): Promise<ValidateResult> => {
    // TODO: Substituir por chamada IPC quando TASK-007/TASK-008 estiverem implementados
    // const result = await window.jurisiar.datajud?.validateKey(key);

    // Simulacao temporaria para desenvolvimento da UI
    if (key.length < 10) {
      return { valid: false, error: 'Chave muito curta' };
    }

    // Simular validacao bem-sucedida
    return { valid: true };
  }, []);

  /**
   * Salva a API key no armazenamento seguro
   */
  const saveApiKey = useCallback(async (key: string): Promise<boolean> => {
    // TODO: Substituir por chamada IPC quando TASK-007/TASK-008 estiverem implementados
    // await window.jurisiar.datajud?.setApiKey(key);
    console.log('[DataJudSettings] Salvando API key (simulado):', key.substring(0, 4) + '...');
    return true;
  }, []);

  /**
   * Remove a API key do armazenamento
   */
  const clearApiKey = useCallback(async (): Promise<void> => {
    // TODO: Substituir por chamada IPC quando TASK-007/TASK-008 estiverem implementados
    // await window.jurisiar.datajud?.clearApiKey();
    setApiKey('');
    setStatus('disconnected');
    setError(null);
  }, []);

  /**
   * Manipula a validacao e salvamento da API key
   */
  const handleValidate = useCallback(async () => {
    if (!apiKey.trim()) {
      setError(t('errors.noApiKey'));
      return;
    }

    setIsLoading(true);
    setStatus('validating');
    setError(null);

    try {
      const result = await validateApiKey(apiKey);

      if (result.valid) {
        await saveApiKey(apiKey);
        setStatus('connected');
        onSave?.();
      } else {
        setStatus('error');
        setError(result.error || t('errors.invalidApiKey'));
      }
    } catch {
      setStatus('error');
      setError(t('errors.network'));
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, validateApiKey, saveApiKey, onSave, t]);

  /**
   * Renderiza o badge de status
   */
  const renderStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
            {t('settings.status.connected')}
          </Badge>
        );
      case 'validating':
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse" />
            {t('settings.status.validating')}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-2" />
            {t('settings.status.error')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            <span className="w-2 h-2 rounded-full bg-gray-500 mr-2" />
            {t('settings.status.disconnected')}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com titulo e status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t('settings.title')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        {renderStatusBadge()}
      </div>

      {/* Campo de API Key */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {t('settings.apiKeyLabel')}
          </label>
          <a
            href="https://www.cnj.jus.br/sigec/login.php?siglaSistema=SIGEC&siglaModulo=Solicitacao"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {t('settings.help.linkText')}
          </a>
        </div>

        <div className="relative">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('settings.apiKeyPlaceholder')}
            disabled={isLoading}
            data-testid="datajud-api-key-input"
            className="w-full"
          />
          {apiKey && (
            <button
              onClick={() => setApiKey('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {/* Mensagem de ajuda */}
        <p className="text-xs text-muted-foreground">
          {t('settings.help.description')}
        </p>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Botoes de acao */}
      <div className="flex gap-3">
        <Button
          onClick={handleValidate}
          disabled={isLoading || !apiKey.trim()}
          className="flex-1"
          data-testid="datajud-validate-button"
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
              </svg>
              {t('settings.validatingButton')}
            </>
          ) : (
            t('settings.validateButton')
          )}
        </Button>

        {status === 'connected' && (
          <Button
            variant="outline"
            onClick={clearApiKey}
            data-testid="datajud-clear-button"
          >
            {t('settings.clearButton')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default DataJudSettings;
