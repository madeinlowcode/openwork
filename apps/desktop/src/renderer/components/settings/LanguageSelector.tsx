/**
 * @component LanguageSelector
 * @description Componente para selecao de idioma do aplicativo com persistencia em localStorage
 *
 * @context Settings - usado no SettingsDialog para permitir troca de idioma
 *
 * @dependencies
 * - react-i18next (useTranslation)
 * - lucide-react (Globe)
 * - lib/i18n.ts (availableLanguages, LanguageCode)
 *
 * @relatedFiles
 * - components/layout/SettingsDialog.tsx (componente pai)
 * - lib/i18n.ts (configuracao i18n e lista de idiomas)
 * - locales/pt-BR/settings.json (traducoes PT)
 * - locales/en/settings.json (traducoes EN)
 *
 * AIDEV-WARNING: Alteracoes afetam todo o sistema i18n
 * AIDEV-NOTE: Usa react-i18next para troca de idioma
 * AIDEV-NOTE: Persiste preferencia no localStorage
 */

import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { availableLanguages, type LanguageCode } from '@/lib/i18n';

/**
 * Componente de selecao de idioma
 * Exibe um dropdown com os idiomas disponiveis e persiste a escolha
 */
export function LanguageSelector() {
  const { i18n } = useTranslation();

  /**
   * Manipula a mudanca de idioma
   * Altera o idioma no i18next e persiste no localStorage
   */
  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    // AIDEV-NOTE: Persiste a preferencia de idioma no localStorage
    localStorage.setItem('i18nextLng', langCode);
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <select
        value={i18n.language}
        onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
        className="bg-background border border-input rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
        data-testid="language-selector"
      >
        {availableLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag === 'BR' ? '\u{1F1E7}\u{1F1F7}' : '\u{1F1FA}\u{1F1F8}'} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
