/**
 * @component FallbackSettings
 * @description Componente de configuracao de fallback automatico para rate limits
 *
 * Permite que os usuarios:
 * - Ativar/desativar fallback automatico
 * - Selecionar modelo de fallback
 * - Configurar tentativas e delay
 * - Ativar sumarizacao de contexto por IA
 *
 * @context Settings > Fallback tab
 *
 * @dependencies
 * - react-i18next (useTranslation)
 * - components/ui/card.tsx (Card, CardHeader, CardContent)
 * - components/ui/input.tsx (Input)
 * - lib/jurisiar.ts (fallback API)
 *
 * @relatedFiles
 * - locales/pt-BR/fallback.json (traducoes PT)
 * - locales/en/fallback.json (traducoes EN)
 * - components/layout/SettingsDialog.tsx (componente pai)
 * - apps/desktop/src/main/store/repositories/fallbackSettings.ts (backend)
 *
 * AIDEV-NOTE: Integrado com IPC via lib/jurisiar.ts
 * AIDEV-NOTE: Usa namespace 'fallback' para traducoes
 * AIDEV-WARNING: Alteracoes aqui impactam a experiencia do usuario com fallback
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { fallback } from '@/lib/jurisiar';
import type { FallbackSettings as FallbackSettingsType } from '@accomplish/shared';

/**
 * @interface FallbackSettingsProps
 * @description Props do componente FallbackSettings
 */
interface FallbackSettingsProps {
  /** Callback quando configuracoes sao salvas */
  onSave?: () => void;
  /** Callback quando configuracoes mudam */
  onChange?: (settings: FallbackSettingsType) => void;
}

/**
 * Modelos disponiveis para fallback (OpenRouter)
 * AIDEV-TODO: Buscar modelos reais do OpenRouter via IPC em futura iteracao
 */
const FALLBACK_MODELS = [
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
  { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
];

/**
 * Modelos disponiveis para sumarizacao (modelos baratos)
 * AIDEV-TODO: Buscar modelos reais do OpenRouter via IPC em futura iteracao
 */
const SUMMARIZATION_MODELS = [
  { id: 'google/gemini-flash-1.5-8b', name: 'Gemini 1.5 Flash 8B (mais barato)' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
];

/**
 * Default settings used when loading fails or API is unavailable
 * AIDEV-NOTE: Must match DEFAULT_FALLBACK_SETTINGS from shared/types
 */
const DEFAULT_SETTINGS: FallbackSettingsType = {
  enabled: false,
  fallbackModelId: null,
  fallbackProvider: 'openrouter',
  maxRetries: 3,
  retryDelayMs: 5000,
  useLLMSummarization: false,
  summarizationModelId: null,
  summarizationProvider: 'openrouter',
};

export function FallbackSettings({ onSave, onChange }: FallbackSettingsProps) {
  // AIDEV-NOTE: Usa namespace 'fallback' para traducoes
  const { t } = useTranslation('fallback');

  // Estado das configuracoes - carregado via IPC
  const [settings, setSettings] = useState<FallbackSettingsType>(DEFAULT_SETTINGS);

  // Estados de UI
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carrega configuracoes do backend via IPC
   * AIDEV-NOTE: Executado uma vez no mount do componente
   */
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const loadedSettings = await fallback.getSettings();
        setSettings(loadedSettings);
      } catch (err) {
        console.error('[FallbackSettings] Failed to load settings:', err);
        setError(t('error.loadFailed'));
        // Keep default settings on error
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [t]);

  /**
   * Atualiza configuracao e salva via IPC
   * AIDEV-NOTE: Debounce nao e necessario pois cada campo e salvo individualmente
   */
  const updateSettings = useCallback(async (updates: Partial<FallbackSettingsType>) => {
    // Otimistic update - atualiza UI imediatamente
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    onChange?.(newSettings);

    try {
      setIsSaving(true);
      setError(null);
      const savedSettings = await fallback.setSettings(updates);
      setSettings(savedSettings);
      onSave?.();
    } catch (err) {
      console.error('[FallbackSettings] Failed to save settings:', err);
      setError(t('error.saveFailed'));
      // Revert on error - reload from backend
      try {
        const currentSettings = await fallback.getSettings();
        setSettings(currentSettings);
      } catch {
        // If reload also fails, keep the optimistic state
      }
    } finally {
      setIsSaving(false);
    }
  }, [settings, onChange, onSave, t]);

  /**
   * Renderiza toggle switch customizado
   * AIDEV-NOTE: Segue padrao do SettingsDialog para toggles
   */
  const renderToggle = (
    checked: boolean,
    onToggle: () => void,
    testId?: string,
    disabled?: boolean
  ) => (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isSaving}
      data-testid={testId}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-accomplish ${
        checked ? 'bg-primary' : 'bg-muted'
      } ${(disabled || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-accomplish ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  /**
   * Renderiza select de modelo
   * AIDEV-NOTE: Versao simplificada do ModelSelector para uso interno
   */
  const renderModelSelect = (
    value: string | null,
    onChangeValue: (value: string) => void,
    models: { id: string; name: string }[],
    placeholder: string,
    disabled?: boolean
  ) => (
    <div className="relative">
      <select
        value={value || ''}
        onChange={(e) => onChangeValue(e.target.value)}
        disabled={disabled || isSaving}
        className={`w-full appearance-none rounded-md border border-input bg-background pl-3 pr-10 py-2.5 text-sm ${
          (disabled || isSaving) ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <RefreshCw className={`h-5 w-5 text-blue-500 ${isSaving ? 'animate-spin' : ''}`} />
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Toggle Principal - Ativar Fallback */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-medium text-foreground">
                {t('enabled.label')}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('enabled.description')}
              </p>
            </div>
            <div className="ml-4">
              {renderToggle(
                settings.enabled,
                () => updateSettings({ enabled: !settings.enabled }),
                'fallback-enabled-toggle'
              )}
            </div>
          </div>
        </div>

        {/* Modelo de Fallback */}
        <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('fallbackModel.label')}
          </label>
          {renderModelSelect(
            settings.fallbackModelId,
            (value) => updateSettings({ fallbackModelId: value }),
            FALLBACK_MODELS,
            t('fallbackModel.placeholder'),
            !settings.enabled
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {t('fallbackModel.description')}
          </p>
        </div>

        {/* Configuracoes Avancadas - Colapsavel */}
        <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={!settings.enabled}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {t('advanced.title')}
          </button>

          {showAdvanced && settings.enabled && (
            <div className="mt-4 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              {/* Max Retries */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t('advanced.maxRetries.label')}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.maxRetries}
                  onChange={(e) =>
                    updateSettings({ maxRetries: parseInt(e.target.value) || 3 })
                  }
                  disabled={isSaving}
                  className="w-32"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('advanced.maxRetries.description')}
                </p>
              </div>

              {/* Retry Delay */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t('advanced.retryDelay.label')}
                </label>
                <Input
                  type="number"
                  min={1000}
                  max={60000}
                  step={1000}
                  value={settings.retryDelayMs}
                  onChange={(e) =>
                    updateSettings({
                      retryDelayMs: parseInt(e.target.value) || 5000,
                    })
                  }
                  disabled={isSaving}
                  className="w-32"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('advanced.retryDelay.description')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Separador */}
        <div className="border-t border-border" />

        {/* Sumarizacao por IA */}
        <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    {t('summarization.label')}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('summarization.description')}
                  </p>
                </div>
              </div>
              <div className="ml-4">
                {renderToggle(
                  settings.useLLMSummarization,
                  () =>
                    updateSettings({
                      useLLMSummarization: !settings.useLLMSummarization,
                    }),
                  'fallback-summarization-toggle',
                  !settings.enabled
                )}
              </div>
            </div>

            {settings.useLLMSummarization && settings.enabled && (
              <div className="mt-4 space-y-3">
                {/* Modelo de Sumarizacao */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t('summarization.model.label')}
                  </label>
                  {renderModelSelect(
                    settings.summarizationModelId,
                    (value) => updateSettings({ summarizationModelId: value }),
                    SUMMARIZATION_MODELS,
                    t('summarization.model.placeholder'),
                    !settings.useLLMSummarization
                  )}
                </div>

                {/* Aviso de Custo */}
                <Alert>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
                    {t('summarization.costWarning')}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </div>

        {/* Status Info */}
        {settings.enabled && settings.fallbackModelId && (
          <Alert>
            <RefreshCw className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-xs text-green-600 dark:text-green-400">
              {t('status.configured')}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
