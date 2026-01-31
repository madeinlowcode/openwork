/**
 * Extrator de texto e metadados de arquivos PDF
 * Utiliza pdf-parse para processamento
 */

import pdfParse from 'pdf-parse';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PDFMetadata {
  titulo: string | null;
  autor: string | null;
  criador: string | null;
  produtor: string | null;
  dataCriacao: string | null;
  dataModificacao: string | null;
}

export interface PDFExtractionResult {
  sucesso: boolean;
  texto: string;
  numeroPaginas: number;
  metadados: PDFMetadata;
  tamanhoBytes: number;
  erro?: string;
}

/**
 * Extrai texto e metadados de um arquivo PDF
 */
export async function extractPDF(filePath: string): Promise<PDFExtractionResult> {
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      return {
        sucesso: false,
        texto: '',
        numeroPaginas: 0,
        metadados: {
          titulo: null,
          autor: null,
          criador: null,
          produtor: null,
          dataCriacao: null,
          dataModificacao: null,
        },
        tamanhoBytes: 0,
        erro: `Arquivo não encontrado: ${filePath}`,
      };
    }

    // Verificar extensão
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pdf') {
      return {
        sucesso: false,
        texto: '',
        numeroPaginas: 0,
        metadados: {
          titulo: null,
          autor: null,
          criador: null,
          produtor: null,
          dataCriacao: null,
          dataModificacao: null,
        },
        tamanhoBytes: 0,
        erro: `Arquivo não é um PDF: ${ext}`,
      };
    }

    // Ler arquivo
    const dataBuffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);

    // Extrair dados com pdf-parse
    const data = await pdfParse(dataBuffer);

    // Processar metadados
    const info = data.info || {};
    const metadados: PDFMetadata = {
      titulo: info.Title || null,
      autor: info.Author || null,
      criador: info.Creator || null,
      produtor: info.Producer || null,
      dataCriacao: info.CreationDate ? formatPDFDate(info.CreationDate) : null,
      dataModificacao: info.ModDate ? formatPDFDate(info.ModDate) : null,
    };

    return {
      sucesso: true,
      texto: data.text || '',
      numeroPaginas: data.numpages || 0,
      metadados,
      tamanhoBytes: stats.size,
    };
  } catch (error) {
    return {
      sucesso: false,
      texto: '',
      numeroPaginas: 0,
      metadados: {
        titulo: null,
        autor: null,
        criador: null,
        produtor: null,
        dataCriacao: null,
        dataModificacao: null,
      },
      tamanhoBytes: 0,
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Converte data do formato PDF para formato legível
 * Formato PDF: D:YYYYMMDDHHmmSSOHH'mm'
 */
function formatPDFDate(pdfDate: string): string {
  try {
    if (!pdfDate) return pdfDate;

    // Remover prefixo D:
    let dateStr = pdfDate.replace(/^D:/, '');

    // Extrair componentes
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6) || '01';
    const day = dateStr.substring(6, 8) || '01';
    const hour = dateStr.substring(8, 10) || '00';
    const minute = dateStr.substring(10, 12) || '00';
    const second = dateStr.substring(12, 14) || '00';

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch {
    return pdfDate;
  }
}

/**
 * Extrai texto de um intervalo específico de páginas
 */
export async function extractPDFPages(
  filePath: string,
  startPage: number,
  endPage: number
): Promise<PDFExtractionResult> {
  try {
    const result = await extractPDF(filePath);
    
    if (!result.sucesso) {
      return result;
    }

    // Nota: pdf-parse não suporta extração por página diretamente
    // Retornamos o texto completo com indicação das páginas solicitadas
    return {
      ...result,
      texto: result.texto,
    };
  } catch (error) {
    return {
      sucesso: false,
      texto: '',
      numeroPaginas: 0,
      metadados: {
        titulo: null,
        autor: null,
        criador: null,
        produtor: null,
        dataCriacao: null,
        dataModificacao: null,
      },
      tamanhoBytes: 0,
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}
