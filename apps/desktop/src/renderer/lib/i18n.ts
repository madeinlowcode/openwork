/**
 * @module i18n
 * @description Configuracao do sistema de internacionalizacao (i18n) usando i18next e react-i18next
 *
 * @context Renderer process - inicializado no main.tsx antes do React render
 *
 * @dependencies
 * - i18next (core i18n library)
 * - react-i18next (React bindings for i18next)
 * - locales/pt-BR/*.json (traducoes em portugues)
 * - locales/en/*.json (traducoes em ingles - fallback)
 *
 * @relatedFiles
 * - main.tsx (importa este modulo para inicializar i18n)
 * - Todos os componentes que usam useTranslation()
 *
 * AIDEV-WARNING: Este arquivo configura o idioma padrao do app
 * AIDEV-NOTE: O idioma padrao e pt-BR (Portugues Brasileiro)
 * AIDEV-NOTE: Para adicionar novo idioma, criar pasta em locales/ e registrar aqui
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
// AIDEV-NOTE: Importar todos os namespaces de traducao aqui
import ptBRCommon from '../locales/pt-BR/common.json';
import ptBRHome from '../locales/pt-BR/home.json';
import ptBRSettings from '../locales/pt-BR/settings.json';
import ptBRProviders from '../locales/pt-BR/providers.json';
import ptBRSpeech from '../locales/pt-BR/speech.json';
import ptBRStatus from '../locales/pt-BR/status.json';
import ptBRExecution from '../locales/pt-BR/execution.json';
import ptBRTools from '../locales/pt-BR/tools.json';
import enCommon from '../locales/en/common.json';
import enHome from '../locales/en/home.json';
import enSettings from '../locales/en/settings.json';
import enProviders from '../locales/en/providers.json';
import enSpeech from '../locales/en/speech.json';
import enStatus from '../locales/en/status.json';
import enExecution from '../locales/en/execution.json';
import enTools from '../locales/en/tools.json';

/**
 * Recursos de traducao organizados por idioma e namespace
 * AIDEV-NOTE: Adicionar novos namespaces aqui ao criar novos arquivos JSON
 */
const resources = {
  'pt-BR': {
    common: ptBRCommon,
    home: ptBRHome,
    settings: ptBRSettings,
    providers: ptBRProviders,
    speech: ptBRSpeech,
    status: ptBRStatus,
    execution: ptBRExecution,
    tools: ptBRTools,
  },
  en: {
    common: enCommon,
    home: enHome,
    settings: enSettings,
    providers: enProviders,
    speech: enSpeech,
    status: enStatus,
    execution: enExecution,
    tools: enTools,
  },
};

/**
 * Idiomas disponiveis no aplicativo
 * AIDEV-NOTE: Usar para popular seletor de idioma na UI
 */
export const availableLanguages = [
  { code: 'pt-BR', name: 'Portugues (Brasil)', flag: 'BR' },
  { code: 'en', name: 'English', flag: 'US' },
] as const;

export type LanguageCode = (typeof availableLanguages)[number]['code'];

/**
 * Inicializa o i18next com as configuracoes do Jurisiar
 * AIDEV-WARNING: Esta funcao deve ser chamada antes do React render
 */
// AIDEV-NOTE: Carrega idioma salvo no localStorage ou usa pt-BR como padrao
const savedLanguage = typeof window !== 'undefined' 
  ? localStorage.getItem('i18nextLng') || 'pt-BR'
  : 'pt-BR';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage, // Idioma salvo ou padrao pt-BR
  fallbackLng: 'en', // Fallback para ingles se traducao nao existir

  // Namespace padrao usado quando nao especificado
  defaultNS: 'common',
  ns: ['common', 'home', 'settings', 'providers', 'speech', 'status', 'execution', 'tools'],

  interpolation: {
    escapeValue: false, // React ja faz escape de XSS
  },

  // Opcoes de debug (desabilitar em producao)
  debug: import.meta.env.DEV,

  // Reagir a mudancas de idioma
  react: {
    useSuspense: false, // Evita problemas com SSR/Electron
  },
});

export default i18n;
