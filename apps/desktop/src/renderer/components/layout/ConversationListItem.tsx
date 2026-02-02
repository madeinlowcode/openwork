/**
 * @component ConversationListItem
 * @description Item de lista de conversa/tarefa com suporte a i18n
 *
 * @context Usado na sidebar para listar tarefas/conversas
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes)
 * - react-router-dom (navegacao)
 * - stores/taskStore (gerenciamento de tarefas)
 *
 * @relatedFiles
 * - locales/pt-BR/common.json (traducoes em portugues)
 * - locales/en/common.json (traducoes em ingles)
 * - Sidebar.tsx (componente pai)
 *
 * AIDEV-NOTE: Todas as strings sao traduzidas via namespace 'common'
 * AIDEV-WARNING: Verificar chaves de traducao ao modificar textos
 */

'use client';

import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Task } from '@accomplish/shared';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, Clock, Square, PauseCircle, X } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';

interface ConversationListItemProps {
  task: Task;
}

export default function ConversationListItem({ task }: ConversationListItemProps) {
  // AIDEV-NOTE: Usar namespace 'common' para traducoes do ConversationListItem
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === `/execution/${task.id}`;
  const deleteTask = useTaskStore((state) => state.deleteTask);

  const handleClick = () => {
    navigate(`/execution/${task.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!window.confirm(t('conversation.confirmDelete'))) {
      return;
    }

    await deleteTask(task.id);

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
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      title={task.summary || task.prompt}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-200',
        'text-zinc-700 hover:bg-primary/10 hover:text-primary',
        'flex items-center gap-2 group relative cursor-pointer',
        isActive && 'bg-primary text-primary-foreground'
      )}
    >
      {getStatusIcon()}
      <span className="block truncate flex-1">{task.summary || task.prompt}</span>
      <button
        onClick={handleDelete}
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
    </div>
  );
}
