/**
 * @component UpdateNotification
 * @description Toast de notificacao de auto-update fixo no canto inferior direito.
 * Exibe progresso de download e botao para reiniciar quando pronto.
 *
 * @context Renderizado no App.tsx, visivel em todas as rotas protegidas
 *
 * @dependencies
 * - framer-motion (animacoes slide-in)
 * - lucide-react (icones Download, RefreshCw, X)
 *
 * @relatedFiles
 * - preload/index.ts (eventos onUpdateAvailable, onUpdateProgress, onUpdateDownloaded)
 * - App.tsx (onde este componente e montado)
 *
 * @stateManagement
 * - useState: phase ('idle' | 'downloading' | 'ready'), version, percent, dismissed
 *
 * AIDEV-WARNING: Depende dos eventos IPC update:available, update:progress, update:downloaded
 * AIDEV-NOTE: Botao restartAndUpdate so aparece apos download completo
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X } from 'lucide-react';

type Phase = 'idle' | 'downloading' | 'ready';

export function UpdateNotification() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [version, setVersion] = useState('');
  const [percent, setPercent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = (window as any).jurisiar;
    if (!api?.onUpdateAvailable) return;

    const unsubs: Array<() => void> = [];

    unsubs.push(
      api.onUpdateAvailable((data: { version: string }) => {
        setVersion(data.version);
        setPhase('downloading');
        setPercent(0);
        setDismissed(false);
      })
    );

    if (api.onUpdateProgress) {
      unsubs.push(
        api.onUpdateProgress((data: { percent: number }) => {
          setPercent(Math.round(data.percent));
        })
      );
    }

    if (api.onUpdateDownloaded) {
      unsubs.push(
        api.onUpdateDownloaded((data: { version: string }) => {
          setVersion(data.version);
          setPhase('ready');
        })
      );
    }

    return () => unsubs.forEach((fn) => fn());
  }, []);

  const handleRestart = useCallback(() => {
    (window as any).jurisiar?.restartAndUpdate?.();
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const visible = phase !== 'idle' && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="update-notification"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <div className="rounded-lg border border-border bg-card p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                {phase === 'downloading' ? (
                  <Download className="h-4 w-4 text-primary" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-foreground text-sm">
                    {phase === 'downloading'
                      ? `Baixando atualizacao v${version}...`
                      : `v${version} pronta para instalar`}
                  </h4>
                  <button
                    onClick={handleDismiss}
                    className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    data-testid="update-notification-dismiss"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {phase === 'downloading' && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{percent}%</p>
                  </div>
                )}

                {phase === 'ready' && (
                  <div className="mt-2">
                    <button
                      onClick={handleRestart}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reiniciar Agora
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
