'use client';

/**
 * @component DataJudResults
 * @description Dialog para exibir resultados de busca no DataJud com lista de processos,
 * secoes expansiveis de movimentacoes, e acoes de copiar/nova busca.
 *
 * @context Aberto pela HomePage apos busca bem-sucedida via DataJudQueryForm
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes 'datajud')
 * - components/ui/dialog (modal)
 * - components/ui/card (cards de processo)
 * - components/ui/button (botoes)
 * - components/ui/collapsible (secoes expansiveis)
 * - lucide-react (icones)
 *
 * @relatedFiles
 * - locales/pt-BR/datajud.json (traducoes PT)
 * - locales/en/datajud.json (traducoes EN)
 * - pages/Home.tsx (renderiza este componente)
 * - DataJudQueryForm.tsx (fornece dados via onResult)
 *
 * @stateManagement
 * - useState: copiedId (controle do feedback de copia)
 * - useState: expandedMovements (secoes expansiveis por processo)
 *
 * AIDEV-WARNING: Estrutura dos dados depende do retorno parseado pelo service datajud.ts
 * AIDEV-NOTE: data = { processes: DataJudProcess[], pagination: { total }, metadata }
 *
 * Campos reais da API DataJud (_source):
 *   numeroProcesso, classe{codigo,nome}, tribunal, grau, dataAjuizamento("YYYYMMDDHHMMSS"),
 *   orgaoJulgador{nome}, assuntos[{codigo,nome}], sistema{nome}, formato{nome},
 *   nivelSigilo, movimentos[{nome, dataHora(ISO), codigo, complementosTabelados[]}]
 *   NOTA: campo "partes" NAO existe no retorno da API publica
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Copy,
  Check,
  Search,
  ChevronDown,
  ScrollText,
  FileSearch,
} from 'lucide-react';

/**
 * @description Props do DataJudResults
 * AIDEV-WARNING: data e o retorno do service (DataJudSearchResult parseado)
 */
interface DataJudResultsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any;
  onNewSearch: () => void;
}

export function DataJudResults({
  open,
  onOpenChange,
  data,
  onNewSearch,
}: DataJudResultsProps) {
  const { t } = useTranslation('datajud');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedMovements, setExpandedMovements] = useState<Set<number>>(new Set());

  // AIDEV-NOTE: data é DataJudSearchResult: { processes: [...], pagination: { total }, metadata }
  const processes: any[] = data?.processes || [];
  const total: number = data?.pagination?.total ?? processes.length;

  /**
   * AIDEV-NOTE: API DataJud retorna datas em dois formatos:
   * - dataAjuizamento: "20181029000000" (YYYYMMDDHHMMSS)
   * - dataHora em movimentos: "2018-10-30T14:06:24.000Z" (ISO)
   */
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    try {
      // Formato DataJud: "20181029000000" (14 digitos)
      if (/^\d{14}$/.test(dateStr)) {
        const y = dateStr.slice(0, 4);
        const m = dateStr.slice(4, 6);
        const d = dateStr.slice(6, 8);
        return `${d}/${m}/${y}`;
      }
      // Formato ISO
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleCopy = useCallback(async (processNumber: string) => {
    try {
      await navigator.clipboard.writeText(processNumber);
      setCopiedId(processNumber);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('[DataJudResults] Failed to copy:', err);
    }
  }, []);

  const toggleMovements = useCallback((index: number) => {
    setExpandedMovements((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const renderEmpty = () => (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <FileSearch className="w-12 h-12 text-muted-foreground" />
      <div>
        <p className="text-lg font-medium text-foreground">{t('results.noResults')}</p>
        <p className="text-sm text-muted-foreground mt-1">{t('results.noResultsDescription')}</p>
      </div>
      <Button onClick={onNewSearch} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary">
        <Search className="w-4 h-4 mr-2" />
        {t('results.newSearch')}
      </Button>
    </div>
  );

  /**
   * AIDEV-NOTE: Renderiza card de processo baseado nos campos parseados pelo service
   * O service mapeia: numeroProcesso, classe{codigo,nome}, tribunal, grau,
   * dataAjuizamento, orgaoJulgador{nome}, movimentacoes[{tipoMovimento, dataMovimentacao, codigo}]
   */
  const renderProcessCard = (processo: any, index: number) => {
    const numero = processo?.numeroProcesso || '-';
    const classeNome = processo?.classe?.nome || processo?.classe?.description || '-';
    const tribunal = processo?.tribunal || '-';
    const grau = processo?.grau || '-';
    const dataAjuizamento = processo?.dataAjuizamento;
    const orgaoJulgador = processo?.orgaoJulgador?.nome || processo?.orgaoJulgador?.name || '';
    const assuntos = processo?.temas || [];
    const movimentacoes = processo?.movimentacoes || [];

    return (
      <Card key={index} className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {/* Header do processo */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1 min-w-0">
              {/* Numero + botao copiar */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground font-mono">
                  {numero}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0 hover:bg-primary/10 hover:text-primary"
                  onClick={() => handleCopy(numero)}
                >
                  {copiedId === numero ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>

              {/* Classe */}
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">{t('results.class')}:</span> {classeNome}
              </div>

              {/* Tribunal + Grau */}
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">{t('results.court')}:</span> {tribunal}
                {grau !== '-' && (
                  <span className="ml-2">
                    <span className="font-medium">{t('results.instance')}:</span> {grau}
                  </span>
                )}
              </div>

              {/* Data de Ajuizamento */}
              {dataAjuizamento && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">{t('results.date')}:</span> {formatDate(dataAjuizamento)}
                </div>
              )}

              {/* Orgao Julgador */}
              {orgaoJulgador && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Orgao Julgador:</span> {orgaoJulgador}
                </div>
              )}

              {/* Assuntos */}
              {assuntos.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Assuntos:</span>{' '}
                  {assuntos.map((a: any) => a?.nome || a?.name || a?.description || '').filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Movimentacoes - secao expansivel */}
          {movimentacoes.length > 0 && (
            <Collapsible
              open={expandedMovements.has(index)}
              onOpenChange={() => toggleMovements(index)}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2 hover:bg-primary/10 hover:text-primary">
                  <span className="flex items-center gap-1.5 text-xs">
                    <ScrollText className="w-3 h-3" />
                    {t('results.movements.title')} ({movimentacoes.length})
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${expandedMovements.has(index) ? 'rotate-180' : ''}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 pt-1 pl-2 max-h-60 overflow-y-auto">
                  {movimentacoes.map((mov: any, i: number) => (
                    <div key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                      <div className="font-medium">
                        {mov?.tipoMovimento || mov?.nome || '-'}
                      </div>
                      {(mov?.dataMovimentacao || mov?.dataHora) && (
                        <div className="text-[10px]">
                          {formatDate(mov?.dataMovimentacao || mov?.dataHora)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] flex flex-col" data-testid="datajud-results">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{t('results.title')}</span>
            <Button variant="outline" size="sm" onClick={onNewSearch} className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary">
              <Search className="w-4 h-4 mr-1" />
              {t('results.newSearch')}
            </Button>
          </DialogTitle>
          {total > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('results.total', { count: total })}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {processes.length === 0 ? renderEmpty() : processes.map((p, i) => renderProcessCard(p, i))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DataJudResults;
