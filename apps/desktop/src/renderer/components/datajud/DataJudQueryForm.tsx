'use client';

/**
 * @component DataJudQueryForm
 * @description Formulario modal para construir buscas no DataJud
 *
 * @context Modal aberto pela HomePage quando usuario clica em card DataJud
 *
 * @dependencies
 * - react-i18next (useTranslation para traducoes 'datajud')
 * - hooks/useDataJud (gerenciamento de estado do DataJud)
 * - components/ui/dialog (modal)
 * - components/ui/select (seletores)
 * - components/ui/input (campos de texto)
 * - components/ui/button (botoes)
 *
 * @relatedFiles
 * - locales/pt-BR/datajud.json (traducoes PT)
 * - locales/en/datajud.json (traducoes EN)
 * - components/datajud/hooks/useDataJud.ts
 *
 * @stateManagement
 * - useState: searchType, court, value, dateFrom, dateTo, instance
 * - useDataJud: validacao e salvamento de API key
 *
 * AIDEV-WARNING: Requer IPC handlers implementados para busca efetiva
 * AIDEV-NOTE: Gera prompt estruturado para o agente OpenCode
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDataJud } from './hooks/useDataJud';
import type { DataJudSearchType } from './types';

/**
 * Tipos de busca suportados pelo DataJud
 */
type SearchType = 'number' | 'class' | 'party' | 'dateRange';

/**
 * Tipos de instancia (grau do processo)
 */
type InstanceType = 'g1' | 'g2' | 'je';

/**
 * Tribunais suportados (abreviados para API)
 */
type CourtType =
  | 'stj' | 'tst' | 'tse' | 'stm'
  | 'trf1' | 'trf2' | 'trf3' | 'trf4' | 'trf5'
  | 'tjsp' | 'tjrj' | 'tjmg'
  | 'trt1' | 'trt2' | 'trt3' | 'trt4';

interface DataJudQueryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Callback executado com o prompt estruturado gerado
   * Este prompt sera enviado ao agente OpenCode para execucao
   */
  onSubmit?: (query: DataJudQueryParams) => void;
  /**
   * Tipo de busca pre-selecionado (quando aberto via clique em card)
   */
  initialSearchType?: SearchType;
}

interface DataJudQueryParams {
  searchType: SearchType;
  court: CourtType | 'all';
  instance?: InstanceType;
  value: string;
  dateFrom?: string;
  dateTo?: string;
}

export function DataJudQueryForm({
  open,
  onOpenChange,
  onSubmit,
  initialSearchType,
}: DataJudQueryFormProps) {
  const { t } = useTranslation('datajud');
  const { status: connectionStatus, validateKey } = useDataJud();

  // AIDEV-NOTE: Estado do formulario
  const [searchType, setSearchType] = useState<SearchType>(initialSearchType || 'number');
  const [court, setCourt] = useState<CourtType | 'all'>('tjsp');
  const [instance, setInstance] = useState<InstanceType | ''>('');
  const [value, setValue] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Verifica se o formulario esta valido para submissao
   */
  const isFormValid = useCallback(() => {
    if (!value.trim()) return false;

    if (searchType === 'dateRange') {
      return dateFrom && dateTo;
    }

    return true;
  }, [searchType, value, dateFrom, dateTo]);

  /**
   * Gera o prompt estruturado para o agente OpenCode
   */
  const generatePrompt = useCallback((): string => {
    const courtName = court === 'all'
      ? t('search.court.all')
      : t(`courts.${court}`);

    const instanceLabel = instance
      ? t(`search.instance.${instance}`)
      : '';

    switch (searchType) {
      case 'number':
        return `Buscar processo no DataJud:
- Tipo: Busca por numero (NPU)
- Tribunal: ${courtName}
- Numero do processo: ${value}
${instanceLabel ? `- Grau: ${instanceLabel}` : ''}`;

      case 'class':
        return `Buscar processos no DataJud:
- Tipo: Busca por classe
- Tribunal: ${courtName}
- Classe: ${value}
${instanceLabel ? `- Grau: ${instanceLabel}` : ''}`;

      case 'party':
        return `Buscar processos no DataJud:
- Tipo: Busca por parte
- Tribunal: ${courtName}
- Nome da parte: ${value}
${instanceLabel ? `- Grau: ${instanceLabel}` : ''}
- Mostrar detalhes das partes (autor, reu, advogados)
- Incluir movimentacoes do processo`;

      case 'dateRange':
        return `Buscar processos no DataJud:
- Tipo: Busca por intervalo de datas
- Tribunal: ${courtName}
- Data inicial: ${dateFrom}
- Data final: ${dateTo}
${instanceLabel ? `- Grau: ${instanceLabel}` : ''}
- Mostrar numero do processo, classe e data de autuacao`;

      default:
        return '';
    }
  }, [searchType, court, instance, value, dateFrom, dateTo, t]);

  /**
   * Manipula a submissao do formulario
   */
  const handleSubmit = useCallback(async () => {
    if (!isFormValid()) return;

    setIsSubmitting(true);

    try {
      // Verificar se API key esta configurada
      if (connectionStatus !== 'connected') {
        // TODO: Validar API key antes de submeter
        // await validateKey(apiKey);
        console.warn('[DataJudQueryForm] API key nao configurada');
      }

      const queryParams: DataJudQueryParams = {
        searchType,
        court,
        instance: instance as InstanceType || undefined,
        value: value.trim(),
        dateFrom: searchType === 'dateRange' ? dateFrom : undefined,
        dateTo: searchType === 'dateRange' ? dateTo : undefined,
      };

      const prompt = generatePrompt();

      // Callback com o prompt gerado
      if (onSubmit) {
        onSubmit(queryParams);
      }

      // Fechar o modal
      onOpenChange(false);

      // Resetar formulario
      setValue('');
      setDateFrom('');
      setDateTo('');
      setInstance('');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isFormValid,
    connectionStatus,
    validateKey,
    searchType,
    court,
    instance,
    value,
    dateFrom,
    dateTo,
    generatePrompt,
    onSubmit,
    onOpenChange,
  ]);

  /**
   * Obtem a dica para o campo de valor baseada no tipo de busca
   */
  const getValueHint = () => {
    switch (searchType) {
      case 'number':
        return t('search.value.hintNumber');
      case 'class':
        return t('search.value.hintClass');
      case 'party':
        return t('search.value.hintParty');
      case 'dateRange':
        return t('search.value.hintDate');
      default:
        return '';
    }
  };

  /**
   * Renderiza o campo apropriado baseado no tipo de busca
   */
  const renderSearchFields = () => {
    if (searchType === 'dateRange') {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">{t('search.dateFrom')}</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">{t('search.dateTo')}</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label htmlFor="searchValue">{t('search.value.label')}</Label>
        <Input
          id="searchValue"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={getValueHint()}
          disabled={isSubmitting}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="datajud-query-form">
        <DialogHeader>
          <DialogTitle>{t('search.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tipo de Busca */}
          <div className="space-y-2">
            <Label htmlFor="searchType">{t('search.searchType.label')}</Label>
            <Select
              value={searchType}
              onValueChange={(val: string) => setSearchType(val as SearchType)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="searchType">
                <SelectValue placeholder={t('search.searchType.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">{t('search.searchType.number')}</SelectItem>
                <SelectItem value="class">{t('search.searchType.class')}</SelectItem>
                <SelectItem value="party">{t('search.searchType.party')}</SelectItem>
                <SelectItem value="dateRange">{t('search.searchType.dateRange')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tribunal */}
          <div className="space-y-2">
            <Label htmlFor="court">{t('search.court.label')}</Label>
            <Select
              value={court}
              onValueChange={(val: string) => setCourt(val as CourtType | 'all')}
              disabled={isSubmitting}
            >
              <SelectTrigger id="court">
                <SelectValue placeholder={t('search.court.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('search.court.all')}</SelectItem>
                <SelectItem value="stj">STJ - Superior Tribunal de Justica</SelectItem>
                <SelectItem value="tst">TST - Tribunal Superior do Trabalho</SelectItem>
                <SelectItem value="tse">TSE - Tribunal Superior Eleitoral</SelectItem>
                <SelectItem value="stm">STM - Tribunal Superior Militar</SelectItem>
                <SelectItem value="tjsp">TJSP - Sao Paulo</SelectItem>
                <SelectItem value="tjrj">TJRJ - Rio de Janeiro</SelectItem>
                <SelectItem value="tjmg">TJMG - Minas Gerais</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grau (Opcional) */}
          <div className="space-y-2">
            <Label htmlFor="instance">{t('search.instance.label')}</Label>
            <Select
              value={instance}
              onValueChange={(val: string) => setInstance(val as InstanceType)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="instance">
                <SelectValue placeholder={t('search.instance.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="g1">{t('search.instance.g1')}</SelectItem>
                <SelectItem value="g2">{t('search.instance.g2')}</SelectItem>
                <SelectItem value="je">{t('search.instance.je')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campo de Valor ou Datas */}
          {renderSearchFields()}

          {/* Botoes de acao */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('search.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid() || isSubmitting}
            >
              {isSubmitting ? t('search.loading') : t('search.submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DataJudQueryForm;
