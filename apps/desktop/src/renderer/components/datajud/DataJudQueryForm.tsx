'use client';

/**
 * @component DataJudQueryForm
 * @description Dialog modal para buscas no DataJud com tela de selecao de tipo e formulario.
 * Chama a API IPC diretamente via window.jurisiar.datajud.searchByXxx()
 *
 * @context Modal aberto pela HomePage quando usuario clica no card DataJud
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
 * - pages/Home.tsx (abre este dialog)
 * - DataJudResults.tsx (exibe resultados retornados por onResult)
 *
 * @stateManagement
 * - useState: selectedType (null = tela de cards, definido = formulario)
 * - useState: court, value, dateFrom, dateTo, instance
 * - useState: error (mensagem de erro inline)
 *
 * AIDEV-WARNING: Requer IPC handlers implementados para busca efetiva
 * AIDEV-NOTE: Fluxo: Dialog abre -> cards de tipo -> clica -> formulario -> submete -> IPC -> onResult
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Archive, Gavel, Users, Calendar, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useDataJud } from './hooks/useDataJud';
import type { DataJudSearchType } from './types';

type SearchType = 'number' | 'class' | 'party' | 'dateRange';
type InstanceType = 'g1' | 'g2' | 'je';
type CourtType =
  | 'stj' | 'tst' | 'tse' | 'stm'
  | 'trf1' | 'trf2' | 'trf3' | 'trf4' | 'trf5'
  | 'tjsp' | 'tjrj' | 'tjmg'
  | 'trt1' | 'trt2' | 'trt3' | 'trt4';

/**
 * @description Props do DataJudQueryForm
 * AIDEV-WARNING: onResult substitui o antigo onSubmit - recebe dados da API diretamente
 */
interface DataJudQueryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (data: any) => void;
}

/**
 * AIDEV-NOTE: Configuracao dos 4 cards de tipo de consulta
 */
const QUERY_TYPE_CARDS: ReadonlyArray<{ type: SearchType; icon: typeof Archive }> = [
  { type: 'number', icon: Archive },
  { type: 'class', icon: Gavel },
  { type: 'party', icon: Users },
  { type: 'dateRange', icon: Calendar },
];

export function DataJudQueryForm({
  open,
  onOpenChange,
  onResult,
}: DataJudQueryFormProps) {
  const { t } = useTranslation('datajud');
  const { status: connectionStatus } = useDataJud();

  // AIDEV-NOTE: null = tela de selecao de tipo, definido = formulario
  const [selectedType, setSelectedType] = useState<SearchType | null>(null);
  const [court, setCourt] = useState<CourtType | 'all'>('tjsp');
  const [instance, setInstance] = useState<InstanceType | ''>('');
  const [value, setValue] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setSelectedType(null);
    setValue('');
    setDateFrom('');
    setDateTo('');
    setInstance('');
    setCourt('tjsp');
    setError(null);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }, [onOpenChange, resetForm]);

  const isFormValid = useCallback(() => {
    if (!selectedType) return false;
    if (selectedType === 'dateRange') return !!(dateFrom && dateTo);
    return !!value.trim();
  }, [selectedType, value, dateFrom, dateTo]);

  /**
   * AIDEV-NOTE: handleSubmit chama a API IPC diretamente conforme selectedType
   * AIDEV-WARNING: Usa window.jurisiar.datajud - requer preload configurado
   */
  const handleSubmit = useCallback(async () => {
    if (!isFormValid() || !selectedType) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const datajud = (window as any).jurisiar?.datajud;
      if (!datajud) {
        setError('DataJud API not available');
        return;
      }

      const courtStr = court === 'all' ? 'tjsp' : court;
      let result: { success: boolean; result?: any; error?: string };

      // AIDEV-NOTE: Dispatch para o metodo IPC correto conforme tipo de busca
      switch (selectedType) {
        case 'number':
          result = await datajud.searchByNumber(courtStr, value.trim(), { size: 10 });
          break;
        case 'class':
          result = await datajud.searchByClass(courtStr, value.trim(), {
            size: 10,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            instance: instance || undefined,
          });
          break;
        case 'party':
          result = await datajud.searchByParty(courtStr, value.trim(), { size: 10 });
          break;
        case 'dateRange':
          result = await datajud.searchByDateRange(courtStr, dateFrom, dateTo, {
            size: 10,
            instance: instance || undefined,
          });
          break;
        default:
          return;
      }

      if (result.success === false) {
        setError(result.error || t('errors.unknown'));
      } else {
        onResult(result.result);
        handleOpenChange(false);
      }
    } catch (err: any) {
      setError(err?.message || t('errors.unknown'));
    } finally {
      setIsSubmitting(false);
    }
  }, [isFormValid, selectedType, court, instance, value, dateFrom, dateTo, onResult, handleOpenChange, t]);

  const getValueHint = () => {
    switch (selectedType) {
      case 'number': return t('search.value.hintNumber');
      case 'class': return t('search.value.hintClass');
      case 'party': return t('search.value.hintParty');
      case 'dateRange': return t('search.value.hintDate');
      default: return '';
    }
  };

  const renderSearchFields = () => {
    if (selectedType === 'dateRange') {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">{t('search.dateFrom')}</Label>
            <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={isSubmitting} className="focus-visible:ring-primary/30" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">{t('search.dateTo')}</Label>
            <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={isSubmitting} className="focus-visible:ring-primary/30" />
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <Label htmlFor="searchValue">{t('search.value.label')}</Label>
        <Input id="searchValue" type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder={getValueHint()} disabled={isSubmitting} className="focus-visible:ring-primary/30" />
      </div>
    );
  };

  /**
   * AIDEV-NOTE: Tela inicial com 4 cards de tipo de consulta
   */
  const renderTypeSelection = () => (
    <div className="grid grid-cols-2 gap-4 py-4">
      {QUERY_TYPE_CARDS.map((card) => {
        const IconComponent = card.icon;
        return (
          <motion.button
            key={card.type}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSelectedType(card.type)}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border bg-card hover:border-ring hover:bg-muted/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <IconComponent className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <div className="font-medium text-sm text-foreground">
                {t(`queryTypes.${card.type}.title`)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t(`queryTypes.${card.type}.description`)}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );

  /**
   * AIDEV-NOTE: Grau so aparece para buscas por classe e periodo (nao NPU nem parte)
   */
  const showInstanceField = selectedType === 'class' || selectedType === 'dateRange';

  /**
   * AIDEV-NOTE: Tela de formulario - campos variam conforme tipo de busca
   * - NPU: Tribunal + Numero (API identifica unicamente pelo numero)
   * - Classe: Tribunal + Classe + Grau (opcional) + Datas (opcional)
   * - Parte: Tribunal + Nome da parte
   * - Periodo: Tribunal + Data inicial + Data final + Grau (opcional)
   */
  const renderForm = () => (
    <div className="space-y-6 py-4">
      {/* Botao Voltar */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setSelectedType(null); setError(null); }}
        className="flex items-center gap-1 -ml-2"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('queryTypes.back')}
      </Button>

      {/* Tribunal - sempre visivel */}
      <div className="space-y-2">
        <Label htmlFor="court">{t('search.court.label')}</Label>
        <Select value={court} onValueChange={(val: string) => setCourt(val as CourtType | 'all')} disabled={isSubmitting}>
          <SelectTrigger id="court" className="focus:ring-primary/30 focus:ring-2">
            <SelectValue placeholder={t('search.court.placeholder')} />
          </SelectTrigger>
          <SelectContent className="[&_[data-radix-collection-item]:focus]:bg-primary/10 [&_[data-radix-collection-item]:focus]:text-primary-900">
            <SelectItem value="stj">STJ - Superior Tribunal de Justica</SelectItem>
            <SelectItem value="tst">TST - Tribunal Superior do Trabalho</SelectItem>
            <SelectItem value="tse">TSE - Tribunal Superior Eleitoral</SelectItem>
            <SelectItem value="stm">STM - Tribunal Superior Militar</SelectItem>
            <SelectItem value="trf1">TRF1 - 1a Regiao</SelectItem>
            <SelectItem value="trf2">TRF2 - 2a Regiao</SelectItem>
            <SelectItem value="trf3">TRF3 - 3a Regiao</SelectItem>
            <SelectItem value="trf4">TRF4 - 4a Regiao</SelectItem>
            <SelectItem value="trf5">TRF5 - 5a Regiao</SelectItem>
            <SelectItem value="tjsp">TJSP - Sao Paulo</SelectItem>
            <SelectItem value="tjrj">TJRJ - Rio de Janeiro</SelectItem>
            <SelectItem value="tjmg">TJMG - Minas Gerais</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grau - apenas para classe e periodo */}
      {showInstanceField && (
        <div className="space-y-2">
          <Label htmlFor="instance">{t('search.instance.label')}</Label>
          <Select value={instance} onValueChange={(val: string) => setInstance(val as InstanceType)} disabled={isSubmitting}>
            <SelectTrigger id="instance" className="focus:ring-primary/30 focus:ring-2">
              <SelectValue placeholder={t('search.instance.placeholder')} />
            </SelectTrigger>
            <SelectContent className="[&_[data-radix-collection-item]:focus]:bg-primary/10 [&_[data-radix-collection-item]:focus]:text-primary-900">
              <SelectItem value="g1">{t('search.instance.g1')}</SelectItem>
              <SelectItem value="g2">{t('search.instance.g2')}</SelectItem>
              <SelectItem value="je">{t('search.instance.je')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Campos de busca especificos */}
      {renderSearchFields()}

      {/* Erro inline */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{t('search.errorMessage', { error })}</span>
        </div>
      )}

      {/* Botoes */}
      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting} className="hover:bg-primary/10 hover:text-primary">
          {t('search.cancel')}
        </Button>
        <Button onClick={handleSubmit} disabled={!isFormValid() || isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('search.searching')}
            </span>
          ) : (
            t('search.submit')
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]" data-testid="datajud-query-form">
        <DialogHeader>
          <DialogTitle>
            {selectedType ? t(`queryTypes.${selectedType}.title`) : t('title')}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {selectedType === null ? (
            <motion.div
              key="type-selection"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {renderTypeSelection()}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
            >
              {renderForm()}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default DataJudQueryForm;
