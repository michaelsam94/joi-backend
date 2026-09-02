import PDFDocument from 'pdfkit';
import { QrSheetEntry } from '../../application/ports/DocumentExporter';

const PAGE_MARGIN = 36;
const COLS = 3;
const CELL_SIZE = 170;
const QR_SIZE = 120;

/** Lays out a printable grid: one QR code + name per cell, several per page. */
export function buildQrSheetPdf(entries: QrSheetEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Joi — Member QR Codes', { align: 'center' });
    doc.moveDown();

    let col = 0;
    let x = PAGE_MARGIN;
    let y = doc.y;
    const pageWidth = doc.page.width - PAGE_MARGIN * 2;
    const startY = doc.y;

    entries.forEach((entry, i) => {
      if (y + CELL_SIZE > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      x = PAGE_MARGIN + col * (pageWidth / COLS);
      doc.image(entry.qrPng, x, y, { width: QR_SIZE, height: QR_SIZE });
      doc.fontSize(10).text(entry.fullName, x, y + QR_SIZE + 4, { width: pageWidth / COLS, align: 'center' });

      col += 1;
      if (col >= COLS) {
        col = 0;
        y += CELL_SIZE;
      }
    });

    doc.end();
  });
}
