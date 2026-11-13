import mammoth from 'mammoth';
import { extractText } from 'unpdf';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB strict ceiling

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'csv',
  'json',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'html',
  'css',
  'sql',
  'yaml',
  'yml',
  'xml',
  'log',
]);

export interface ExtractedUploadResult {
  filename: string;
  extension: string;
  bytes: number;
  extractedText: string;
  pageCount?: number;
  truncated: boolean;
}

export async function extractTextFromUploadedBase64(params: {
  filename: string;
  mimeType?: string;
  base64Data: string;
}): Promise<ExtractedUploadResult> {
  const cleanName = String(params.filename || 'document').replace(/[\\/:*?"<>|]/g, '_');
  const ext = (cleanName.split('.').pop() || '').toLowerCase();

  const stripped = String(params.base64Data || '').replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(stripped, 'base64');

  if (buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds maximum supported upload limit of ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`);
  }

  let extractedText = '';
  let pageCount: number | undefined;

  if (ext === 'pdf' || params.mimeType === 'application/pdf') {
    const magic = buffer.subarray(0, 4).toString('ascii');
    if (magic !== '%PDF') {
      throw new Error('Invalid or corrupted PDF header signature.');
    }
    try {
      const pdfResult = await extractText(new Uint8Array(buffer), { mergePages: true });
      extractedText = String(pdfResult?.text || '').trim();
      pageCount = typeof pdfResult?.totalPages === 'number' ? pdfResult.totalPages : undefined;
      if (!extractedText) {
        throw new Error('PDF contains no extractable text layer (scanned/image-only PDF requires OCR).');
      }
    } catch (err: any) {
      throw new Error(`PDF extraction failed: ${err?.message || 'Corrupted or encrypted PDF'}`);
    }
  } else if (
    ext === 'docx' ||
    params.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const zipMagic = buffer.subarray(0, 2).toString('ascii');
    if (zipMagic !== 'PK') {
      throw new Error('Invalid DOCX container (missing OOXML ZIP signature).');
    }
    try {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = String(result?.value || '').trim();
      if (!extractedText) {
        throw new Error('DOCX document contained no readable text.');
      }
    } catch (err: any) {
      throw new Error(`DOCX extraction failed: ${err?.message || 'Invalid DOCX file'}`);
    }
  } else if (TEXT_EXTENSIONS.has(ext) || (params.mimeType || '').startsWith('text/')) {
    extractedText = buffer.toString('utf-8').trim();
  } else {
    throw new Error(
      `Unsupported binary format ".${ext}". Supported formats: PDF, DOCX, TXT, MD, CSV, JSON, and source code files.`
    );
  }

  const MAX_CHARS = 120_000;
  const truncated = extractedText.length > MAX_CHARS;
  if (truncated) {
    extractedText = extractedText.slice(0, MAX_CHARS);
  }

  return {
    filename: cleanName,
    extension: ext,
    bytes: buffer.length,
    extractedText,
    pageCount,
    truncated,
  };
}
