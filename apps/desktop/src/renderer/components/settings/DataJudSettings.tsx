'use client';

/**
 * @component DataJudSettings
 * @description Configuracao da API do DataJud - gerencia API key, validacao e status de conexao
 *
 * @context Settings Dialog - aba "DataJud" para configuracao do servico de busca processual
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes 'datajud')
 * - components/ui/button (botao de validacao)
 * - components/ui/input (campo de API key)
 * - components/ui/badge (status de conexao)
 * - window.jurisiar.datajud (IPC handlers para API key)
 *
 * @relatedFiles
 * - locales/pt-BR/datajud.json (traducoes PT)
 * - locales/en/datajud.json (traducoes EN)
 * - components/layout/SettingsDialog.tsx (integra este componente)
 * - src/main/ipc/datajud-handlers.ts (IPC handlers backend)
 * - src/preload/index.ts (bridge IPC)
 *
 * AIDEV-WARNING: Depende de window.jurisiar.datajud exposto via preload
 * AIDEV-NOTE: Usa namespace 'datajud' para traducoes
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Tipo de status de conexao do DataJud
 */
export type DataJudStatus = 'disconnected' | 'validating' | 'connected' | 'error';

interface DataJudSettingsProps {
  /** Callback executado quando a API key e salva com sucesso */
  onSave?: () => void;
}

// AIDEV-NOTE: URL oficial onde a chave publica do DataJud esta disponivel
const DATAJUD_KEY_URL = 'https://datajud-wiki.cnj.jus.br/api-publica/acesso';

export function DataJudSettings({ onSave }: DataJudSettingsProps) {
  const { t } = useTranslation('datajud');

  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<DataJudStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // AIDEV-NOTE: Carrega estado inicial da API key ao montar o componente
  useEffect(() => {
    const loadCurrentKey = async () => {
      try {
        // AIDEV-NOTE: datajud não consta no tipo estático JurisiarAPI do renderer; cast necessário
        const result = await (window as any).jurisiar?.datajud?.getApiKey();
        if (result.hasKey) {
          setApiKey(result.maskedKey || '••••••••');
          setStatus('connected');
        }
      } catch {
        // Silenciosamente ignora se IPC nao estiver disponivel
      }
    };
    loadCurrentKey();
  }, []);

  /**
   * Normaliza a API key removendo prefixo "APIKey " caso o usuario cole da documentacao
   * AIDEV-NOTE: A documentacao do CNJ mostra "APIKey cDZHYz..." mas o codigo ja adiciona o prefixo
   */
  const normalizeApiKey = (key: string): string => {
    const trimmed = key.trim();
    // Aceita variações: "APIKey ", "ApiKey ", "apikey " etc.
    if (/^api\s*key\s+/i.test(trimmed)) {
      return trimmed.replace(/^api\s*key\s+/i, '');
    }
    return trimmed;
  };

  /**
   * Valida e salva a API key via IPC
   * AIDEV-NOTE: setApiKey no backend ja valida internamente antes de salvar
   */
  const handleValidate = useCallback(async () => {
    if (!apiKey.trim()) {
      setError(t('errors.noApiKey'));
      return;
    }

    setIsLoading(true);
    setStatus('validating');
    setError(null);

    const cleanKey = normalizeApiKey(apiKey);

    try {
      // AIDEV-NOTE: setApiKey valida e salva em uma unica operacao
      const saveResult = await (window as any).jurisiar?.datajud?.setApiKey(cleanKey);
      if (saveResult.success) {
        setApiKey(cleanKey);
        setStatus('connected');
        onSave?.();
      } else {
        setStatus('error');
        setError(saveResult.error || t('errors.invalidApiKey'));
      }
    } catch {
      setStatus('error');
      setError(t('errors.network'));
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, onSave, t]);

  /**
   * Remove a API key do armazenamento via IPC
   */
  const clearApiKey = useCallback(async () => {
    try {
      await (window as any).jurisiar?.datajud?.deleteApiKey();
    } catch {
      // Fallback silencioso
    }
    setApiKey('');
    setStatus('disconnected');
    setError(null);
  }, []);

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
            href={DATAJUD_KEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            data-testid="datajud-help-link"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {t('settings.help.linkText')}
          </a>
        </div>

        <div className="relative">
          <Input
            type="text"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (status === 'error') setError(null);
              if (status === 'connected') setStatus('disconnected');
            }}
            placeholder={t('settings.apiKeyPlaceholder')}
            disabled={isLoading}
            data-testid="datajud-api-key-input"
            className="w-full font-mono text-sm"
          />
          {apiKey && !isLoading && (
            <button
              onClick={clearApiKey}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              type="button"
              data-testid="datajud-clear-button"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

      {/* Botao de validacao */}
      <Button
        onClick={handleValidate}
        disabled={isLoading || !apiKey.trim()}
        className="w-full"
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
    </div>
  );
}

export default DataJudSettings;
