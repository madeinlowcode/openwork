'use client';

/**
 * @component DataJudMovementTimeline
 * @description Timeline cronologica das movimentacoes de um processo judicial
 *
 * @context Exibido dentro do DataJudResultCard quando expandido
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes 'datajud')
 * - components/ui/badge (badges de tipo de movimentacao)
 * - components/ui/collapsible (agrupamento por data)
 *
 * @relatedFiles
 * - locales/pt-BR/datajud.json (traducoes PT)
 * - locales/en/datajud.json (traducoes EN)
 * - components/datajud/types/index.ts
 *
 * @stateManagement
 * - useState: expandedGroups (grupos de datas expandidos)
 *
 * AIDEV-NOTE: Agrupa movimentacoes por data para melhor visualizacao
 * AIDEV-NOTE: Usa namespace 'datajud' para traducoes
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DataJudMovement } from './types';
import { Calendar, ChevronDown, ChevronRight, ChevronUp, Clock } from 'lucide-react';

interface DataJudMovementTimelineProps {
  /** Lista de movimentacoes a serem exibidas */
  movements: DataJudMovement[];
  /** Numero maximo de movimentacoes a exibir inicialmente */
  initialCount?: number;
  /** Callback quando uma movimentacao e clicada */
  onMovementClick?: (movement: DataJudMovement) => void;
}

export function DataJudMovementTimeline({
  movements,
  initialCount = 5,
  onMovementClick,
}: DataJudMovementTimelineProps) {
  const { t } = useTranslation('datajud');

  // AIDEV-NOTE: Estado para controlar a expansao da lista
  const [showAll, setShowAll] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // AIDEV-NOTE: Agrupa movimentacoes por data
  const groupedMovements = useMemo(() => {
    const groups: Record<string, DataJudMovement[]> = {};

    movements.forEach((movement) => {
      // Formata a data para o formato do grupo (YYYY-MM-DD)
      const dateKey = movement.data.split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(movement);
    });

    // Ordena os grupos por data (mais recente primeiro)
    const sortedGroups = Object.entries(groups).sort(
      ([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime()
    );

    return sortedGroups;
  }, [movements]);

  // AIDEV-NOTE: Calcula quais movimentacoes exibir
  const visibleMovements = showAll ? movements : movements.slice(0, initialCount);

  // AIDEV-NOTE: Toggle para expansao
  const toggleShowAll = () => setShowAll(!showAll);

  /**
   * Alterna a expansao de um grupo de data
   */
  const toggleGroup = (dateKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  /**
   * Formata a data para exibicao
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  /**
   * Formata a hora para exibicao
   */
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const timePart = date.toTimeString().split('T')[1]?.split('.')[0];
    if (timePart) {
      return timePart.substring(0, 5); // HH:MM
    }
    return '';
  };

  /**
   * Obtem a cor do badge baseada no tipo de movimentacao
   */
  const getMovementBadgeVariant = (tipo?: string) => {
    switch (tipo) {
      case 'sentenca':
        return 'default';
      case 'decisao':
        return 'destructive';
      case 'despacho':
        return 'secondary';
      case 'agendamento':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  /**
   * Renderiza uma unica movimentacao
   */
  const renderMovement = (movement: DataJudMovement, index: number) => {
    const isFirst = index === 0;
    const dateKey = movement.data.split('T')[0];
    const isGroupExpanded = expandedGroups.has(dateKey);
    const groupSize = groupedMovements.find(([key]) => key === dateKey)?.[1].length || 0;

    return (
      <div
        key={`${movement.data}-${index}`}
        className={`relative pl-6 ${!isFirst ? 'pt-4' : ''}`}
      >
        {/* Linha vertical conectando */}
        {!isFirst && (
          <div className="absolute left-[5px] top-[-16px] h-4 w-0.5 bg-border" />
        )}

        {/* Dot na timeline */}
        <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />

        {/* Conteudo da movimentacao */}
        <div className="flex flex-col gap-1">
          {/* Data e hora */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(movement.data)}</span>
            {formatTime(movement.data) && (
              <>
                <Clock className="h-3 w-3 ml-1" />
                <span>{formatTime(movement.data)}</span>
              </>
            )}
          </div>

          {/* Descricao e badge */}
          <div className="flex items-start gap-2">
            {movement.tipo && (
              <Badge variant={getMovementBadgeVariant(movement.tipo)} className="text-xs flex-shrink-0 mt-0.5">
                {movement.tipo}
              </Badge>
            )}
            <p
              className="text-sm text-foreground leading-relaxed cursor-pointer hover:text-primary transition-colors"
              onClick={() => onMovementClick?.(movement)}
            >
              {movement.descricao}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // AIDEV-NOTE: Renderiza grupos quando ha multiplas datas
  const renderGroupedMovements = () => {
    return groupedMovements.map(([dateKey, groupMovements], groupIndex) => {
      const isExpanded = expandedGroups.has(dateKey);
      const showGroupToggle = groupMovements.length > 1;
      const displayedMovements = isExpanded ? groupMovements : [groupMovements[0]];

      return (
        <div key={dateKey} className={groupIndex > 0 ? 'pt-6' : ''}>
          {/* Header do grupo (data) */}
          <div
            className={`flex items-center gap-2 mb-3 ${
              showGroupToggle ? 'cursor-pointer' : ''
            }`}
            onClick={() => showGroupToggle && toggleGroup(dateKey)}
          >
            {showGroupToggle && (
              <Button variant="ghost" size="icon-sm" className="h-5 w-5">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            )}
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{formatDate(dateKey)}</span>
            <Badge variant="secondary" className="text-xs">
              {groupMovements.length} {groupMovements.length === 1 ? 'movimentacao' : 'movimentacoes'}
            </Badge>
          </div>

          {/* Movimentacoes do grupo */}
          <div className="pl-6">
            {displayedMovements.map((movement, index) =>
              renderMovement(movement, index)
            )}
          </div>
        </div>
      );
    });
  };

  // AIDEV-NOTE: Verifica se deve usar agrupamento ou lista simples
  const useGrouping = groupedMovements.length > 1;

  return (
    <div className="space-y-2">
      {/* Titulo da secao */}
      <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
        {t('results.movements.title')}
        <Badge variant="secondary" className="text-xs">
          {movements.length}
        </Badge>
      </h4>

      {/* Timeline */}
      <div className="pl-2">
        {useGrouping ? (
          renderGroupedMovements()
        ) : (
          visibleMovements.map((movement, index) =>
            renderMovement(movement, index)
          )
        )}
      </div>

      {/* Botao ver mais/menos */}
      {movements.length > initialCount && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleShowAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                {t('results.movements.showLess')}
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                {t('results.movements.showMore')} ({movements.length - initialCount})
              </>
            )}
          </Button>
        </div>
      )}

      {/* Estado vazio */}
      {movements.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          {t('results.movements.noMovements')}
        </p>
      )}
    </div>
  );
}

export default DataJudMovementTimeline;
