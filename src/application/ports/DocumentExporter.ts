import { ExportTable } from './DatabaseExportRepository';

export interface QrSheetEntry {
  fullName: string;
  qrPng: Buffer;
}

export interface DocumentExporter {
  /** Builds a printable QR sheet and returns a shareable URL to the resulting document. */
  exportQrSheet(entries: QrSheetEntry[]): Promise<{ url: string }>;
  /** Builds a Google Sheet with one tab per table and returns a shareable URL to it. */
  exportDatabaseSheet(tabs: ExportTable[]): Promise<{ url: string }>;
}
