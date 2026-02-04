'use client';

/**
 * @component Sidebar
 * @description Barra lateral com lista de conversas, botao de nova tarefa, configuracoes e modo de selecao multipla
 *
 * @context Layout principal - navegacao lateral esquerda
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes)
 * - stores/taskStore (gerenciamento de tarefas e selecao)
 * - lib/jurisiar.ts (eventos de tarefas)
 * - components/ui/dialog.tsx (dialogo de confirmacao)
 *
 * @relatedFiles
 * - locales/pt-BR/common.json (traducoes navigation.* e selection.*)
 * - locales/en/common.json (traducoes navigation.* e selection.*)
 * - ConversationListItem.tsx (item da lista)
 * - SettingsDialog.tsx (dialogo de configuracoes)
 *
 * @stateManagement
 * - isSelectionMode: controla modo de selecao multipla
 * - selectedTaskIds: Set com IDs selecionados
 * - showDeleteConfirm: controla dialog de confirmacao
 *
 * ⚠️ AIDEV-WARNING: Componente critico de navegacao
 * ⚠️ AIDEV-WARNING: Escape key sai do modo selecao - nao remover handler
 * AIDEV-NOTE: Traducoes usam namespace 'common' com prefixos 'navigation.' e 'selection.'
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '@/stores/taskStore';
import { getJurisiar } from '@/lib/jurisiar';
import { staggerContainer } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ConversationListItem from './ConversationListItem';
import SettingsDialog from './SettingsDialog';
import { Settings, MessageSquarePlus, Search, CheckSquare, X, Trash2, CheckCheck } from 'lucide-react';
import logoImage from '/assets/juris-logo.png';

export default function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    tasks,
    loadTasks,
    updateTaskStatus,
    addTaskUpdate,
    openLauncher,
    // Multi-select state and actions
    isSelectionMode,
    selectedTaskIds,
    enterSelectionMode,
    exitSelectionMode,
    selectAllTasks,
    deleteSelectedTasks,
  } = useTaskStore();

  const jurisiar = getJurisiar();
  const selectedCount = selectedTaskIds.size;

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Subscribe to task status changes (queued -> running) and task updates (complete/error)
  // This ensures sidebar always reflects current task status
  useEffect(() => {
    const unsubscribeStatusChange = jurisiar.onTaskStatusChange?.((data) => {
      updateTaskStatus(data.taskId, data.status);
    });

    const unsubscribeTaskUpdate = jurisiar.onTaskUpdate((event) => {
      addTaskUpdate(event);
    });

    return () => {
      unsubscribeStatusChange?.();
      unsubscribeTaskUpdate();
    };
  }, [updateTaskStatus, addTaskUpdate, jurisiar]);

  // AIDEV-NOTE: Escape key handler para sair do modo selecao
  // Registrado apenas quando isSelectionMode === true
  useEffect(() => {
    if (!isSelectionMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitSelectionMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode, exitSelectionMode]);

  const handleNewConversation = () => {
    navigate('/');
  };

  const handleDeleteSelected = useCallback(async () => {
    // Verificar se alguma tarefa ativa será excluída
    const currentPath = location.pathname;
    const activeTaskMatch = currentPath.match(/\/execution\/(.+)/);
    const activeTaskId = activeTaskMatch?.[1];
    const willDeleteActive = activeTaskId && selectedTaskIds.has(activeTaskId);

    await deleteSelectedTasks();
    setShowDeleteConfirm(false);

    // Navegar para home se a tarefa ativa foi excluída
    if (willDeleteActive) {
      navigate('/');
    }
  }, [deleteSelectedTasks, location.pathname, selectedTaskIds, navigate]);

  return (
    <>
      <div className="flex h-screen w-[260px] flex-col border-r border-border bg-card pt-12">
        {/* Action Buttons - Condicional baseado no modo */}
        <div className="px-3 py-3 border-b border-border">
          {isSelectionMode ? (
            // Barra de ações do modo seleção
            <div className="flex items-center gap-2">
              {/* Botão cancelar */}
              <Button
                onClick={exitSelectionMode}
                variant="ghost"
                size="sm"
                className="px-2 text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
                title={t('selection.cancel')}
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Contador de selecionados */}
              <span className="flex-1 text-sm text-muted-foreground truncate">
                {t('selection.selected', { count: selectedCount })}
              </span>

              {/* Botão selecionar todos */}
              <Button
                onClick={selectAllTasks}
                variant="ghost"
                size="sm"
                className="px-2 text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                title={t('selection.selectAll')}
                disabled={selectedCount === tasks.length}
              >
                <CheckCheck className="h-4 w-4" />
              </Button>

              {/* Botão excluir */}
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="ghost"
                size="sm"
                className="px-2 text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                title={t('selection.deleteSelected')}
                disabled={selectedCount === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            // Barra de ações normal
            <div className="flex items-center gap-2">
              <Button
                data-testid="sidebar-new-task-button"
                onClick={handleNewConversation}
                variant="default"
                size="sm"
                className="flex-1 justify-center gap-2"
                title={t('navigation.newTask')}
              >
                <MessageSquarePlus className="h-4 w-4" />
                {t('navigation.newTask')}
              </Button>
              {/* Ícones clicáveis minimalistas */}
              <span
                onClick={openLauncher}
                title={t('navigation.searchTasks')}
                className="cursor-pointer"
              >
                <Search className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </span>
              <span
                onClick={tasks.length > 0 ? enterSelectionMode : undefined}
                title={t('selection.enterMode')}
                className={tasks.length > 0 ? 'cursor-pointer' : 'cursor-not-allowed'}
              >
                <CheckSquare
                  className={`h-4 w-4 transition-colors ${
                    tasks.length > 0
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'text-muted-foreground/40'
                  }`}
                />
              </span>
            </div>
          )}
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <AnimatePresence mode="wait">
              {tasks.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {t('navigation.noConversations')}
                </motion.div>
              ) : (
                <motion.div
                  key="task-list"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="space-y-1"
                >
                  {tasks.map((task) => (
                    <ConversationListItem key={task.id} task={task} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Bottom Section - Logo and Settings */}
        <div className="px-3 py-4 border-t border-border flex items-center justify-between">
          {/* Logo - Bottom Left */}
          <div className="flex items-center">
            <img
              src={logoImage}
              alt="Jurisiar"
              style={{ height: '32px', paddingLeft: '6px' }}
            />
          </div>

          {/* Settings Button - Bottom Right */}
          <Button
            data-testid="sidebar-settings-button"
            variant="ghost"
            size="icon"
            className="text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => setShowSettings(true)}
            title={t('navigation.settings')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />

      {/* Dialog de confirmação de exclusão em lote */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('selection.confirmDeleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('selection.confirmDeleteMessage', { count: selectedCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              onClick={() => setShowDeleteConfirm(false)}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
            >
              {t('actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
