/**
 * @component HistoryPage
 * @description Pagina de historico de tarefas com suporte a i18n
 *
 * @context Acessada via rota /history
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes)
 * - components/layout/Header (cabecalho)
 * - components/history/TaskHistory (lista de tarefas)
 *
 * @relatedFiles
 * - locales/pt-BR/common.json (traducoes em portugues)
 * - locales/en/common.json (traducoes em ingles)
 * - TaskHistory.tsx (componente de historico)
 *
 * AIDEV-NOTE: Titulo traduzido via namespace 'common.historyPage'
 */

import { useTranslation } from 'react-i18next';
import Header from '../components/layout/Header';
import TaskHistory from '../components/history/TaskHistory';

export default function HistoryPage() {
  // AIDEV-NOTE: Usar namespace 'common' para traducoes da pagina de historico
  const { t } = useTranslation('common');

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-text mb-6">{t('historyPage.title')}</h1>
        <TaskHistory showTitle={false} />
      </main>
    </div>
  );
}
