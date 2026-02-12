'use client';

/**
 * @component DataJudResultsRenderer
 * @description Renderiza resultados DataJud em mensagens do chat
 *
 * @context Renderizado dentro de Execution.tsx quando o agente retorna dados DataJud
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes 'datajud')
 * - components/datajud/DataJudResultCard (cartao de resultado)
 * - components/datajud/types (tipos TypeScript)
 *
 * @relatedFiles
 * - locales/pt-BR/datajud.json
 * - locales/en/datajud.json
 * - pages/Execution.tsx
 *
 * AIDEV-NOTE: Faz parse do markdown gerado pelo MCP server
 * AIDEV-NOTE: Detecta blocos ```datajudjson para identificar resultados
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataJudResultCard } from './DataJudResultCard';
import type { DataJudSearchResponse, DataJudSearchResult } from './types';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface DataJudResultsRendererProps {
  /** Conteudo da mensagem que pode conter resultados DataJud */
  content: string;
  /** Callback quando o usuario quer fazer uma nova busca */
  onNewSearch?: () => void;
  /** Callback quando o usuario clica em um resultado */
  onResultClick?: (result: DataJudSearchResult) => void;
  /** Callback para abrir processo no navegador */
  onOpenBrowser?: (url: string) => void;
}

export function DataJudResultsRenderer({
  content,
  onNewSearch,
  onResultClick,
  onOpenBrowser,
}: DataJudResultsRendererProps) {
  const { t } = useTranslation('datajud');

  /**
   * Faz o parse do markdown para extrair resultados DataJud
   * O MCP server gera blocos ```datajudjson
   */
  const parseDataJudResults = (text: string): DataJudSearchResult[] => {
    const results: DataJudSearchResult[] = [];

    // AIDEV-NOTE: Procura por blocos de codigo com rotulo datajud
    const codeBlockRegex = /```datajudjson\s*([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      try {
        const jsonContent = match[1].trim();
        const parsed = JSON.parse(jsonContent);
        const response = parsed as DataJudSearchResponse;

        if (response.hits) {
          results.push(...response.hits);
        }
      } catch {
        // AIDEV-NOTE: Ignora blocos mal formados
        console.warn('[DataJudResultsRenderer] Falha ao fazer parse do bloco datajud');
      }
    }

    return results;
  };

  // AIDEV-NOTE: Parse do conteudo para extrair resultados
  const results = parseDataJudResults(content);

  // AIDEV-NOTE: Estado para paginacao - inicializa com 5 ou menos resultados visiveis
  const initialVisibleCount = results.length > 0 ? Math.min(5, results.length) : 0;
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  if (results.length === 0) {
    return null;
  }

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  /**
   * Carrega mais resultados
   */
  const handleLoadMore = () => {
    setVisibleCount(Math.min(visibleCount + 5, results.length));
  };

  /**
   * Wrapper para callback de clique em resultado
   */
  const handleResultClick = (result: DataJudSearchResult) => {
    onResultClick?.(result);
  };

  return (
    <div className="space-y-4 my-4">
      {/* Header com total de resultados */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="font-medium text-foreground">
            {t('results.title')}
          </h3>
          <span className="text-sm text-muted-foreground">
            ({results.length} {results.length === 1 ? 'processo' : 'processos'})
          </span>
        </div>

        {onNewSearch && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNewSearch}
          >
            {t('search.submit')}
          </Button>
        )}
      </div>

      {/* Lista de resultados */}
      <div className="space-y-4">
        {visibleResults.map((result, index) => (
          <DataJudResultCard
            key={`${result.process.numeroProcesso}-${index}`}
            result={result}
            hasMore={hasMore && index === visibleCount - 1}
            onLoadMore={handleLoadMore}
            onOpenBrowser={onOpenBrowser}
          />
        ))}
      </div>

      {/* Botao carregar mais */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={handleLoadMore}
          >
            {t('results.loadMore')} ({results.length - visibleCount} restantes)
          </Button>
        </div>
      )}

      {/* Feedback quando nao ha resultados */}
      {results.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            {t('results.noResults')}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('results.noResultsDescription')}
          </p>
        </div>
      )}
    </div>
  );
}

export default DataJudResultsRenderer;
