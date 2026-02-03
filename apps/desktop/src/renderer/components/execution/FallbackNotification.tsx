// apps/desktop/src/renderer/components/execution/FallbackNotification.tsx

/**
 * @component FallbackNotification
 * @description Notificacao visual quando o sistema de fallback automatico e acionado
 *
 * Exibe informacoes sobre:
 * - Modelo original que atingiu o limite
 * - Modelo de fallback sendo usado
 * - Metodo de geracao de contexto (LLM ou template)
 *
 * @context Execution page - exibido durante transicao de fallback
 *
 * @dependencies
 * - react-i18next (useTranslation)
 * - framer-motion (animacoes)
 * - components/ui/alert.tsx (Alert, AlertTitle, AlertDescription)
 * - components/ui/button.tsx (Button)
 * - lucide-react (icones)
 *
 * @relatedFiles
 * - locales/pt-BR/fallback.json (traducoes PT)
 * - locales/en/fallback.json (traducoes EN)
 * - apps/desktop/src/renderer/pages/Execution.tsx (componente pai)
 * - apps/desktop/src/main/opencode/fallback/fallback-engine.ts (emite eventos)
 *
 * @usedBy
 * - pages/Execution.tsx
 *
 * AIDEV-NOTE: Usa namespace 'fallback' para traducoes
 * AIDEV-NOTE: Animacao de entrada/saida via framer-motion
 * AIDEV-WARNING: Deve ser dismissible para nao bloquear interacao do usuario
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, Sparkles, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props do componente FallbackNotification
 *
 * AIDEV-NOTE: isActive controla visibilidade, onDismiss permite fechar
 */
export interface FallbackNotificationProps {
  /** Se a notificacao deve ser exibida */
  isActive: boolean;
  /** Nome do modelo original que falhou */
  originalModel: string;
  /** Nome do modelo de fallback sendo usado */
  fallbackModel: string;
  /** Metodo usado para gerar contexto */
  contextMethod: 'llm' | 'template';
  /** Callback quando usuario fecha a notificacao */
  onDismiss: () => void;
  /** Mostrar detalhes expandidos por padrao */
  defaultExpanded?: boolean;
}

/**
 * Animacao spring para entrada/saida suave
 *
 * AIDEV-NOTE: Tipagem explicita para evitar erro TS2322
 */
const springTransition: { type: 'spring'; stiffness: number; damping: number } = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

/**
 * FallbackNotification - Componente de notificacao de fallback
 *
 * @example
 * <FallbackNotification
 *   isActive={isFallbackActive}
 *   originalModel="claude-opus-4-5"
 *   fallbackModel="claude-3-haiku"
 *   contextMethod="llm"
 *   onDismiss={() => setFallbackActive(false)}
 * />
 *
 * AIDEV-NOTE: Auto-dismiss apos 10 segundos se nao interagido
 */
export function FallbackNotification({
  isActive,
  originalModel,
  fallbackModel,
  contextMethod,
  onDismiss,
  defaultExpanded = false,
}: FallbackNotificationProps) {
  // AIDEV-NOTE: Usa namespace 'fallback' para traducoes
  const { t } = useTranslation('fallback');
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [autoDismissTimer, setAutoDismissTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-dismiss apos 10 segundos
  // AIDEV-NOTE: Timer e cancelado se usuario interagir ou componente desmontar
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 10000);
      setAutoDismissTimer(timer);

      return () => {
        if (timer) clearTimeout(timer);
      };
    } else {
      if (autoDismissTimer) {
        clearTimeout(autoDismissTimer);
        setAutoDismissTimer(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Cancelar auto-dismiss ao interagir
  const handleInteraction = () => {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      setAutoDismissTimer(null);
    }
  };

  // Extrair nome curto do modelo (remover prefixo do provider)
  const formatModelName = (model: string): string => {
    // Remove provider prefix if present (e.g., "anthropic/claude-3-haiku" -> "claude-3-haiku")
    const parts = model.split('/');
    return parts.length > 1 ? parts[1] : model;
  };

  if (!isActive) return null;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={springTransition}
          className="w-full max-w-4xl mx-auto mb-4"
          onClick={handleInteraction}
        >
          <Alert
            className={cn(
              'relative border-amber-500/50 bg-amber-500/10',
              'shadow-lg shadow-amber-500/5'
            )}
          >
            {/* Icone rotativo indicando transicao */}
            <RefreshCw className="h-5 w-5 text-amber-600 animate-spin" />

            {/* Conteudo principal */}
            <div className="flex-1 ml-2">
              <AlertTitle className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-2">
                {t('notification.title')}
              </AlertTitle>

              <AlertDescription className="mt-1 text-amber-600/90 dark:text-amber-300/90">
                {t('notification.message', {
                  originalModel: formatModelName(originalModel),
                  fallbackModel: formatModelName(fallbackModel),
                })}
              </AlertDescription>

              {/* Detalhes expandiveis */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 pt-3 border-t border-amber-500/20"
                  >
                    {/* Metodo de contexto */}
                    <div className="flex items-center gap-2 text-sm">
                      {contextMethod === 'llm' ? (
                        <>
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <span className="text-amber-600/80 dark:text-amber-300/80">
                            {t('notification.contextMethod.llm')}
                          </span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span className="text-amber-600/80 dark:text-amber-300/80">
                            {t('notification.contextMethod.template')}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Info adicional */}
                    <p className="mt-2 text-xs text-amber-600/70 dark:text-amber-300/70">
                      {t('notification.contextGenerated')}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Botoes de acao */}
            <div className="flex items-center gap-2 ml-4">
              {/* Toggle detalhes */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleInteraction();
                  setIsExpanded(!isExpanded);
                }}
                className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-500/20"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span className="ml-1 text-xs">
                  {isExpanded ? '' : t('notification.details')}
                </span>
              </Button>

              {/* Botao fechar */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onDismiss}
                className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/20"
                aria-label={t('notification.dismiss')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook para gerenciar estado de notificacao de fallback
 *
 * @returns Estado e metodos para controlar a notificacao
 *
 * @example
 * const fallbackNotification = useFallbackNotification();
 *
 * // Ao receber evento de fallback:
 * fallbackNotification.show({
 *   originalModel: 'claude-opus-4-5',
 *   fallbackModel: 'claude-3-haiku',
 *   contextMethod: 'llm',
 * });
 *
 * // No JSX:
 * <FallbackNotification
 *   {...fallbackNotification.props}
 *   onDismiss={fallbackNotification.dismiss}
 * />
 *
 * AIDEV-NOTE: Util para integrar com sistema de eventos IPC
 */
export function useFallbackNotification() {
  const [state, setState] = useState<{
    isActive: boolean;
    originalModel: string;
    fallbackModel: string;
    contextMethod: 'llm' | 'template';
  }>({
    isActive: false,
    originalModel: '',
    fallbackModel: '',
    contextMethod: 'template',
  });

  const show = (data: {
    originalModel: string;
    fallbackModel: string;
    contextMethod: 'llm' | 'template';
  }) => {
    setState({
      isActive: true,
      ...data,
    });
  };

  const dismiss = () => {
    setState((prev) => ({
      ...prev,
      isActive: false,
    }));
  };

  return {
    props: {
      isActive: state.isActive,
      originalModel: state.originalModel,
      fallbackModel: state.fallbackModel,
      contextMethod: state.contextMethod,
    },
    show,
    dismiss,
  };
}

export default FallbackNotification;
