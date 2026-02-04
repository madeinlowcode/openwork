/**
 * @component ConversationListItem
 * @description Item de lista de conversa/tarefa com suporte a i18n e seleção múltipla
 *
 * @context Usado na sidebar para listar tarefas/conversas
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes)
 * - react-router-dom (navegacao)
 * - stores/taskStore (gerenciamento de tarefas e seleção)
 * - components/ui/dialog (dialogo de confirmacao)
 *
 * @relatedFiles
 * - locales/pt-BR/common.json (traducoes em portugues)
 * - locales/en/common.json (traducoes em ingles)
 * - Sidebar.tsx (componente pai)
 *
 * @stateManagement
 * - isSelectionMode: controla visibilidade do checkbox
 * - selectedTaskIds: Set com IDs selecionados
 * - toggleTaskSelection: ação para alternar seleção
 * - showDeleteConfirm: controla dialog de confirmação de exclusão
 *
 * ⚠️ AIDEV-WARNING: Shift+Click auto-entra no modo seleção (power-user feature)
 * AIDEV-NOTE: Todas as strings sao traduzidas via namespace 'common'
 */

'use client';

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Task } from '@accomplish/shared';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, Clock, Square, PauseCircle, X, Check } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface ConversationListItemProps {
  task: Task;
}

export default function ConversationListItem({ task }: ConversationListItemProps) {
  // AIDEV-NOTE: Usar namespace 'common' para traducoes do ConversationListItem
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === `/execution/${task.id}`;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Multi-select state from store
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const isSelectionMode = useTaskStore((state) => state.isSelectionMode);
  const selectedTaskIds = useTaskStore((state) => state.selectedTaskIds);
  const toggleTaskSelection = useTaskStore((state) => state.toggleTaskSelection);

  const isSelected = selectedTaskIds.has(task.id);

  const handleClick = (e: React.MouseEvent) => {
    // AIDEV-NOTE: Shift+Click funciona como power-user shortcut para seleção
    // mesmo fora do modo de seleção (auto-entra no modo)
    if (e.shiftKey) {
      e.preventDefault();
      toggleTaskSelection(task.id);
      return;
    }

    // No modo seleção, clique normal também seleciona
    if (isSelectionMode) {
      toggleTaskSelection(task.id);
      return;
    }

    // Navegação normal
    navigate(`/execution/${task.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    await deleteTask(task.id);
    setShowDeleteConfirm(false);

    // Navigate to home if deleting the currently active task
    if (isActive) {
      navigate('/');
    }
  };

  const getStatusIcon = () => {
    switch (task.status) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin-ccw text-primary shrink-0" />;
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-500 shrink-0" />;
      case 'cancelled':
        return <Square className="h-3 w-3 text-zinc-400 shrink-0" />;
      case 'interrupted':
        return <PauseCircle className="h-3 w-3 text-amber-500 shrink-0" />;
      case 'queued':
        return <Clock className="h-3 w-3 text-amber-500 shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isSelectionMode) {
              toggleTaskSelection(task.id);
            } else {
              navigate(`/execution/${task.id}`);
            }
          }
        }}
        title={task.summary || task.prompt}
        className={cn(
          'w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-200',
          'text-zinc-700 hover:bg-primary/10 hover:text-primary',
          'flex items-center gap-2 group relative cursor-pointer',
          isActive && !isSelectionMode && 'bg-primary text-primary-foreground',
          // Estilo de item selecionado no modo seleção
          isSelectionMode && isSelected && 'bg-primary/20 ring-1 ring-primary/50',
          isSelectionMode && !isSelected && 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        )}
      >
        {/* Checkbox no modo seleção */}
        {isSelectionMode && (
          <div
            className={cn(
              'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
              isSelected
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-zinc-300 dark:border-zinc-600'
            )}
          >
            {isSelected && <Check className="h-3 w-3" />}
          </div>
        )}

        {/* Status icon - escondido no modo seleção */}
        {!isSelectionMode && getStatusIcon()}

        <span className="block truncate flex-1">{task.summary || task.prompt}</span>

        {/* Botão de delete - escondido no modo seleção */}
        {!isSelectionMode && (
          <button
            onClick={handleDeleteClick}
            className={cn(
              'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
              'p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20',
              'text-zinc-400 hover:text-red-600 dark:hover:text-red-400',
              'shrink-0'
            )}
            aria-label={t('conversation.deleteTask')}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('conversation.deleteTask')}</DialogTitle>
            <DialogDescription>
              {t('conversation.confirmDelete')}
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
              onClick={handleConfirmDelete}
            >
              {t('actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
