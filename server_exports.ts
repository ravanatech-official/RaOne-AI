import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  AlignmentType,
} from 'docx';
import PptxGenJSModule from 'pptxgenjs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { DocumentVisualTheme, DocumentPageSize, DocumentOrientation } from './src/types/document.ts';

const PptxGenJS: any = (PptxGenJSModule as any)?.default || PptxGenJSModule;

export interface ExportDocumentInput {
  title: string;
  content: string;
  summary?: string;
  companyName?: string;
  authorName?: string;
  footerNote?: string;
  visualTheme?: DocumentVisualTheme;
  pageSize?: DocumentPageSize;
  orientation?: DocumentOrientation;
  slides?: Array<{
    slideNumber?: number;
    title: string;
    subtitle?: string;
    bulletPoints?: string[];
    callout?: string;
    speakerNotes?: string;
  }>;
}

// Spreadsheet Formula-Injection Neutralizer (prevents =CMD(), +1+1, @SUM CSV/Excel exploits)
export function sanitizeSpreadsheetCell(value: string): string {
  const trimmed = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

function parseMarkdownTables(content: string): string[][][] {
  const lines = (content || '').split(/\r?\n/);
  const tables: string[][][] = [];
  let current: string[][] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
      if (/^\|?[\s:-]+(?:\|[\s:-]+)+\|?$/.test(trimmed)) {
        continue; // separator row
      }
      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));
      if (cells.length > 0) {
        current.push(cells);
      }
    } else if (current.length > 0) {
      tables.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    tables.push(current);
  }
  return tables;
}

function getThemeColors(theme?: DocumentVisualTheme) {
  switch (theme) {
    case 'editorial_ivory':
      return { bgHex: 'FAF8F5', titleHex: '111827', accentHex: 'B45309', bodyHex: '1F2937', mutedHex: '6B7280', cardHex: 'F3EFEA' };
    case 'emerald_sovereign':
      return { bgHex: '071512', titleHex: '34D399', accentHex: '10B981', bodyHex: 'E2E8F0', mutedHex: '94A3B8', cardHex: '0D231E' };
    case 'cobalt_architect':
      return { bgHex: '0A1124', titleHex: '60A5FA', accentHex: '3B82F6', bodyHex: 'E2E8F0', mutedHex: '94A3B8', cardHex: '131E3A' };
    case 'executive_obsidian':
    default:
      return { bgHex: '0F172A', titleHex: '38BDF8', accentHex: '0EA5E9', bodyHex: 'E2E8F0', mutedHex: '94A3B8', cardHex: '1E293B' };
  }
}

function buildTextRunsFromInlineMarkdown(line: string, size = 22): TextRun[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return new TextRun({ text: part.slice(2, -2), bold: true, size });
    }
    return new TextRun({ text: part, size });
  });
}

export async function generateTrueDocxBuffer(input: ExportDocumentInput): Promise<Buffer> {
  const lines = (input.content || '').split(/\r?\n/);
  const children: Array<Paragraph | Table> = [];

  if (input.companyName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: input.companyName.toUpperCase(),
            bold: true,
            size: 18,
            color: '0284C7',
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      text: input.title || 'RaOne Document',
      heading: HeadingLevel.TITLE,
    })
  );

  if (input.summary) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Executive Summary: ', bold: true, size: 22 }),
          new TextRun({ text: input.summary, italics: true, size: 22 }),
        ],
        spacing: { before: 120, after: 200 },
      })
    );
  }

  let tableRowsBuffer: string[][] = [];
  const flushTable = () => {
    if (tableRowsBuffer.length === 0) return;
    const rows = tableRowsBuffer.map((rowCells, rIdx) => {
      return new TableRow({
        children: rowCells.map(
          (cellText) =>
            new TableCell({
              shading: rIdx === 0 ? { fill: '0F172A' } : undefined,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cellText.replace(/\*\*/g, ''),
                      bold: rIdx === 0,
                      color: rIdx === 0 ? 'FFFFFF' : '1E293B',
                      size: 20,
                    }),
                  ],
                }),
              ],
            })
        ),
      });
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
          insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
        },
        rows,
      })
    );
    tableRowsBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.includes('|') && line.split('|').length >= 3) {
      if (!/^\|?[\s:-]+(?:\|[\s:-]+)+\|?$/.test(line)) {
        const cells = line
          .split('|')
          .map((c) => c.trim())
          .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));
        if (cells.length > 0) tableRowsBuffer.push(cells);
      }
      continue;
    } else if (tableRowsBuffer.length > 0) {
      flushTable();
    }

    if (!line) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }
    if (line.startsWith('### ')) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(
        new Paragraph({
          children: buildTextRunsFromInlineMarkdown(line.slice(2), 22),
          bullet: { level: 0 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: buildTextRunsFromInlineMarkdown(line, 22),
          spacing: { after: 80 },
        })
      );
    }
  }
  flushTable();

  const doc = new Document({
    creator: input.authorName || 'RaOne Document Studio',
    title: input.title || 'RaOne Document',
    sections: [
      {
        headers: input.companyName
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: `${input.companyName} · ${input.title}`, size: 16, color: '64748B' })],
                  }),
                ],
              }),
            }
          : undefined,
        footers: input.footerNote
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: input.footerNote, size: 16, color: '64748B' })],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function generateTruePptxBuffer(input: ExportDocumentInput): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.author = input.authorName || 'RaOne Document Studio';
  pres.title = input.title || 'RaOne Presentation';
  pres.layout = 'LAYOUT_WIDE';

  const palette = getThemeColors(input.visualTheme);

  const slides =
    input.slides && input.slides.length > 0
      ? input.slides
      : [
          {
            slideNumber: 1,
            title: input.title || 'Executive Overview',
            subtitle: input.companyName || 'Prepared with RaOne Document Studio',
            bulletPoints: (input.content || '')
              .split(/\r?\n/)
              .map((l) => l.replace(/^[-*#]+\s*/, '').trim())
              .filter(Boolean)
              .slice(0, 6),
          },
        ];

  for (const s of slides) {
    const slide = pres.addSlide();
    slide.background = { color: palette.bgHex };

    slide.addText(s.title || input.title, {
      x: 0.7,
      y: 0.5,
      w: '88%',
      h: 0.8,
      fontSize: 26,
      bold: true,
      color: palette.titleHex,
    });

    if (s.subtitle) {
      slide.addText(s.subtitle, {
        x: 0.7,
        y: 1.25,
        w: '88%',
        h: 0.45,
        fontSize: 14,
        color: palette.mutedHex,
      });
    }

    const bullets = (s.bulletPoints || []).filter(Boolean);
    if (bullets.length > 0) {
      slide.addText(
        bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
        {
          x: 0.8,
          y: 1.9,
          w: '86%',
          h: 3.6,
          fontSize: 16,
          color: palette.bodyHex,
          valign: 'top',
        }
      );
    }

    if (s.callout) {
      slide.addText(s.callout, {
        x: 0.7,
        y: 5.7,
        w: '88%',
        h: 0.7,
        fontSize: 12,
        italic: true,
        color: palette.titleHex,
        fill: { color: palette.cardHex },
      });
    }

    if (input.footerNote) {
      slide.addText(input.footerNote, {
        x: 0.7,
        y: 6.8,
        w: '88%',
        h: 0.3,
        fontSize: 10,
        color: palette.mutedHex,
      });
    }

    if (s.speakerNotes) {
      slide.addNotes(s.speakerNotes);
    }
  }

  const out = await pres.write({ outputType: 'nodebuffer' });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

export async function generateTrueXlsxBuffer(input: ExportDocumentInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = input.authorName || 'RaOne Document Studio';
  workbook.created = new Date();

  const tables = parseMarkdownTables(input.content || '');
  if (tables.length > 0) {
    tables.forEach((rows, tIdx) => {
      const sheet = workbook.addWorksheet(tIdx === 0 ? 'Document Data' : `Table ${tIdx + 1}`);
      rows.forEach((cells, rIdx) => {
        const added = sheet.addRow(cells.map((c) => sanitizeSpreadsheetCell(c)));
        if (rIdx === 0) {
          added.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          added.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F172A' },
          };
        }
      });
      sheet.columns.forEach((col) => {
        col.width = 30;
      });
    });
  } else {
    const sheet = workbook.addWorksheet('Document Data');
    const header = sheet.addRow(['Section / Line', 'Content']);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    (input.content || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line, idx) => {
        sheet.addRow([`Line ${idx + 1}`, sanitizeSpreadsheetCell(line)]);
      });
    sheet.columns.forEach((col) => {
      col.width = 42;
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateTruePdfBuffer(input: ExportDocumentInput): Promise<Buffer> {
  const pdfSafe = (value: string): string =>
    String(value || '')
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD]/g, '-')
      .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
      .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/[\u00A0\u2007\u202F]/g, ' ')
      .replace(/\u2192/g, '->')
      .replace(/\u2190/g, '<-')
      .replace(/\u2022/g, '-')
      .replace(/[\u200B-\u200D\uFEFF]/g, '');

  return new Promise((resolve, reject) => {
    const size = input.pageSize === 'Letter' ? 'LETTER' : input.pageSize === 'Legal' ? 'LEGAL' : 'A4';
    const layout = input.orientation === 'landscape' ? 'landscape' : 'portrait';

    const doc = new PDFDocument({ margin: 52, size, layout });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (input.companyName) {
      doc.fontSize(9).fillColor('#0284C7').text(pdfSafe(input.companyName).toUpperCase());
      doc.moveDown(0.25);
    }

    doc.fontSize(20).fillColor('#0F172A').text(pdfSafe(input.title || 'RaOne Document'));
    doc.moveDown(0.35);
    doc
      .fontSize(9)
      .fillColor('#64748B')
      .text(
        pdfSafe(`${input.authorName ? `${input.authorName} - ` : ''}Generated ${new Date().toISOString().slice(0, 10)}`)
      );
    doc.moveDown(0.9);

    if (input.summary) {
      doc.fontSize(10.5).fillColor('#334155').text(pdfSafe(input.summary), { lineGap: 3 });
      doc.moveDown(0.8);
    }

    const lines = pdfSafe(input.content || '').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        doc.moveDown(0.35);
      } else if (line.startsWith('# ')) {
        doc.moveDown(0.45).fontSize(15).fillColor('#0F172A').text(line.slice(2));
      } else if (line.startsWith('## ')) {
        doc.moveDown(0.35).fontSize(13).fillColor('#0369A1').text(line.slice(3));
      } else if (line.startsWith('### ')) {
        doc.moveDown(0.25).fontSize(11.5).fillColor('#1E293B').text(line.slice(4));
      } else if (/^\|?[\s:-]+(?:\|[\s:-]+)+\|?$/.test(line)) {
        continue;
      } else if (line.includes('|') && line.split('|').length >= 3) {
        const row = line
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean)
          .join('  |  ');
        doc.fontSize(9.5).fillColor('#334155').text(row.replace(/\*\*/g, ''), { lineGap: 2 });
      } else {
        doc.fontSize(10.5).fillColor('#1E293B').text(line.replace(/\*\*/g, ''), { lineGap: 3 });
      }
    }

    if (input.footerNote) {
      doc.moveDown(1.2);
      doc.fontSize(8.5).fillColor('#94A3B8').text(pdfSafe(input.footerNote), { align: 'center' });
    }

    doc.end();
  });
}

export function generateTrueHtmlDocument(input: ExportDocumentInput): string {
  const safe = (s: string) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');

  const escapeInline = (s: string) =>
    safe(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const lines = (input.content || '').split(/\r?\n/);
  const htmlParts: string[] = [];
  let inTable = false;
  let tableHeaderDone = false;

  const closeTable = () => {
    if (inTable) {
      htmlParts.push('</tbody></table>');
      inTable = false;
      tableHeaderDone = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.includes('|') && line.split('|').length >= 3) {
      if (/^\|?[\s:-]+(?:\|[\s:-]+)+\|?$/.test(line)) {
        tableHeaderDone = true;
        continue;
      }
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));
      if (!inTable) {
        inTable = true;
        htmlParts.push('<table><thead><tr>');
        cells.forEach((c) => htmlParts.push(`<th>${escapeInline(c)}</th>`));
        htmlParts.push('</tr></thead><tbody>');
      } else {
        htmlParts.push('<tr>');
        cells.forEach((c) => htmlParts.push(`<td>${escapeInline(c)}</td>`));
        htmlParts.push('</tr>');
      }
      continue;
    } else {
      closeTable();
    }

    if (!line) continue;
    if (line.startsWith('# ')) htmlParts.push(`<h1>${escapeInline(line.slice(2))}</h1>`);
    else if (line.startsWith('## ')) htmlParts.push(`<h2>${escapeInline(line.slice(3))}</h2>`);
    else if (line.startsWith('### ')) htmlParts.push(`<h3>${escapeInline(line.slice(4))}</h3>`);
    else if (line.startsWith('- ') || line.startsWith('* ')) htmlParts.push(`<li>${escapeInline(line.slice(2))}</li>`);
    else htmlParts.push(`<p>${escapeInline(line)}</p>`);
  }
  closeTable();

  void tableHeaderDone;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safe(input.title)} — RaOne Document Studio</title>
<style>
  body { margin: 0; background: #0f1115; color: #e5e7eb; font-family: system-ui, -apple-system, sans-serif; line-height: 1.65; padding: 32px 16px; }
  .sheet { max-width: 840px; margin: 0 auto; background: #16181d; border: 1px solid #262932; border-radius: 14px; padding: 40px 44px; box-shadow: 0 24px 64px rgba(0,0,0,0.45); }
  .brand { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #38bdf8; margin-bottom: 8px; }
  h1 { font-size: 26px; margin: 0 0 12px; color: #ffffff; }
  h2 { font-size: 18px; margin-top: 28px; color: #f1f5f9; border-bottom: 1px solid #262932; padding-bottom: 6px; }
  h3 { font-size: 15px; margin-top: 20px; color: #cbd5e1; }
  .summary { background: #1c1f26; border: 1px solid #2b303c; border-radius: 10px; padding: 14px 18px; font-size: 14px; color: #d1d5db; margin-bottom: 24px; }
  p, li { font-size: 14px; color: #d1d5db; }
  table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px; }
  th, td { border: 1px solid #2b303c; padding: 9px 12px; text-align: left; }
  th { background: #1e222b; color: #ffffff; font-weight: 600; }
  footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #262932; font-size: 12px; color: #6b7280; text-align: center; }
  @media print { body { background: #fff; color: #111; } .sheet { border: none; box-shadow: none; background: #fff; color: #111; } h1,h2,h3,p,li,th,td { color: #111; } th { background: #f3f4f6; } }
</style>
</head>
<body>
  <article class="sheet">
    ${input.companyName ? `<div class="brand">${safe(input.companyName)}</div>` : ''}
    <h1>${safe(input.title)}</h1>
    ${input.summary ? `<div class="summary">${safe(input.summary)}</div>` : ''}
    ${htmlParts.join('\n')}
    ${input.footerNote ? `<footer>${safe(input.footerNote)}</footer>` : ''}
  </article>
</body>
</html>`;
}
