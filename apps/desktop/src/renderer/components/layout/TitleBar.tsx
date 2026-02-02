'use client';

/**
 * @component TitleBar
 * @description Barra de titulo customizada do aplicativo com favicon, nome e controles de janela
 *
 * @context Layout principal do app - exibido no topo de todas as paginas
 *
 * @dependencies
 * - lib/jurisiar.ts (getJurisiar para controles de janela)
 * - react-i18next (useTranslation para traducoes)
 *
 * @relatedFiles
 * - locales/pt-BR/common.json (traducoes window.*)
 * - locales/en/common.json (traducoes window.*)
 *
 * AIDEV-WARNING: Este componente controla a barra de titulo do Electron
 * AIDEV-NOTE: Traducoes usam namespace 'common' com prefixo 'window.'
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { getJurisiar } from '@/lib/jurisiar';
import faviconImage from '/assets/favicon.png';

export default function TitleBar() {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const jurisiar = getJurisiar();

  useEffect(() => {
    // Verificar estado inicial da janela
    const checkMaximized = async () => {
      try {
        const maximized = await jurisiar.isWindowMaximized?.();
        setIsMaximized(maximized ?? false);
      } catch {
        // Ignorar erro se método não existir
      }
    };
    checkMaximized();

    // Escutar mudanças de estado da janela
    const unsubscribe = jurisiar.onWindowStateChange?.((state: { isMaximized: boolean }) => {
      setIsMaximized(state.isMaximized);
    });

    return () => {
      unsubscribe?.();
    };
  }, [jurisiar]);

  const handleMinimize = () => {
    jurisiar.minimizeWindow?.();
  };

  const handleMaximize = () => {
    jurisiar.maximizeWindow?.();
  };

  const handleClose = () => {
    jurisiar.closeWindow?.();
  };

  return (
    <div className="title-bar fixed top-0 left-0 right-0 h-10 z-50 flex items-center justify-between bg-card border-b border-border select-none">
      {/* Área arrastável + Logo e Nome */}
      <div className="drag-region flex-1 h-full flex items-center pl-3 gap-2">
        <img
          src={faviconImage}
          alt="Juris IA"
          className="h-5 w-5 pointer-events-none"
          draggable={false}
        />
        <span className="text-sm font-medium text-foreground pointer-events-none">
          Juris IA
        </span>
      </div>

      {/* Controles de Janela (Windows style) */}
      <div className="flex items-center h-full">
        {/* Minimizar */}
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-muted/50 transition-colors flex items-center justify-center"
          title={t('window.minimize')}
        >
          <Minus className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Maximizar/Restaurar */}
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-muted/50 transition-colors flex items-center justify-center"
          title={isMaximized ? t('window.restore') : t('window.maximize')}
        >
          {isMaximized ? (
            <Square className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Fechar */}
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-destructive hover:text-destructive-foreground transition-colors flex items-center justify-center"
          title={t('window.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
