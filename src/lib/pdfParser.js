import * as pdfjsLib from 'pdfjs-dist';
import { groupIntoRows, parseRows, buildCsv } from './pdfTableParser.js';

// Configure worker for browser environment
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).href;
  } catch (e) {
    // Fallback if URL resolution is unsupported
    console.warn('pdfjs worker setup failed:', e);
  }
}

/**
 * Extracts and parses a PDF File (or ArrayBuffer/Uint8Array) 100% client-side in the browser.
 *
 * @param {File | Blob | ArrayBuffer | Uint8Array} fileInput
 * @returns {Promise<{ records: Array, recordsCount: number, csvContent: string, originalName: string }>}
 */
export async function parsePdf(fileInput) {
  let arrayBuffer;
  let originalName = 'timetable.pdf';

  if (fileInput instanceof File || fileInput instanceof Blob) {
    arrayBuffer = await fileInput.arrayBuffer();
    if (fileInput.name) originalName = fileInput.name;
  } else if (fileInput instanceof ArrayBuffer) {
    arrayBuffer = fileInput;
  } else if (fileInput instanceof Uint8Array) {
    arrayBuffer = fileInput.buffer;
  } else {
    throw new Error('Unsupported file input format');
  }

  const data = new Uint8Array(arrayBuffer);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const allItems = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const tc = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    for (const item of tc.items) {
      if (item.str === undefined || item.str.trim() === '') continue;
      allItems.push({
        str: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(pageHeight - item.transform[5]),
        page: pageNum,
      });
    }
  }

  // Sort by page, then y (top-down), then x (left-to-right)
  allItems.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);

  const rows = groupIntoRows(allItems);
  const records = parseRows(rows);
  const csvContent = buildCsv(records);

  return {
    originalName,
    records,
    recordsCount: records.length,
    csvContent,
  };
}
