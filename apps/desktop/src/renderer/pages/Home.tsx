'use client';

/**
 * @component HomePage
 * @description Pagina inicial com input de tarefa e exemplos de uso
 *
 * @context Pagina principal do app - rota "/"
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes)
 * - components/landing/TaskInputBar (input de tarefa)
 * - stores/taskStore (gerenciamento de tarefas)
 * - components/datajud (DataJudQueryForm, DataJudResults)
 *
 * @relatedFiles
 * - locales/pt-BR/home.json (traducoes especificas da home)
 * - locales/en/home.json (traducoes especificas da home)
 * - TaskInputBar.tsx (componente de input)
 * - DataJudQueryForm.tsx (formulario de busca DataJud)
 * - DataJudResults.tsx (exibicao de resultados DataJud)
 *
 * AIDEV-NOTE: Traducoes usam namespace 'home' para textos especificos
 * AIDEV-NOTE: Namespace 'common' usado para acoes gerais
 * AIDEV-WARNING: DataJud agora usa IPC direto via onResult, nao mais onSubmit com prompt
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import TaskInputBar from '../components/landing/TaskInputBar';
import SettingsDialog from '../components/layout/SettingsDialog';
import { DataJudQueryForm, DataJudResults } from '../components/datajud';
import type { DataJudClassAndCourtSearchMeta } from '../components/datajud/types';
import { EscavadorQueryForm, EscavadorResults } from '../components/escavador';
import type { EscavadorSearchType } from '../components/escavador/types';
import { useTaskStore } from '../stores/taskStore';
import { getJurisiar } from '../lib/jurisiar';
import { springs, staggerContainer, staggerItem } from '../lib/animations';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronDown,
  BookOpen,
  ScrollText,
  Bookmark,
  Gavel,
  Scale,
  UserCheck,
  MapPin,
  FileSearch,
  FileOutput,
  Database,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { hasAnyReadyProvider } from '@accomplish/shared';
import { UsageMeter } from '../components/UsageMeter';

/**
 * @description Configuracao dos casos de uso juridicos exibidos na Home
 * Cada item tem uma key (para traducao i18n) e um icone Lucide
 *
 * AIDEV-NOTE: As keys correspondem a entradas em locales/{lang}/home.json -> useCases
 * AIDEV-WARNING: Ao adicionar novos casos, atualizar tambem os arquivos de traducao
 */
const USE_CASE_KEYS: ReadonlyArray<{ key: string; icon: LucideIcon }> = [
  { key: 'consultarCodigo', icon: BookOpen },
  { key: 'pesquisarLei', icon: ScrollText },
  { key: 'buscarSumula', icon: Bookmark },
  { key: 'consultarProcesso', icon: Gavel },
  { key: 'buscarJurisprudencia', icon: Scale },
  { key: 'validarDocumento', icon: UserCheck },
  { key: 'consultarCep', icon: MapPin },
  { key: 'analisarPeca', icon: FileSearch },
  { key: 'extrairClausulas', icon: FileOutput },
  // DataJud - card unico que abre dialog com tipos de consulta
  { key: 'dataJud', icon: Database },
  // Escavador - card unico que abre dialog com tipos de consulta
  { key: 'escavador', icon: Search },
];

export default function HomePage() {
  const { t } = useTranslation('home');
  const [prompt, setPrompt] = useState('');
  const [showExamples, setShowExamples] = useState(true);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'providers' | 'voice' | 'datajud'>('providers');
  // AIDEV-NOTE: Estado para o modal do formulario DataJud
  const [showDataJudForm, setShowDataJudForm] = useState(false);
  // AIDEV-NOTE: Estados para resultados do DataJud
  const [dataJudResults, setDataJudResults] = useState<any | null>(null);
  const [showDataJudResults, setShowDataJudResults] = useState(false);
  // AIDEV-NOTE: Armazena parametros da ultima busca classAndCourt para paginacao search_after
  const [lastClassAndCourtParams, setLastClassAndCourtParams] = useState<{
    court: string; classCode: string; orgaoCode: string; size: number;
  } | null>(null);
  // AIDEV-NOTE: Estados para o modal do formulario Escavador
  const [showEscavadorForm, setShowEscavadorForm] = useState(false);
  // AIDEV-NOTE: Estados para resultados do Escavador
  const [escavadorResults, setEscavadorResults] = useState<any | null>(null);
  const [showEscavadorResults, setShowEscavadorResults] = useState(false);
  const [escavadorSearchType, setEscavadorSearchType] = useState<EscavadorSearchType>('cnj');
  const { startTask, isLoading, addTaskUpdate, setPermissionRequest } = useTaskStore();
  const navigate = useNavigate();
  const jurisiar = getJurisiar();

  // Subscribe to task events
  useEffect(() => {
    const unsubscribeTask = jurisiar.onTaskUpdate((event) => {
      addTaskUpdate(event);
    });

    const unsubscribePermission = jurisiar.onPermissionRequest((request) => {
      setPermissionRequest(request);
    });

    return () => {
      unsubscribeTask();
      unsubscribePermission();
    };
  }, [addTaskUpdate, setPermissionRequest, jurisiar]);

  const executeTask = useCallback(async () => {
    if (!prompt.trim() || isLoading) return;

    const taskId = `task_${Date.now()}`;
    const task = await startTask({ prompt: prompt.trim(), taskId });
    if (task) {
      navigate(`/execution/${task.id}`);
    }
  }, [prompt, isLoading, startTask, navigate]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;

    // Check if any provider is ready before sending (skip in E2E mode)
    const isE2EMode = await jurisiar.isE2EMode();
    if (!isE2EMode) {
      const settings = await jurisiar.getProviderSettings();
      if (!hasAnyReadyProvider(settings)) {
        setSettingsInitialTab('providers');
        setShowSettingsDialog(true);
        return;
      }
    }

    await executeTask();
  };

  const handleSettingsDialogChange = (open: boolean) => {
    setShowSettingsDialog(open);
    // Reset to providers tab when dialog closes
    if (!open) {
      setSettingsInitialTab('providers');
    }
  };

  const handleOpenSpeechSettings = useCallback(() => {
    setSettingsInitialTab('voice');
    setShowSettingsDialog(true);
  }, []);

  const handleApiKeySaved = async () => {
    // API key was saved - close dialog and execute the task
    setShowSettingsDialog(false);
    if (prompt.trim()) {
      await executeTask();
    }
  };

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
  };

  /**
   * AIDEV-NOTE: Abre o dialog DataJud com tela de selecao de tipo
   */
  const handleDataJudClick = () => {
    setShowDataJudForm(true);
  };

  /**
   * AIDEV-NOTE: Abre o dialog Escavador com tabs de selecao
   */
  const handleEscavadorClick = () => {
    setShowEscavadorForm(true);
  };

  /**
   * AIDEV-NOTE: Callback executado quando a busca DataJud retorna resultados via IPC
   * AIDEV-WARNING: Recebe dados brutos da API, nao mais prompt
   */
  // AIDEV-NOTE: data tipado como Record com _searchMeta opcional tipado
  const handleDataJudResult = useCallback((data: Record<string, unknown> & { _searchMeta?: DataJudClassAndCourtSearchMeta }) => {
    // AIDEV-NOTE: Extrai metadata de busca classAndCourt para suportar paginacao
    if (data?._searchMeta?.type === 'classAndCourt') {
      const meta = data._searchMeta;
      setLastClassAndCourtParams({
        court: meta.court,
        classCode: meta.classCode,
        orgaoCode: meta.orgaoCode,
        size: meta.size,
      });
    } else {
      setLastClassAndCourtParams(null);
    }
    setDataJudResults(data);
    setShowDataJudResults(true);
  }, []);

  /**
   * AIDEV-NOTE: Fecha resultados e reabre formulario de busca
   */
  /**
   * AIDEV-NOTE: Carrega mais resultados via search_after para classAndCourt
   * Retorna os dados da proxima pagina para acumular no DataJudResults
   */
  const handleLoadMore = useCallback(async (searchAfter: string[]) => {
    if (!lastClassAndCourtParams) return null;
    const datajud = (window as any).jurisiar?.datajud;
    if (!datajud) return null;

    const { court, classCode, orgaoCode, size } = lastClassAndCourtParams;
    const result = await datajud.searchByClassAndCourt(court, classCode, orgaoCode, {
      size,
      searchAfter,
    });

    if (result.success && result.result) {
      return result.result;
    }
    return null;
  }, [lastClassAndCourtParams]);

  const handleNewSearch = useCallback(() => {
    setShowDataJudResults(false);
    setDataJudResults(null);
    setLastClassAndCourtParams(null);
    setShowDataJudForm(true);
  }, []);

  /**
   * AIDEV-NOTE: Callback executado quando a busca Escavador retorna resultados
   */
  const handleEscavadorResult = useCallback((data: any) => {
    setEscavadorResults(data);
    setShowEscavadorResults(true);
  }, []);

  /**
   * AIDEV-NOTE: Fecha resultados Escavador e reabre formulario
   */
  const handleEscavadorNewSearch = useCallback(() => {
    setShowEscavadorResults(false);
    setEscavadorResults(null);
    setShowEscavadorForm(true);
  }, []);

  return (
    <>
      {/* AIDEV-NOTE: Dialog do formulario DataJud */}
      <DataJudQueryForm
        open={showDataJudForm}
        onOpenChange={setShowDataJudForm}
        onResult={handleDataJudResult}
      />

      {/* AIDEV-NOTE: Dialog de resultados DataJud */}
      <DataJudResults
        open={showDataJudResults}
        onOpenChange={setShowDataJudResults}
        data={dataJudResults}
        onNewSearch={handleNewSearch}
        onLoadMore={lastClassAndCourtParams ? handleLoadMore : undefined}
      />

      {/* AIDEV-NOTE: Dialog do formulario Escavador */}
      <EscavadorQueryForm
        open={showEscavadorForm}
        onOpenChange={setShowEscavadorForm}
        onResult={handleEscavadorResult}
      />

      {/* AIDEV-NOTE: Dialog de resultados Escavador */}
      <EscavadorResults
        open={showEscavadorResults}
        onOpenChange={setShowEscavadorResults}
        searchType={escavadorSearchType}
        data={escavadorResults}
        onNewSearch={handleEscavadorNewSearch}
      />

      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={handleSettingsDialogChange}
        onApiKeySaved={handleApiKeySaved}
        initialTab={settingsInitialTab}
      />
      <div
        className="h-full flex items-center justify-center p-6 overflow-y-auto bg-primary"
      >
      <div className="w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Main Title */}
        <motion.h1
          data-testid="home-title"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          className="text-4xl font-light tracking-tight text-white"
        >
          {t('title')}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.1 }}
          className="w-full"
        >
          <Card className="w-full bg-card/95 backdrop-blur-md shadow-xl gap-0 py-0 flex flex-col max-h-[calc(100vh-3rem)]">
            <CardContent className="p-6 pb-4 flex-shrink-0">
              {/* Input Section */}
              <TaskInputBar
                value={prompt}
                onChange={setPrompt}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                placeholder={t('placeholder')}
                large={true}
                autoFocus={true}
                onOpenSpeechSettings={handleOpenSpeechSettings}
              />
            </CardContent>

            {/* Usage Meter */}
            <div className="px-6 pb-2">
              <UsageMeter />
            </div>

            {/* Examples Toggle */}
            <div className="border-t border-border">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="w-full px-6 py-3 flex items-center justify-between text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
              >
                <span>{t('examplePrompts')}</span>
                <motion.div
                  animate={{ rotate: showExamples ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showExamples && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="px-6 pt-1 pb-4 overflow-y-auto max-h-[360px]"
                      style={{
                        background: 'linear-gradient(to bottom, hsl(var(--muted)) 0%, hsl(var(--background)) 100%)',
                        backgroundAttachment: 'fixed',
                      }}
                    >
                      <motion.div
                        variants={staggerContainer}
                        initial="initial"
                        animate="animate"
                        className="grid grid-cols-3 gap-3"
                      >
                        {/* AIDEV-NOTE: Use cases juridicos traduzidos via namespace 'home' com chave useCases.{key} */}
                        {USE_CASE_KEYS.map((useCase, index) => {
                          const IconComponent = useCase.icon;
                          // AIDEV-NOTE: Card DataJud abre dialog dedicado
                          const isDataJud = useCase.key === 'dataJud';
                          // AIDEV-NOTE: Card Escavador abre dialog dedicado
                          const isEscavador = useCase.key === 'escavador';
                          const handleClick = isDataJud
                            ? handleDataJudClick
                            : isEscavador
                            ? handleEscavadorClick
                            : () => handleExampleClick(t(`useCases.${useCase.key}.prompt`));

                          return (
                            <motion.button
                              key={useCase.key}
                              data-testid={`home-example-${index}`}
                              variants={staggerItem}
                              transition={springs.gentle}
                              whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
                              whileTap={{ scale: 0.97 }}
                              onClick={handleClick}
                              className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-ring hover:bg-muted/50"
                            >
                              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <IconComponent className="w-6 h-6 text-primary" />
                              </div>
                              <div className="flex flex-col items-center gap-1 w-full">
                                <div className="font-medium text-xs text-foreground text-center">
                                  {t(`useCases.${useCase.key}.title`)}
                                </div>
                                <div className="text-xs text-muted-foreground text-center line-clamp-2">
                                  {t(`useCases.${useCase.key}.description`)}
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
    </>
  );
}
