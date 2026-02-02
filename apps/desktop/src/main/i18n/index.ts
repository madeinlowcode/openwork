/**
 * @module i18n
 * @description Sistema leve de internacionalizacao para o Main Process do Electron.
 * Gerencia traducoes para dialogos nativos, mensagens de erro e outros textos
 * que aparecem no processo principal (fora do React).
 *
 * @context Main Process - Electron
 *
 * @dependencies
 * - Nenhuma dependencia externa
 *
 * @relatedFiles
 * - apps/desktop/src/main/index.ts (usa para dialogos)
 * - apps/desktop/src/main/ipc/handlers.ts (usa para mensagens de erro)
 *
 * AIDEV-WARNING: Este modulo e SEPARADO do react-i18next usado no renderer
 * AIDEV-NOTE: Usa deteccao automatica de locale via app.getLocale()
 * AIDEV-NOTE: Padrao e pt-BR, fallback para ingles
 */

/**
 * Interface para o dicionario de traducoes
 */
interface Translations {
  [key: string]: string;
}

/**
 * Traducoes em Portugues Brasileiro (idioma padrao)
 */
const ptBR: Translations = {
  // Janela principal
  'window.title': 'Juris IA',

  // Dialogo de atualizacao necessaria (FutureSchemaError)
  'dialog.updateRequired.title': 'Atualizacao Necessaria',
  'dialog.updateRequired.message':
    'Estes dados foram criados por uma versao mais recente do Jurisiar (schema v{storedVersion}).',
  'dialog.updateRequired.detail':
    'Seu app suporta ate schema v{appVersion}. Por favor atualize o Jurisiar para continuar.',
  'dialog.updateRequired.quit': 'Sair',

  // Exportacao de logs
  'export.title': 'Exportar Logs do Aplicativo',
  'export.filters.text': 'Arquivos de Texto',
  'export.filters.log': 'Arquivos de Log',
  'export.filters.all': 'Todos os Arquivos',
  'export.header': 'Logs do Aplicativo Jurisiar',
  'export.exported': 'Exportado',
  'export.logDirectory': 'Diretorio de Logs',
  'export.noLogs': 'Nenhum log registrado ainda.',

  // Mensagens de erro
  'error.noProviderReady':
    'Nenhum provedor esta pronto. Por favor, conecte um provedor e selecione um modelo nas Configuracoes.',
  'error.noWindowFound': 'Nenhuma janela encontrada',

  // Validacao
  'validation.invalidApiKey': 'Chave de API invalida',
  'validation.connectionFailed': 'Falha na conexao',
  'validation.timeout': 'Tempo limite excedido',
};

/**
 * Traducoes em Ingles (fallback)
 */
const en: Translations = {
  // Main window
  'window.title': 'Juris IA',

  // Update required dialog (FutureSchemaError)
  'dialog.updateRequired.title': 'Update Required',
  'dialog.updateRequired.message':
    'This data was created by a newer version of Jurisiar (schema v{storedVersion}).',
  'dialog.updateRequired.detail':
    'Your app supports up to schema v{appVersion}. Please update Jurisiar to continue.',
  'dialog.updateRequired.quit': 'Quit',

  // Log export
  'export.title': 'Export Application Logs',
  'export.filters.text': 'Text Files',
  'export.filters.log': 'Log Files',
  'export.filters.all': 'All Files',
  'export.header': 'Jurisiar Application Logs',
  'export.exported': 'Exported',
  'export.logDirectory': 'Log Directory',
  'export.noLogs': 'No logs recorded yet.',

  // Error messages
  'error.noProviderReady':
    'No provider is ready. Please connect a provider and select a model in Settings.',
  'error.noWindowFound': 'No window found',

  // Validation
  'validation.invalidApiKey': 'Invalid API key',
  'validation.connectionFailed': 'Connection failed',
  'validation.timeout': 'Request timed out',
};

/**
 * Mapa de traducoes por locale
 */
const translations: Record<string, Translations> = {
  'pt-BR': ptBR,
  pt: ptBR,
  en: en,
  'en-US': en,
  'en-GB': en,
};

/**
 * Locale atual (padrao: pt-BR)
 */
let currentLocale = 'pt-BR';

/**
 * Define o locale atual baseado no idioma do sistema
 *
 * @param locale - Codigo do locale (ex: 'pt-BR', 'en-US', 'pt', 'en')
 *
 * @example
 * import { app } from 'electron';
 * import { setLocale } from './i18n';
 *
 * app.whenReady().then(() => {
 *   setLocale(app.getLocale());
 * });
 *
 * AIDEV-NOTE: Locales que comecam com 'pt' sao mapeados para pt-BR
 * AIDEV-NOTE: Locales desconhecidos usam fallback para ingles
 */
export function setLocale(locale: string): void {
  // Normaliza o locale
  if (locale.startsWith('pt')) {
    currentLocale = 'pt-BR';
  } else if (translations[locale]) {
    currentLocale = locale;
  } else {
    // Fallback para ingles se o locale nao for suportado
    currentLocale = 'en';
  }

  console.log(`[i18n] Locale set to: ${currentLocale} (system: ${locale})`);
}

/**
 * Traduz uma chave para o idioma atual
 *
 * @param key - Chave de traducao (ex: 'dialog.updateRequired.title')
 * @param params - Parametros opcionais para interpolacao (ex: { storedVersion: '5' })
 * @returns Texto traduzido ou a propria chave se nao encontrada
 *
 * @example
 * // Traducao simples
 * t('window.title') // => 'Juris IA'
 *
 * // Traducao com parametros
 * t('dialog.updateRequired.message', { storedVersion: '5' })
 * // => 'Estes dados foram criados por uma versao mais recente do Jurisiar (schema v5).'
 *
 * AIDEV-NOTE: Parametros sao substituidos usando o padrao {nomeParametro}
 * AIDEV-NOTE: Se a traducao nao for encontrada no locale atual, tenta pt-BR, depois retorna a chave
 */
export function t(key: string, params?: Record<string, string | number>): string {
  // Tenta encontrar a traducao no locale atual
  let text = translations[currentLocale]?.[key];

  // Fallback para pt-BR se nao encontrar
  if (!text && currentLocale !== 'pt-BR') {
    text = translations['pt-BR']?.[key];
  }

  // Se ainda nao encontrar, retorna a propria chave
  if (!text) {
    console.warn(`[i18n] Missing translation for key: ${key}`);
    return key;
  }

  // Substitui parametros se houver
  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      text = text!.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    });
  }

  return text;
}

/**
 * Retorna o locale atual
 *
 * @returns Codigo do locale atual (ex: 'pt-BR', 'en')
 *
 * @example
 * const locale = getLocale(); // => 'pt-BR'
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Verifica se o locale atual e portugues
 *
 * @returns true se o locale atual for portugues
 */
export function isPortuguese(): boolean {
  return currentLocale === 'pt-BR' || currentLocale === 'pt';
}

/**
 * Retorna todos os locales suportados
 *
 * @returns Array com os codigos dos locales suportados
 */
export function getSupportedLocales(): string[] {
  return Object.keys(translations);
}
