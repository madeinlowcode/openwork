/**
 * Extrator de texto e conteúdo de arquivos DOCX
 * Utiliza mammoth para processamento
 */

import mammoth from 'mammoth';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DOCXExtractionResult {
  sucesso: boolean;
  texto: string;
  html: string | null;
  mensagensConversao: string[];
  tamanhoBytes: number;
  erro?: string;
}

export interface DOCXOptions {
  incluirHTML?: boolean;
  estiloPersonalizado?: Record<string, string>;
}

/**
 * Extrai texto e opcionalmente HTML de um arquivo DOCX
 */
export async function extractDOCX(
  filePath: string,
  options: DOCXOptions = {}
): Promise<DOCXExtractionResult> {
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      return {
        sucesso: false,
        texto: '',
        html: null,
        mensagensConversao: [],
        tamanhoBytes: 0,
        erro: `Arquivo não encontrado: ${filePath}`,
      };
    }

    // Verificar extensão
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.docx') {
      return {
        sucesso: false,
        texto: '',
        html: null,
        mensagensConversao: [],
        tamanhoBytes: 0,
        erro: `Arquivo não é um DOCX: ${ext}`,
      };
    }

    // Obter tamanho do arquivo
    const stats = fs.statSync(filePath);

    // Extrair texto bruto
    const textResult = await mammoth.extractRawText({ path: filePath });

    // Extrair HTML se solicitado
    let html: string | null = null;
    let htmlMessages: string[] = [];

    if (options.incluirHTML) {
      const mammothOptions: mammoth.Options = {};
      
      // Aplicar estilos personalizados se fornecidos
      if (options.estiloPersonalizado) {
        mammothOptions.styleMap = Object.entries(options.estiloPersonalizado).map(
          ([docxStyle, htmlStyle]) => `${docxStyle} => ${htmlStyle}`
        );
      }

      const htmlResult = await mammoth.convertToHtml({ path: filePath }, mammothOptions);
      html = htmlResult.value;
      htmlMessages = htmlResult.messages.map((m) => `${m.type}: ${m.message}`);
    }

    // Combinar mensagens
    const mensagens = [
      ...textResult.messages.map((m) => `${m.type}: ${m.message}`),
      ...htmlMessages,
    ];

    return {
      sucesso: true,
      texto: textResult.value || '',
      html,
      mensagensConversao: mensagens,
      tamanhoBytes: stats.size,
    };
  } catch (error) {
    return {
      sucesso: false,
      texto: '',
      html: null,
      mensagensConversao: [],
      tamanhoBytes: 0,
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extrai apenas o texto bruto de um DOCX (mais rápido)
 */
export async function extractDOCXText(filePath: string): Promise<string> {
  const result = await extractDOCX(filePath);
  return result.sucesso ? result.texto : '';
}

/**
 * Converte DOCX para HTML com estilos preservados
 */
export async function convertDOCXToHTML(
  filePath: string,
  styleMap?: string[]
): Promise<{ html: string; messages: string[] }> {
  try {
    const options: mammoth.Options = {};
    if (styleMap) {
      options.styleMap = styleMap;
    }

    const result = await mammoth.convertToHtml({ path: filePath }, options);

    return {
      html: result.value,
      messages: result.messages.map((m) => `${m.type}: ${m.message}`),
    };
  } catch (error) {
    return {
      html: '',
      messages: [error instanceof Error ? error.message : String(error)],
    };
  }
}
