/**
 * @file main.tsx
 * @description Ponto de entrada do renderer React com i18n inicializado
 *
 * @context Renderer process - primeiro arquivo executado
 *
 * @dependencies
 * - react, react-dom
 * - react-router-dom (HashRouter para Electron)
 * - lib/i18n.ts (inicializacao do i18n - DEVE ser importado antes do App)
 *
 * AIDEV-WARNING: A ordem dos imports e critica - i18n DEVE vir antes do App
 * AIDEV-NOTE: Usar HashRouter para compatibilidade com Electron file://
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

// AIDEV-WARNING: i18n DEVE ser importado ANTES do App para inicializar traducoes
import './lib/i18n';

import App from './App';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
