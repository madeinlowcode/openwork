'use client';

/**
 * @component DataJudResultCard
 * @description Cartaz de resultado para exibir processos encontrados na busca
 *
 * @context Renderizado na area de resultados do chat quando o agente retorna dados DataJud
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes 'datajud')
 * - components/ui/card (container base)
 * - components/ui/badge (badges de status e tipo)
 * - components/ui/button (botoes de acao)
 * - components/datajud/DataJudMovementTimeline (timeline de movimentacoes)
 *
 * @relatedFiles
 * - locales/pt-BR/datajud.json (traducoes PT)
 * - locales/en/datajud.json (traducoes EN)
 * - components/datajud/types/index.ts
 *
 * @stateManagement
 * - useState: isExpanded (mostrar/ocultar detalhes)
 *
 * AIDEV-WARNING: Oculta partes/movimentacoes quando nivelSigilo > 0
 * AIDEV-NOTE: Usa namespace 'datajud' para traducoes
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DataJudMovementTimeline } from './DataJudMovementTimeline';
import type {
  DataJudSearchResult,
  DataJudProcess,
  DataJudParty,
  DataJudMovement,
} from './types';
import {
  Gavel,
  Calendar,
  Building2,
  Users,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ShieldAlert,
} from 'lucide-react';

interface DataJudResultCardProps {
  /** Resultado do processo a ser exibido */
  result: DataJudSearchResult;
  /** Indica se esta carregando */
  isLoading?: boolean;
  /** Indica se ha mais resultados para carregar */
  hasMore?: boolean;
  /** Callback para carregar mais resultados */
  onLoadMore?: () => void;
  /** Callback quando o numero e copiado */
  onCopyNumber?: (numero: string) => void;
  /** Callback quando o processo e aberto no navegador */
  onOpenBrowser?: (url: string) => void;
}

export function DataJudResultCard({
  result,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onCopyNumber,
  onOpenBrowser,
}: DataJudResultCardProps) {
  const { t } = useTranslation('datajud');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { process, partes, movimentacoes, pjeUrl } = result;
  const isConfidential = process.nivelSigilo > 0;

  /**
   * Copia o numero do processo para o clipboard
   */
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(process.numeroProcesso);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopyNumber?.(process.numeroProcesso);
  }, [process.numeroProcesso, onCopyNumber]);

  /**
   * Abre o processo no navegador PJE
   */
  const handleOpenBrowser = useCallback(() => {
    if (pjeUrl) {
      onOpenBrowser?.(pjeUrl);
    }
  }, [pjeUrl, onOpenBrowser]);

  /**
   * Formata a data para exibicao
   */
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  /**
   * Renderiza o skeleton enquanto carrega
   */
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * Renderiza o cartao do processo
   */
  return (
    <Card className="w-full overflow-hidden">
      <CardContent className="p-0">
        {/* Header do cartao */}
        <div className="p-4 space-y-3">
          {/* Linha superior: numero do processo e acoes */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Gavel className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <h4 className="font-mono font-semibold text-lg truncate">
                  {process.numeroProcesso}
                </h4>
                {isConfidential && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    {t('results.sigilo.warning')}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-2"
                title={t('results.actions.copy')}
              >
                {copied ? (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1 text-green-500" />
                    <span className="text-xs text-green-500">{t('results.actions.copied')}</span>
                  </>
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1" />
                )}
              </Button>
              {pjeUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenBrowser}
                  className="h-8 px-2"
                  title={t('results.actions.openBrowser')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Informacoes do processo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {/* Classe */}
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-xs">{t('results.class')}:</span>
              <span className="font-medium truncate" title={process.classe}>
                {process.classe}
              </span>
            </div>

            {/* Tribunal */}
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="font-medium truncate" title={process.tribunal}>
                {process.tribunal.toUpperCase()}
              </span>
            </div>

            {/* Data de autuacao */}
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span>{formatDate(process.dataAutuacao)}</span>
            </div>

            {/* Grau */}
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground text-xs">{t('results.instance')}:</span>
              <Badge variant="outline" className="text-xs">
                {process.grau.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Partes (quando nao ha sigilo) */}
          {!isConfidential && partes && partes.length > 0 && (
            <div className="flex items-start gap-2 pt-2">
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1 flex flex-wrap gap-2">
                {partes.slice(0, 3).map((parte, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {t(`results.parties.${parte.tipo}`)}: {parte.nome}
                  </Badge>
                ))}
                {partes.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{partes.length - 3} mais
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Aviso de sigilo */}
          {isConfidential && (
            <div className="rounded-md bg-yellow-500/10 p-2 text-xs text-yellow-400">
              {t('results.sigilo.description')}
            </div>
          )}
        </div>

        {/* Botao de expansao */}
        {!isConfidential && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <button
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors border-t bg-muted/30"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    {t('results.actions.hideDetails')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    {t('results.actions.details')}
                  </>
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t"
                  >
                    {/* Movimentacoes */}
                    {movimentacoes && movimentacoes.length > 0 && (
                      <div className="p-4">
                        <DataJudMovementTimeline movements={movimentacoes} />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Botao carregar mais */}
        {hasMore && (
          <div className="p-3 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              className="w-full"
            >
              {t('results.loadMore')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DataJudResultCard;
